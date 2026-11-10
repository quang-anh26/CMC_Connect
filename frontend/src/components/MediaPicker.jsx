import React, { useEffect, useRef, useState } from 'react'

const svgProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

function PhotoIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.7" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="6" width="13" height="12" rx="3" />
      <path d="m16 10.5 5-3v9l-5-3Z" />
    </svg>
  )
}

const OPTIONS = [
  { kind: 'image', label: 'Ảnh', description: 'Chọn ảnh từ thiết bị', Icon: PhotoIcon },
  { kind: 'video', label: 'Video', description: 'MP4, WebM hoặc Ogg', Icon: VideoIcon },
]

/** Nút biểu tượng Ảnh/Video: bấm vào mở menu chọn loại tệp, chọn xong mở hộp chọn tệp. */
export default function MediaPicker({ onPick, disabled = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

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

  return (
    <div className={`pp ${open ? 'pp--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="composer-icon-btn composer-icon-btn--media"
        onClick={() => setOpen((isOpen) => !isOpen)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Thêm ảnh hoặc video"
        title="Ảnh / Video"
      >
        <PhotoIcon />
        <span className="composer-action-label">Ảnh/video</span>
      </button>
      {open && (
        <div className="pp-menu pp-menu--narrow" role="menu" aria-label="Thêm ảnh hoặc video">
          <div className="pp-menu-title">Thêm vào bài viết</div>
          {OPTIONS.map(({ kind, label, description, Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className="pp-option"
              onClick={() => { setOpen(false); onPick(kind) }}
            >
              <span className="pp-option-icon"><Icon /></span>
              <span className="pp-option-text"><strong>{label}</strong><small>{description}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
