import React, { useEffect, useRef, useState } from 'react'

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

function GlobeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  )
}

function FriendsGlyph() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M2.8 19.5c.4-3.3 3-5.2 6.2-5.2s5.8 1.9 6.2 5.2" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M18.2 14.6c1.7.7 2.8 2.2 3 4.4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export const PRIVACY_OPTIONS = [
  { value: 'PUBLIC', label: 'Công khai', description: 'Mọi người đều có thể xem', Icon: GlobeIcon },
  { value: 'FRIENDS', label: 'Bạn bè', description: 'Chỉ bạn bè của bạn', Icon: FriendsGlyph },
  { value: 'PRIVATE', label: 'Chỉ mình tôi', description: 'Chỉ bạn nhìn thấy bài viết', Icon: LockIcon },
]

/**
 * Chọn quyền riêng tư của bài viết (PUBLIC | FRIENDS | PRIVATE).
 * Thay cho <select> mặc định của trình duyệt; giá trị trả về không đổi.
 */
export default function PrivacyPicker({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = PRIVACY_OPTIONS.find((option) => option.value === value) || PRIVACY_OPTIONS[0]

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const choose = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div className={`pp ${open ? 'pp--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="pp-trigger pp-trigger--icon"
        onClick={() => setOpen((isOpen) => !isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Quyền riêng tư bài viết: ${current.label}`}
        title="Ai có thể xem bài viết này?"
      >
        <span className="pp-trigger-icon"><current.Icon /></span>
      </button>
      {open && (
        <div className="pp-menu" role="listbox" aria-label="Chọn quyền riêng tư">
          <div className="pp-menu-title">Ai có thể xem bài viết này?</div>
          {PRIVACY_OPTIONS.map(({ value: optionValue, label, description, Icon }) => {
            const selected = optionValue === current.value
            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={selected}
                className={`pp-option ${selected ? 'pp-option--selected' : ''}`}
                onClick={() => choose(optionValue)}
              >
                <span className="pp-option-icon"><Icon /></span>
                <span className="pp-option-text"><strong>{label}</strong><small>{description}</small></span>
                {selected && <span className="pp-option-check"><CheckIcon /></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
