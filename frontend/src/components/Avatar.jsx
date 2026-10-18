import React, { useEffect, useState } from 'react'

// Bảng màu cho avatar mặc định: cùng một tên luôn ra cùng một màu.
const PALETTE = [
  ['#2f8cff', '#0b55c9'],
  ['#8b5cf6', '#5b21b6'],
  ['#ec4899', '#9d174d'],
  ['#f97316', '#9a3412'],
  ['#10b981', '#047857'],
  ['#06b6d4', '#0e7490'],
  ['#eab308', '#a16207'],
  ['#64748b', '#334155'],
]

function paletteFor(name) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function initialOf(name) {
  const trimmed = (name || '').trim()
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : ''
}

// Ảnh bị lỗi (link hỏng, 404, mất mạng) -> chuyển sang avatar mặc định.
// Khi `src` đổi sang ảnh mới thì thử tải lại.
function useImageFailed(src) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return [failed, setFailed]
}

/**
 * Ảnh có phương án thay thế: nếu `src` trống hoặc tải lỗi thì hiện `fallback`.
 *   <SafeImage src={group.avatar} fallback={<span>{initial}</span>} />
 */
export function SafeImage({ src, alt = '', fallback = null, onError, ...rest }) {
  const [failed, setFailed] = useImageFailed(src)
  if (!src || failed) return fallback
  return (
    <img
      src={src}
      alt={alt}
      {...rest}
      onError={(event) => {
        setFailed(true)
        if (onError) onError(event)
      }}
    />
  )
}

function PersonSilhouette({ size }) {
  return (
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.2" r="4.2" />
      <path d="M3.8 21c0-4.3 3.7-7 8.2-7s8.2 2.7 8.2 7c0 .6-.4 1-1 1H4.8c-.6 0-1-.4-1-1z" />
    </svg>
  )
}

function GroupCell({ src }) {
  const [failed, setFailed] = useImageFailed(src)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2b394e',
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: 10, color: '#cfd6e4' }}>•</span>
      )}
    </div>
  )
}

export default function Avatar({ src, name, size = 44, groupAvatars = null, className = '' }) {
  const [failed, setFailed] = useImageFailed(src)

  if (groupAvatars && groupAvatars.length >= 2) {
    const displayList = groupAvatars.slice(0, 4)
    return (
      <div
        className={`avatar group-avatar-grid ${className}`}
        style={{
          width: size,
          height: size,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: 1.5,
          padding: 1.5,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#1b2637',
          flexShrink: 0,
        }}
      >
        {displayList.map((avatarSrc, index) => (
          <GroupCell key={index} src={avatarSrc} />
        ))}
      </div>
    )
  }

  const showImage = Boolean(src) && !failed
  const initial = initialOf(name)
  const [colorFrom, colorTo] = paletteFor((name || '').trim())

  return (
    <div
      className={`avatar ${className}`}
      role={showImage ? undefined : 'img'}
      aria-label={showImage ? undefined : name || 'Người dùng'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: initial ? `linear-gradient(135deg, ${colorFrom}, ${colorTo})` : 'linear-gradient(135deg, #64748b, #334155)',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: size * 0.4,
        userSelect: 'none',
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name || ''}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initial ? (
        initial
      ) : (
        <PersonSilhouette size={size} />
      )}
    </div>
  )
}
