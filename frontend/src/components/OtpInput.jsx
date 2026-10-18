import React, { useEffect, useRef } from 'react'

/**
 * Ô nhập mã xác thực gồm nhiều chữ số.
 * Hỗ trợ: tự nhảy ô, Backspace, mũi tên, dán cả mã (Ctrl+V), autofill từ SMS/email.
 */
export default function OtpInput({ length = 6, value, onChange, onComplete, disabled, hasError, autoFocus }) {
  const refs = useRef([])

  const focusAt = (index) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, index))]
    if (el) el.focus()
  }

  // Sau khi gửi mã đi kiểm tra xong (ô được bật lại) mà mã đã bị xóa do sai -> quay lại ô đầu tiên
  useEffect(() => {
    if (!disabled && autoFocus && value === '') focusAt(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  const commit = (next) => {
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  const handleChange = (index, event) => {
    const digits = event.target.value.replace(/\D/g, '')
    if (!digits) return
    // Luôn ghi vào ô trống đầu tiên nếu người dùng nhảy cách ô (Tab / click), tránh tạo "lỗ hổng"
    const start = Math.min(index, value.length)
    const next = (value.slice(0, start) + digits + value.slice(start + digits.length)).slice(0, length)
    commit(next)
    focusAt(Math.min(start + digits.length, length - 1))
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1))
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        focusAt(index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  const handlePaste = (event) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    event.preventDefault()
    commit(digits)
    focusAt(Math.min(digits.length, length - 1))
  }

  // Click vào ô phía sau ô trống đầu tiên -> đưa con trỏ về ô trống đầu tiên
  const handleMouseDown = (index, event) => {
    if (index > value.length) {
      event.preventDefault()
      focusAt(value.length)
    }
  }

  return (
    <div className="ap-otp" role="group" aria-label="Mã xác thực">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => (refs.current[index] = el)}
          className={`${value[index] ? 'filled' : ''} ${hasError ? 'has-error' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Chữ số thứ ${index + 1}`}
          value={value[index] || ''}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          onMouseDown={(event) => handleMouseDown(index, event)}
        />
      ))}
    </div>
  )
}
