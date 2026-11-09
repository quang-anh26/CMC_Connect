import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import EmptyState from './EmptyState'
import { blockApi } from '../api/blockApi'
import { conversationApi } from '../api/conversationApi'
import { messageApi } from '../api/messageApi'
import {
  UserProfileIcon,
  SearchIcon,
  BellIcon,
  ChevronRight,
  NicknameIcon,
  TopicIcon,
  CloseIcon,
} from './Icons'

const CHAT_WALLPAPERS = [
  { id: 'mountain-meadow', name: 'Đồng cỏ', src: '/chat-themes/mountain-meadow.webp' },
  { id: 'sunset', name: 'Hoàng hôn', src: '/chat-themes/sunset.webp' },
  { id: 'alpine-lake', name: 'Hồ núi', src: '/chat-themes/alpine-lake.webp' },
  { id: 'moonlight', name: 'Ánh trăng', src: '/chat-themes/moonlight.jpg' },
]

function formatLastSeen(dateStr, now) {
  if (!dateStr) return 'chưa rõ thời gian'
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 60000))
  if (elapsedMinutes < 1) return 'vừa xong'
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} giờ trước`
  return `${Math.floor(elapsedHours / 24)} ngày trước`
}

export default function ContactInfoPanel({ conversationInfo, otherUserId, images = [], messages = [], onClose, onDetailsUpdated, onBlockStatusUpdated, onJumpToMessage }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [blockSaving, setBlockSaving] = useState(false)
  const [muted, setMuted] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [nicknameTargetUserId, setNicknameTargetUserId] = useState(otherUserId)
  const [savingDetail, setSavingDetail] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState('')
  const [wallpaperError, setWallpaperError] = useState('')
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const blocked = Boolean(conversationInfo?.blockedByCurrentUser)

  const toggleBlock = async () => {
    if (!otherUserId || blockSaving) return
    setBlockSaving(true)
    try {
      if (blocked) {
        await blockApi.unblock(otherUserId)
        onBlockStatusUpdated?.(false)
      } else {
        if (!window.confirm(`Chặn người dùng ${displayName}? Họ sẽ không thể nhắn tin cho bạn.`)) return
        await blockApi.block(otherUserId)
        onBlockStatusUpdated?.(true)
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể thực hiện thao tác')
    } finally {
      setBlockSaving(false)
    }
  }

  const openDetailEditor = (field) => {
    setEditingField(field)
    setNicknameTargetUserId(otherUserId)
    setBackgroundImage(conversationInfo.backgroundImage || '')
    setWallpaperError('')
    setEditValue(field === 'nickname'
      ? conversationInfo.otherUserNickname || ''
      : conversationInfo.topic || '')
  }

  const saveDetail = async (event) => {
    event.preventDefault()
    if (!editingField) return
    setSavingDetail(true)
    const details = editingField === 'nickname'
      ? { targetUserId: Number(nicknameTargetUserId), nickname: editValue }
      : { topic: editValue, backgroundImage }
    try {
      const { data } = await conversationApi.updateDetails(conversationInfo.conversationId, details)
      onDetailsUpdated?.(data)
      setEditingField(null)
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể cập nhật thông tin cuộc trò chuyện')
    } finally {
      setSavingDetail(false)
    }
  }

  const handleWallpaperUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setWallpaperError('Vui lòng chọn một tệp hình ảnh.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setWallpaperError('Ảnh không được vượt quá 10 MB.')
      return
    }

    setUploadingWallpaper(true)
    setWallpaperError('')
    try {
      const { data } = await messageApi.upload(file)
      setBackgroundImage(data.url)
    } catch (error) {
      setWallpaperError(error.response?.data?.message || 'Không thể tải ảnh lên.')
    } finally {
      setUploadingWallpaper(false)
    }
  }

  const previewMedia = (images || []).slice(0, 4)
  const remainingCount = images.length > 4 ? images.length - 3 : 0

  const matchingMessages = React.useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    if (!term) return []

    return (messages || [])
      .filter((message) => !message.deleted && message.messageType !== 'SYSTEM')
      .filter((message) => {
        const content = String(message.content || '').toLowerCase()
        return content.includes(term)
      })
      .slice(0, 8)
      .map((message) => ({
        messageId: message.messageId,
        senderName: message.senderDisplayName || 'Bạn',
        content: String(message.content || '').replace(/\s+/g, ' ').trim(),
        time: message.createdAt,
      }))
  }, [messages, searchQuery])

  if (!conversationInfo) return null

  const displayName = conversationInfo?.name || 'Cuộc trò chuyện'
  const isOnline = conversationInfo?.otherUserOnline
  const isGroup = conversationInfo?.type === 'GROUP'

  return (
    <div className="info-panel" id="chat-contact-info">
      <div className="info-panel-header">
        <span>Thông tin cuộc trò chuyện</span>
        <button
          type="button"
          className="info-panel-close"
          onClick={onClose}
          aria-label="Đóng thông tin cuộc trò chuyện"
          title="Đóng"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      {/* Profile Header */}
      <div className="info-profile-section">
        <div className="info-avatar-wrapper">
          <Avatar
            src={conversationInfo.avatar}
            name={displayName}
            size={82}
          />
        </div>

        <div className="info-profile-name">{displayName}</div>

        <div className="info-status-row">
          <span className={`status-dot ${isGroup ? 'online' : (isOnline ? 'online' : 'offline')}`} />
          <span className="status-label">
            {isGroup ? 'Nhóm chat' : (isOnline ? 'Đang hoạt động' : `Hoạt động · ${formatLastSeen(conversationInfo.otherUserLastSeenAt, now)}`)}
          </span>
        </div>
      </div>

      <div className="info-metadata-grid">
        {!isGroup && (
          <button type="button" className="info-metadata-card" onClick={() => openDetailEditor('nickname')}>
            <span className="info-metadata-icon"><NicknameIcon size={20} /></span>
            <span className="info-metadata-label">Biệt danh</span>
            <span className="info-metadata-value">{conversationInfo.otherUserNickname || 'Đặt biệt danh'}</span>
          </button>
        )}
        <button type="button" className="info-metadata-card" onClick={() => openDetailEditor('topic')}>
          <span className="info-metadata-icon"><TopicIcon size={20} /></span>
          <span className="info-metadata-label">Chủ đề</span>
          <span className="info-metadata-value">{conversationInfo.topic || 'Thêm chủ đề'}</span>
        </button>
      </div>

      {/* Action list */}
      <div className="info-actions-list">
        {!isGroup && (
          <button
            className="info-action-item"
            type="button"
            title="Xem thông tin"
            onClick={() => {
              const profileUserId = otherUserId || conversationInfo.otherUserId
              if (profileUserId) navigate(`/feed/profile/${profileUserId}`)
            }}
          >
            <span className="info-action-icon">
              <UserProfileIcon size={18} />
            </span>
            <span className="info-action-text">Xem thông tin</span>
          </button>
        )}

        <button className="info-action-item" type="button" title="Tìm kiếm trong cuộc trò chuyện" onClick={() => setSearchOpen((value) => !value)}>
          <span className="info-action-icon">
            <SearchIcon size={18} />
          </span>
          <span className="info-action-text">Tìm kiếm trong cuộc trò chuyện</span>
        </button>

        {searchOpen && (
          <div className="conversation-search-panel">
            <input
              className="conversation-search-input"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Nhập chữ để tìm trong đoạn chat..."
              autoFocus
            />

            {searchQuery.trim() && matchingMessages.length === 0 && (
              <EmptyState compact description="Không tìm thấy tin nhắn nào phù hợp." />
            )}

            {matchingMessages.length > 0 && (
              <div className="conversation-search-results">
                {matchingMessages.map((item) => {
                  const preview = item.content.length > 90 ? `${item.content.slice(0, 90)}...` : item.content
                  return (
                    <button
                      key={item.messageId}
                      type="button"
                      className="conversation-search-item"
                      onClick={() => onJumpToMessage?.(item.messageId)}
                    >
                      <span className="conversation-search-item-header">
                        <strong>{item.senderName}</strong>
                        <span>{formatLastSeen(item.time, Date.now())}</span>
                      </span>
                      <span className="conversation-search-item-text">{preview}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <button
          className="info-action-item"
          type="button"
          onClick={() => setMuted((v) => !v)}
          title="Tắt thông báo"
        >
          <span className="info-action-icon">
            <BellIcon size={18} color={muted ? '#0084ff' : '#94a3b8'} />
          </span>
          <span className="info-action-text">
            {muted ? 'Bật thông báo' : 'Tắt thông báo'}
          </span>
        </button>
      </div>

      {/* File, ảnh, liên kết Section - Real images only */}
      <div className="info-media-section">
        <div className="info-section-header">
          <span className="info-section-title">File, ảnh, liên kết</span>
          <ChevronRight size={16} />
        </div>

        {previewMedia.length > 0 ? (
          <div className="info-media-grid">
            {previewMedia.map((url, idx) => {
              const isLastSlot = idx === 3 && remainingCount > 0
              return (
                <div key={idx} className="info-media-thumb">
                  <img src={url} alt={`media-${idx}`} />
                  {isLastSlot && (
                    <div className="info-media-overlay">
                      <span>+{remainingCount}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState compact description="Chưa có ảnh hoặc tệp nào được gửi" />
        )}
      </div>

      {/* Thông tin Section */}
      <div className="info-details-section">
        <div className="info-section-header">
          <span className="info-section-title">Thông tin</span>
        </div>

        <div className="info-kv-row">
          <span className="kv-label">Tên</span>
          <span className="kv-value">{displayName}</span>
        </div>

        <div className="info-kv-row">
          <span className="kv-label">Phân loại</span>
          <span className="kv-value">{isGroup ? 'Nhóm chat' : 'Trò chuyện cá nhân'}</span>
        </div>

        <div className="info-kv-row">
          <span className="kv-label">Trạng thái</span>
          <span className="kv-value">{isGroup ? 'Hoạt động' : (isOnline ? 'Đang online' : `Hoạt động · ${formatLastSeen(conversationInfo.otherUserLastSeenAt, now)}`)}</span>
        </div>

      </div>

      {!isGroup && otherUserId && (
        <div className="info-block-btn-row">
          <button className="info-block-btn" onClick={toggleBlock} disabled={blockSaving}>
            {blocked ? 'Bỏ chặn người dùng' : 'Chặn người dùng'}
          </button>
        </div>
      )}

      {editingField && (
        <div className="detail-editor-backdrop" onClick={() => !savingDetail && setEditingField(null)}>
          <form
            className="detail-editor-dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={saveDetail}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-editor-title"
          >
            <div className="detail-editor-header">
              <h2 id="detail-editor-title">{editingField === 'nickname' ? 'Đổi biệt danh' : 'Đổi chủ đề'}</h2>
              <button type="button" className="detail-editor-close" onClick={() => setEditingField(null)} title="Đóng">
                <CloseIcon size={18} />
              </button>
            </div>
            {editingField === 'nickname' && (
              <>
                <label className="detail-editor-label" htmlFor="nickname-target">Đổi biệt danh cho</label>
                <select
                  id="nickname-target"
                  className="detail-editor-input detail-editor-select"
                  value={nicknameTargetUserId || ''}
                  onChange={(event) => {
                    const targetUserId = Number(event.target.value)
                    setNicknameTargetUserId(targetUserId)
                    setEditValue(targetUserId === Number(user?.userId)
                      ? conversationInfo.currentUserNickname || ''
                      : conversationInfo.otherUserNickname || '')
                  }}
                >
                  <option value={user?.userId}>{`Tôi (${conversationInfo.currentUserDisplayName || user?.displayName || 'Bạn'})`}</option>
                  <option value={otherUserId}>{conversationInfo.otherUserDisplayName || displayName}</option>
                </select>
              </>
            )}
            <label className="detail-editor-label" htmlFor="detail-editor-input">
              {editingField === 'nickname' ? 'Biệt danh' : 'Chủ đề'}
            </label>
            <input
              id="detail-editor-input"
              className="detail-editor-input"
              autoFocus
              maxLength={editingField === 'nickname' ? 50 : 255}
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              placeholder={editingField === 'nickname' ? 'Nhập biệt danh' : 'Nhập chủ đề'}
            />
            {editingField === 'topic' && (
              <div className="wallpaper-picker">
                <div className="wallpaper-picker-heading">Hình nền đoạn chat</div>
                <div className="wallpaper-picker-grid">
                  {backgroundImage && !CHAT_WALLPAPERS.some((wallpaper) => backgroundImage === wallpaper.src) && (
                    <div
                      className="wallpaper-option selected"
                      style={{ backgroundImage: `url("${backgroundImage}")` }}
                      role="img"
                      aria-label="Hình nền ảnh của bạn"
                    >
                      <span>Ảnh của bạn</span>
                    </div>
                  )}
                  {CHAT_WALLPAPERS.map((wallpaper) => (
                    <button
                      key={wallpaper.id}
                      type="button"
                      className={`wallpaper-option ${backgroundImage === wallpaper.src ? 'selected' : ''}`}
                      style={{ backgroundImage: `url("${wallpaper.src}")` }}
                      onClick={() => {
                        setWallpaperError('')
                        setBackgroundImage(wallpaper.src)
                      }}
                      aria-label={`Chọn hình nền ${wallpaper.name}`}
                      aria-pressed={backgroundImage === wallpaper.src}
                    >
                      <span>{wallpaper.name}</span>
                    </button>
                  ))}
                </div>
                <div className="wallpaper-picker-actions">
                  <label className="wallpaper-upload-button">
                    {uploadingWallpaper ? 'Đang tải ảnh...' : 'Chọn ảnh từ máy'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleWallpaperUpload}
                      disabled={uploadingWallpaper}
                    />
                  </label>
                  <button
                    type="button"
                    className="wallpaper-reset-button"
                    onClick={() => {
                      setWallpaperError('')
                      setBackgroundImage('')
                    }}
                  >
                    Mặc định
                  </button>
                </div>
                {wallpaperError && (
                  <div className="wallpaper-error" role="alert">{wallpaperError}</div>
                )}
              </div>
            )}
            <p className="detail-editor-hint">
              {editingField === 'nickname'
                ? 'Cả hai người đều sẽ thấy biệt danh này.'
                : 'Chủ đề và hình nền này sẽ chỉ áp dụng cho cuộc trò chuyện đang mở.'}
            </p>
            <div className="detail-editor-actions">
              <button type="button" className="detail-editor-cancel" onClick={() => setEditingField(null)} disabled={savingDetail || uploadingWallpaper}>
                Hủy
              </button>
              <button type="submit" className="detail-editor-save" disabled={savingDetail || uploadingWallpaper}>
                {savingDetail ? 'Đang lưu...' : uploadingWallpaper ? 'Đang tải ảnh...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
