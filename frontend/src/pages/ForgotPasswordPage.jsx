import React, { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/authApi'
import AuthLayout from '../components/AuthLayout'
import OtpInput from '../components/OtpInput'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  UserIcon,
} from '../components/AuthIcons'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'

const STUDENT_EMAIL_DOMAIN = 'st.cmcu.edu.vn'
// Giống trang đăng ký: chỉ nhận email sinh viên CMC
const STUDENT_EMAIL_RE = /^[a-z0-9._%+-]+@st\.cmcu\.edu\.vn$/i
const STUDENT_EMAIL_MESSAGE = `Vui lòng dùng email sinh viên có đuôi @${STUDENT_EMAIL_DOMAIN}`
const CODE_LENGTH = 6

const FORGOT_STEPS = [
  { icon: MailIcon, title: 'Nhập email', desc: 'Email sinh viên đã đăng ký.' },
  { icon: ShieldCheckIcon, title: 'Xác thực mã', desc: 'Nhập mã vừa được gửi về email.' },
  { icon: LockIcon, title: 'Mật khẩu mới', desc: 'Chọn tài khoản và đặt mật khẩu mới.' },
]

const STEP_META = {
  1: { title: 'Quên mật khẩu', sub: 'Nhập email sinh viên đã đăng ký để nhận mã xác thực', badge: <MailIcon size={28} /> },
  2: { title: 'Xác thực email', sub: 'Nhập mã gồm 6 chữ số đã được gửi về email', badge: <ShieldCheckIcon size={28} /> },
  3: { title: 'Đặt lại mật khẩu', sub: 'Chọn tài khoản và đặt mật khẩu mới', badge: <LockIcon size={28} /> },
}

function sentNotice(data, email, resend) {
  if (data?.emailSent === false) {
    return 'Máy chủ chưa cấu hình gửi email nên chưa có mail nào được gửi. Mã xác thực đang hiển thị trong console của backend (chế độ test).'
  }
  return resend
    ? `Đã gửi lại mã xác thực tới ${email}`
    : `Mã xác thực đã được gửi tới ${email}. Nếu không thấy, hãy kiểm tra mục Spam.`
}

function passwordStrength(password) {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 8) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (password.length < 6) score = Math.min(score, 1)
  return { score, label: ['Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][score] }
}

export default function ForgotPasswordPage() {
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)

  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Đang đăng nhập thì không cần quên mật khẩu (nhưng vẫn cho xem màn hình thành công vừa đổi xong)
  if (user && !done) return <Navigate to="/" replace />

  const meta = STEP_META[step]
  const strength = passwordStrength(newPassword)

  const goToStep = (next) => {
    setStep(next)
    setFieldErrors({})
    setFormError('')
  }

  const clearError = (name) => {
    setFormError('')
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }

  // ---- Bước 1: gửi mã tới email sinh viên ----
  const sendCode = async (e) => {
    e?.preventDefault()
    setFormError('')
    const normalized = email.trim().toLowerCase()
    if (!normalized) { setFieldErrors({ email: 'Vui lòng nhập email sinh viên' }); return }
    if (!STUDENT_EMAIL_RE.test(normalized)) { setFieldErrors({ email: STUDENT_EMAIL_MESSAGE }); return }
    setFieldErrors({})

    setSubmitting(true)
    try {
      const { data } = await authApi.sendForgotPasswordCode(normalized)
      setEmail(normalized)
      setCode('')
      setCooldown(data?.resendCooldownSeconds ?? 60)
      setNotice(sentNotice(data, normalized, false))
      goToStep(2)
    } catch (err) {
      const errors = getFieldErrors(err)
      if (errors.email) setFieldErrors({ email: errors.email })
      else if (err.response?.status === 404) setFieldErrors({ email: getApiErrorMessage(err) })
      else setFormError(getApiErrorMessage(err, 'Không thể gửi mã xác thực. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resendCode = async () => {
    if (cooldown > 0 || submitting) return
    setFormError('')
    setSubmitting(true)
    try {
      const { data } = await authApi.sendForgotPasswordCode(email)
      setCode('')
      setCooldown(data?.resendCooldownSeconds ?? 60)
      setNotice(sentNotice(data, email, true))
    } catch (err) {
      setNotice('')
      setFormError(getApiErrorMessage(err, 'Không thể gửi lại mã. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Bước 2: kiểm tra mã -> nhận danh sách tài khoản ----
  const verifyCode = async (value = code) => {
    if (submitting) return
    if (value.length !== CODE_LENGTH) {
      setFormError(`Vui lòng nhập đủ ${CODE_LENGTH} chữ số`)
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const { data } = await authApi.verifyForgotPasswordCode(email, value)
      setResetToken(data.resetToken)
      const list = data.accounts || []
      setAccounts(list)
      setSelected(list.length === 1 ? list[0] : null) // chỉ có 1 tài khoản thì chọn sẵn
      setNewPassword('')
      setConfirmPassword('')
      setNotice('')
      goToStep(3)
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Mã xác thực không đúng. Vui lòng thử lại.'))
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Bước 3a: bấm vào tài khoản ----
  const chooseAccount = (account) => {
    setSelected(account)
    setNewPassword('')
    setConfirmPassword('')
    setFieldErrors({})
    setFormError('')
  }

  // ---- Bước 3b: đặt mật khẩu mới ----
  const resetPassword = async (e) => {
    e.preventDefault()
    setFormError('')

    const errors = {}
    if (newPassword.length < 6) errors.newPassword = 'Mật khẩu cần tối thiểu 6 ký tự'
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Mật khẩu nhập lại không khớp'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await authApi.resetPassword({ email, resetToken, userId: selected.userId, newPassword })
      setDone(true)
    } catch (err) {
      const serverErrors = getFieldErrors(err)
      if (Object.keys(serverErrors).length > 0) setFieldErrors(serverErrors)
      else setFormError(getApiErrorMessage(err, 'Không thể đổi mật khẩu. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthLayout
        badge={<CheckIcon size={28} strokeWidth={3} />}
        title="Đổi mật khẩu thành công"
        subtitle="Bạn có thể đăng nhập bằng mật khẩu mới"
        hero={{ lead: 'Lấy lại', accent: 'tài khoản', text: 'Mật khẩu của bạn đã được cập nhật. Các thiết bị đang đăng nhập bằng mật khẩu cũ đã bị đăng xuất.' }}
        activeStep={3}
        steps={FORGOT_STEPS}
      >
        <div className="ap-alert success" role="status">
          <CheckIcon size={18} />
          <span>Tài khoản <b>{selected?.username}</b> đã được đặt mật khẩu mới.</span>
        </div>
        <Link to="/login" className="ap-btn ap-btn-link">
          Về trang đăng nhập <ArrowRightIcon size={20} />
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      badge={meta.badge}
      title={meta.title}
      subtitle={meta.sub}
      hero={{
        lead: 'Lấy lại',
        accent: 'tài khoản',
        text: 'Lấy lại tài khoản chỉ với 3 bước. Xác nhận bằng email sinh viên @st.cmcu.edu.vn đã dùng khi đăng ký, rồi đặt mật khẩu mới.',
      }}
      activeStep={step}
      steps={FORGOT_STEPS}
    >
      {step === 1 && (
        <form onSubmit={sendCode} noValidate>
          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.email ? 'has-error' : ''}`}>
              <MailIcon size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                placeholder={`Email sinh viên (tên@${STUDENT_EMAIL_DOMAIN})`}
                autoComplete="email"
                aria-label="Email sinh viên"
                aria-invalid={Boolean(fieldErrors.email)}
                autoFocus
              />
            </div>
            {fieldErrors.email && <p className="ap-field-error">{fieldErrors.email}</p>}
          </div>

          {formError && (
            <div className="ap-alert error" role="alert">
              <AlertCircleIcon size={18} />
              <span>{formError}</span>
            </div>
          )}

          <button className="ap-btn" type="submit" disabled={submitting}>
            {submitting && <span className="ap-spinner" aria-hidden="true" />}
            {submitting ? 'Đang gửi mã...' : <>Gửi mã xác thực <ArrowRightIcon size={20} /></>}
          </button>
        </form>
      )}

      {step === 2 && (
        <div>
          {notice && (
            <div className="ap-alert success" role="status">
              <CheckIcon size={18} />
              <span>{notice}</span>
            </div>
          )}

          <OtpInput
            length={CODE_LENGTH}
            value={code}
            onChange={(next) => { setCode(next); setFormError('') }}
            onComplete={verifyCode}
            disabled={submitting}
            hasError={Boolean(formError)}
            autoFocus
          />

          {formError && (
            <div className="ap-alert error" role="alert">
              <AlertCircleIcon size={18} />
              <span>{formError}</span>
            </div>
          )}

          <button className="ap-btn" type="button" disabled={submitting || code.length !== CODE_LENGTH} onClick={() => verifyCode()}>
            {submitting && <span className="ap-spinner" aria-hidden="true" />}
            {submitting ? 'Đang xác thực...' : <>Xác thực <ArrowRightIcon size={20} /></>}
          </button>

          <div className="ap-row-links">
            <button type="button" className="ap-link-btn" onClick={() => { setNotice(''); goToStep(1) }} disabled={submitting}>
              Đổi email
            </button>
            <button type="button" className="ap-link-btn" onClick={resendCode} disabled={cooldown > 0 || submitting}>
              {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="ap-verified-chip">
            <CheckIcon size={16} strokeWidth={3} />
            <span>{email}</span>
          </div>

          {!selected && (
            <>
              <p className="ap-hint">Bấm vào tài khoản bạn muốn đổi mật khẩu:</p>
              <ul className="ap-accounts">
                {accounts.map((account) => (
                  <li key={account.userId}>
                    <button type="button" className="ap-account" onClick={() => chooseAccount(account)}>
                      <span className="ap-account-avatar" aria-hidden="true">
                        {(account.displayName || account.username || '?').trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="ap-account-info">
                        <strong>{account.displayName || account.username}</strong>
                        <small>@{account.username}</small>
                      </span>
                      <ArrowRightIcon size={20} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {selected && (
            <form onSubmit={resetPassword} noValidate>
              <div className="ap-account is-static">
                <span className="ap-account-avatar" aria-hidden="true">
                  {(selected.displayName || selected.username || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className="ap-account-info">
                  <strong>{selected.displayName || selected.username}</strong>
                  <small>@{selected.username}</small>
                </span>
              </div>

          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.newPassword ? 'has-error' : ''}`}>
              <LockIcon size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); clearError('newPassword') }}
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                maxLength={72}
                autoComplete="new-password"
                aria-label="Mật khẩu mới"
                autoFocus
              />
              <button
                type="button"
                className="ap-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
            {newPassword && (
              <div className={`ap-strength level-${strength.score}`} aria-live="polite">
                <div className="ap-strength-bars">
                  {[1, 2, 3, 4].map((n) => <span key={n} className={strength.score >= n ? 'on' : ''} />)}
                </div>
                <small>Độ mạnh: {strength.label}</small>
              </div>
            )}
            {fieldErrors.newPassword && <p className="ap-field-error">{fieldErrors.newPassword}</p>}
          </div>

          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}>
              <LockIcon size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword') }}
                placeholder="Nhập lại mật khẩu mới"
                maxLength={72}
                autoComplete="new-password"
                aria-label="Nhập lại mật khẩu mới"
              />
            </div>
            {fieldErrors.confirmPassword && <p className="ap-field-error">{fieldErrors.confirmPassword}</p>}
          </div>

          {formError && (
            <div className="ap-alert error" role="alert">
              <AlertCircleIcon size={18} />
              <span>{formError}</span>
            </div>
          )}

              <button className="ap-btn" type="submit" disabled={submitting}>
                {submitting && <span className="ap-spinner" aria-hidden="true" />}
                {submitting ? 'Đang lưu...' : <>Đổi mật khẩu <ArrowRightIcon size={20} /></>}
              </button>

              {accounts.length > 1 && (
                <div className="ap-row-links">
                  <button type="button" className="ap-link-btn" onClick={() => { setSelected(null); setFormError(''); setFieldErrors({}) }} disabled={submitting}>
                    Chọn tài khoản khác
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      <p className="ap-switch">
        Nhớ ra mật khẩu rồi? <Link to="/login">Đăng nhập</Link>
      </p>
    </AuthLayout>
  )
}
