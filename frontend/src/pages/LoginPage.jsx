import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  UserIcon,
} from '../components/AuthIcons'
import { getApiErrorMessage } from '../utils/apiError'

// Chỉ ghi nhớ tên đăng nhập (KHÔNG bao giờ lưu mật khẩu)
const REMEMBER_KEY = 'cmctalk-remembered-login'

function readRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) || ''
  } catch {
    return ''
  }
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState(readRemembered)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => Boolean(readRemembered()))
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const clearError = (name) => {
    setFormError('')
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    const errors = {}
    if (!identifier.trim()) errors.identifier = 'Vui lòng nhập tên đăng nhập hoặc email'
    if (!password) errors.password = 'Vui lòng nhập mật khẩu'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await login(identifier.trim(), password)
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, identifier.trim())
        else localStorage.removeItem(REMEMBER_KEY)
      } catch {
        // trình duyệt chặn localStorage: bỏ qua, không ảnh hưởng đăng nhập
      }
      navigate('/')
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      badge={<LockIcon size={28} />}
      title="Đăng nhập"
      subtitle="Vui lòng nhập thông tin tài khoản để tiếp tục"
      hero={{
        lead: 'Kết nối mọi',
        accent: 'khoảnh khắc!',
        text: 'Nhắn tin, gọi video và chia sẻ những điều thú vị cùng bạn bè trên CMC Talk.',
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="ap-field">
          <div className={`ap-input ${fieldErrors.identifier ? 'has-error' : ''}`}>
            <UserIcon size={20} />
            <input
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); clearError('identifier') }}
              placeholder="Tên đăng nhập hoặc email"
              autoComplete="username"
              aria-label="Tên đăng nhập hoặc email"
              aria-invalid={Boolean(fieldErrors.identifier)}
              autoFocus={!identifier}
            />
          </div>
          {fieldErrors.identifier && <p className="ap-field-error">{fieldErrors.identifier}</p>}
        </div>

        <div className="ap-field">
          <div className={`ap-input ${fieldErrors.password ? 'has-error' : ''}`}>
            <LockIcon size={20} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError('password') }}
              placeholder="Mật khẩu"
              autoComplete="current-password"
              aria-label="Mật khẩu"
              aria-invalid={Boolean(fieldErrors.password)}
              autoFocus={Boolean(identifier)}
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
          {fieldErrors.password && <p className="ap-field-error">{fieldErrors.password}</p>}
        </div>

        <div className="ap-options">
          <label className="ap-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Nhớ tài khoản</span>
          </label>
        </div>

        {formError && (
          <div className="ap-alert error" role="alert">
            <AlertCircleIcon size={18} />
            <span>{formError}</span>
          </div>
        )}

        <button className="ap-btn" type="submit" disabled={submitting}>
          {submitting ? <span className="ap-spinner" aria-hidden="true" /> : null}
          {submitting ? 'Đang đăng nhập...' : <>Đăng nhập <ArrowRightIcon size={20} /></>}
        </button>
      </form>

      <p className="ap-switch">
        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
      </p>
    </AuthLayout>
  )
}
