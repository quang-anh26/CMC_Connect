import React, { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
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
  UserPlusIcon,
} from '../components/AuthIcons'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'

const STUDENT_EMAIL_DOMAIN = 'st.cmcu.edu.vn'
// Chỉ nhận email sinh viên CMC: tên@st.cmcu.edu.vn
const STUDENT_EMAIL_RE = /^[a-z0-9._%+-]+@st\.cmcu\.edu\.vn$/i
const STUDENT_EMAIL_MESSAGE = `Vui lòng dùng email sinh viên có đuôi @${STUDENT_EMAIL_DOMAIN}`
const USERNAME_RE = /^[A-Za-z0-9_.]{3,50}$/
const CODE_LENGTH = 6

const STEP_META = {
  1: { title: 'Đăng ký', sub: 'Dùng email sinh viên @st.cmcu.edu.vn để nhận mã xác thực', badge: <UserPlusIcon size={28} /> },
  2: { title: 'Xác thực email', sub: 'Nhập mã gồm 6 chữ số đã được gửi về email', badge: <ShieldCheckIcon size={28} /> },
  3: { title: 'Tạo tài khoản', sub: 'Chỉ còn một bước nữa để hoàn tất', badge: <UserIcon size={28} /> },
}

// Server ở chế độ DEV (chưa cấu hình SMTP) trả emailSent=false -> báo rõ để không chờ mail vô ích
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

export default function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Đếm ngược thời gian được phép gửi lại mã
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (user) return <Navigate to="/" replace />

  const meta = STEP_META[step]
  const strength = passwordStrength(password)

  const goToStep = (next) => {
    setStep(next)
    setFieldErrors({})
    setFormError('')
  }

  const clearError = (name) => {
    setFormError('')
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }

  // ---- Bước 1: gửi mã tới email ----
  const sendCode = async (e) => {
    e?.preventDefault()
    setFormError('')
    const normalized = email.trim().toLowerCase()
    if (!normalized) { setFieldErrors({ email: 'Vui lòng nhập email sinh viên' }); return }
    if (!normalized.includes('@') || !STUDENT_EMAIL_RE.test(normalized)) { setFieldErrors({ email: STUDENT_EMAIL_MESSAGE }); return }
    setFieldErrors({})

    setSubmitting(true)
    try {
      const { data } = await authApi.sendRegisterCode(normalized)
      setEmail(normalized)
      setCode('')
      setCooldown(data?.resendCooldownSeconds ?? 60)
      setNotice(sentNotice(data, normalized, false))
      goToStep(2)
    } catch (err) {
      const errors = getFieldErrors(err)
      if (errors.email) setFieldErrors({ email: errors.email })
      else setFormError(getApiErrorMessage(err, 'Không thể gửi mã xác thực. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Gửi lại mã (bước 2) ----
  const resendCode = async () => {
    if (cooldown > 0 || submitting) return
    setFormError('')
    setSubmitting(true)
    try {
      const { data } = await authApi.sendRegisterCode(email)
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

  // ---- Bước 2: kiểm tra mã ----
  const verifyCode = async (value = code) => {
    if (submitting) return
    if (value.length !== CODE_LENGTH) {
      setFormError(`Vui lòng nhập đủ ${CODE_LENGTH} chữ số`)
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const { data } = await authApi.verifyRegisterCode(email, value)
      setVerificationToken(data.verificationToken)
      setNotice('')
      goToStep(3)
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Mã xác thực không đúng. Vui lòng thử lại.'))
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Bước 3: tạo tài khoản ----
  const createAccount = async (e) => {
    e.preventDefault()
    setFormError('')

    const errors = {}
    if (!displayName.trim()) errors.displayName = 'Vui lòng nhập tên hiển thị'
    if (!USERNAME_RE.test(username)) {
      errors.username = username
        ? 'Username gồm 3-50 ký tự: chữ, số, dấu chấm hoặc gạch dưới'
        : 'Vui lòng nhập username'
    }
    if (password.length < 6) errors.password = 'Mật khẩu cần tối thiểu 6 ký tự'
    if (confirmPassword !== password) errors.confirmPassword = 'Mật khẩu nhập lại không khớp'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await register({
        email,
        verificationToken,
        username: username.trim(),
        displayName: displayName.trim(),
        password,
      })
      navigate('/')
    } catch (err) {
      const serverErrors = getFieldErrors(err)
      if (Object.keys(serverErrors).length > 0) {
        setFieldErrors(serverErrors)
      } else {
        const message = getApiErrorMessage(err, 'Đăng ký thất bại. Vui lòng thử lại.')
        // Lỗi username trùng hiển thị ngay dưới ô username
        if (err.response?.status === 409 && /username/i.test(message)) setFieldErrors({ username: message })
        else setFormError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      badge={meta.badge}
      title={meta.title}
      subtitle={meta.sub}
      hero={{
        lead: 'Tham gia',
        accent: 'CMC Talk',
        text: 'Tạo tài khoản chỉ với 3 bước. Email sinh viên @st.cmcu.edu.vn dùng để định danh tài khoản, giúp bảo vệ bạn và giúp bạn bè dễ tìm thấy bạn hơn.',
      }}
      activeStep={step}
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
        <form onSubmit={createAccount} noValidate>
          <div className="ap-verified-chip">
            <CheckIcon size={16} strokeWidth={3} />
            <span>{email}</span>
          </div>

          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.displayName ? 'has-error' : ''}`}>
              <UserIcon size={20} />
              <input
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); clearError('displayName') }}
                placeholder="Tên hiển thị"
                maxLength={100}
                aria-label="Tên hiển thị"
                autoFocus
              />
            </div>
            {fieldErrors.displayName && <p className="ap-field-error">{fieldErrors.displayName}</p>}
          </div>

          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.username ? 'has-error' : ''}`}>
              <span className="ap-at" aria-hidden="true">@</span>
              <input
                value={username}
                onChange={(e) => { setUsername(e.target.value.replace(/\s/g, '')); clearError('username') }}
                placeholder="Username (dùng để đăng nhập)"
                maxLength={50}
                autoComplete="username"
                aria-label="Username"
              />
            </div>
            {fieldErrors.username && <p className="ap-field-error">{fieldErrors.username}</p>}
          </div>

          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.password ? 'has-error' : ''}`}>
              <LockIcon size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError('password') }}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                maxLength={72}
                autoComplete="new-password"
                aria-label="Mật khẩu"
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
            {password && (
              <div className={`ap-strength level-${strength.score}`} aria-live="polite">
                <div className="ap-strength-bars">
                  {[1, 2, 3, 4].map((n) => <span key={n} className={strength.score >= n ? 'on' : ''} />)}
                </div>
                <small>Độ mạnh: {strength.label}</small>
              </div>
            )}
            {fieldErrors.password && <p className="ap-field-error">{fieldErrors.password}</p>}
          </div>

          <div className="ap-field">
            <div className={`ap-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}>
              <LockIcon size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword') }}
                placeholder="Nhập lại mật khẩu"
                maxLength={72}
                autoComplete="new-password"
                aria-label="Nhập lại mật khẩu"
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
            {submitting ? 'Đang tạo tài khoản...' : <>Hoàn tất đăng ký <ArrowRightIcon size={20} /></>}
          </button>
        </form>
      )}

      <p className="ap-switch">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </AuthLayout>
  )
}
