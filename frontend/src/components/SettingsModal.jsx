import React, { useState, useEffect } from 'react'
import Avatar from './Avatar'
import EmptyState from './EmptyState'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../api/userApi'
import { blockApi } from '../api/blockApi'
import { readThemeMode, saveThemeMode } from '../utils/theme'
import {
  SpeakerIcon,
  SpeakerMuteIcon,
  MoonIcon,
  HeadphoneStatusIcon,
  CreditCardIcon,
  MessageActivityIcon,
  BlockMinusIcon,
  CloseIcon,
} from './Icons'

// Helper to synthesize a subtle Messenger chime
function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch (e) {
    // AudioContext might be restricted until user gesture
  }
}

export default function SettingsModal({ isOpen, onClose }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  // Setting States persisted in localStorage
  const [activeStatus, setActiveStatus] = useState(() => {
    return localStorage.getItem('messenger-active-status') || 'ON'
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('messenger-sound') !== 'false'
  })
  const [doNotDisturb, setDoNotDisturb] = useState(() => {
    return localStorage.getItem('messenger-dnd') === 'true'
  })
  const [themeMode, setThemeMode] = useState(() => {
    return readThemeMode()
  })

  // Sub-view modal states
  const [activeSubView, setActiveSubView] = useState(null) // 'profile' | 'block' | 'payment' | 'activity'

  // Profile edit form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [profileMsg, setProfileMsg] = useState('')

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '')
      setAvatar(user.avatar || '')
      setBio(user.bio || '')
    }
  }, [user])

  useEffect(() => {
    saveThemeMode(themeMode)
  }, [themeMode])

  // Save sound setting
  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('messenger-sound', String(next))
    if (next) playNotificationChime()
  }

  // Save DND
  const toggleDND = () => {
    const next = !doNotDisturb
    setDoNotDisturb(next)
    localStorage.setItem('messenger-dnd', String(next))
  }

  // Toggle active status
  const toggleActiveStatus = () => {
    const next = activeStatus === 'ON' ? 'OFF' : 'ON'
    setActiveStatus(next)
    localStorage.setItem('messenger-active-status', next)
  }

  // Profile save handlers
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    try {
      const { data } = await userApi.updateProfile({ displayName, bio, avatar })
      setUser((prev) => ({ ...prev, displayName: data.displayName, avatar: data.avatar, bio: data.bio }))
      setProfileMsg('Đã cập nhật trang cá nhân thành công!')
      setTimeout(() => setProfileMsg(''), 2500)
    } catch (err) {
      setProfileMsg(err.response?.data?.message || 'Cập nhật thất bại')
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { data } = await userApi.uploadAvatar(file)
      setAvatar(data.url)
      setUser((prev) => ({ ...prev, avatar: data.url }))
    } catch (err) {
      alert('Không thể tải ảnh lên')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    try {
      await userApi.changePassword({ oldPassword, newPassword })
      setProfileMsg('Đã đổi mật khẩu thành công!')
      setOldPassword('')
      setNewPassword('')
      setTimeout(() => setProfileMsg(''), 2500)
    } catch (err) {
      setProfileMsg(err.response?.data?.message || 'Đổi mật khẩu thất bại')
    }
  }

  if (!isOpen) return null

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal-header">
          <h2>Cài đặt</h2>
          <button className="settings-close-btn" onClick={onClose} title="Đóng">
            <CloseIcon size={20} color="#b0b3b8" />
          </button>
        </div>

        {/* Content Body */}
        <div className="settings-modal-body">
          {/* Main settings view */}
          {activeSubView === null && (
            <>
              {/* Section 1: Tài khoản */}
              <div className="settings-section">
                <div className="settings-section-title">Tài khoản</div>

                {/* Profile row */}
                <div
                  className="settings-item profile-item"
                  onClick={() => {
                    onClose()
                    navigate('/feed/profile')
                  }}
                >
                  <div className="settings-item-icon avatar-icon">
                    <Avatar
                      src={user?.avatar}
                      name={user?.displayName || user?.username}
                      size={44}
                    />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">
                      {user?.displayName || user?.username || 'Ng Quang Anh'}
                    </div>
                    <div className="settings-item-desc">Xem trang cá nhân của bạn</div>
                  </div>
                </div>

                {/* Active status row */}
                <div className="settings-item" onClick={toggleActiveStatus}>
                  <div className="settings-item-icon">
                    <HeadphoneStatusIcon size={22} color="#0084ff" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">
                      Trạng thái hoạt động: {activeStatus === 'ON' ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                    </div>
                  </div>
                  <div className="settings-item-right">
                    <span
                      className={`status-pill ${activeStatus === 'ON' ? 'on' : 'off'}`}
                    >
                      {activeStatus === 'ON' ? 'Bật' : 'Tắt'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Thông báo */}
              <div className="settings-section">
                <div className="settings-section-title">Thông báo</div>

                {/* Âm thanh thông báo */}
                <div className="settings-item toggle-row" onClick={toggleSound}>
                  <div className="settings-item-icon">
                    <SpeakerIcon size={22} color="#b0b3b8" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">Âm thanh thông báo</div>
                    <div className="settings-item-desc">
                      Dùng thông báo bằng âm thanh để biết về tin nhắn, cuộc gọi đến, đoạn chat video và âm thanh trong ứng dụng.
                    </div>
                  </div>
                  <div className="settings-item-right">
                    <label className={`messenger-switch ${soundEnabled ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={toggleSound}
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>

                {/* Không làm phiền */}
                <div className="settings-item toggle-row" onClick={toggleDND}>
                  <div className="settings-item-icon">
                    <SpeakerMuteIcon size={22} color="#b0b3b8" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">Không làm phiền</div>
                    <div className="settings-item-desc">
                      Tắt thông báo trong một khoảng thời gian cụ thể.
                    </div>
                  </div>
                  <div className="settings-item-right">
                    <label className={`messenger-switch ${doNotDisturb ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={doNotDisturb}
                        onChange={toggleDND}
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 3: Chế độ tối */}
              <div className="settings-section">
                <div className="settings-item no-hover" style={{ alignItems: 'flex-start', paddingBottom: 4 }}>
                  <div className="settings-item-icon" style={{ marginTop: 2 }}>
                    <MoonIcon size={22} color="#b0b3b8" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">Chế độ tối</div>
                    <div className="settings-item-desc">
                      Điều chỉnh giao diện của CMC Talk để giảm độ chói và cho đôi mắt được nghỉ ngơi.
                    </div>
                  </div>
                </div>

                {/* Radio Options */}
                <div className="theme-radio-group">
                  {/* Tắt (Light mode) */}
                  <label className="theme-radio-item" onClick={() => setThemeMode('light')}>
                    <span className="radio-label">Tắt</span>
                    <span className={`custom-radio ${themeMode === 'light' ? 'selected' : ''}`} />
                  </label>

                  {/* Bật (Dark mode) */}
                  <label className="theme-radio-item" onClick={() => setThemeMode('dark')}>
                    <span className="radio-label">Bật</span>
                    <span className={`custom-radio ${themeMode === 'dark' ? 'selected' : ''}`} />
                  </label>

                  {/* Tự động */}
                  <label className="theme-radio-item" onClick={() => setThemeMode('auto')}>
                    <div className="radio-text-col">
                      <span className="radio-label">Tự động</span>
                      <span className="radio-sub">
                        Chúng tôi sẽ tự động điều chỉnh màn hình theo tùy chọn hệ thống trên thiết bị của bạn.
                      </span>
                    </div>
                    <span className={`custom-radio ${themeMode === 'auto' ? 'selected' : ''}`} />
                  </label>
                </div>

              </div>

              {/* Section 4: Quản lý khác */}
              <div className="settings-section">
                {/* Quản lý khoản thanh toán */}
                <div className="settings-item" onClick={() => setActiveSubView('payment')}>
                  <div className="settings-item-icon">
                    <CreditCardIcon size={22} color="#b0b3b8" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">Quản lý khoản thanh toán</div>
                  </div>
                </div>

                {/* Quản lý hoạt động gửi tin nhắn */}
                <div className="settings-item" onClick={() => setActiveSubView('activity')}>
                  <div className="settings-item-icon">
                    <MessageActivityIcon size={22} color="#b0b3b8" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">Quản lý hoạt động gửi tin nhắn</div>
                  </div>
                </div>

                {/* Quản lý phần Chặn */}
                <div className="settings-item" onClick={() => setActiveSubView('block')}>
                  <div className="settings-item-icon">
                    <BlockMinusIcon size={22} color="#b0b3b8" />
                  </div>
                  <div className="settings-item-content">
                    <div className="settings-item-title">Quản lý phần Chặn</div>
                  </div>
                </div>

              </div>
            </>
          )}

          {/* Sub-view: Trang cá nhân */}
          {activeSubView === 'profile' && (
            <div className="settings-subview">
              <button className="subview-back-btn" onClick={() => setActiveSubView(null)}>
                ← Quay lại Cài đặt
              </button>

              <h3 style={{ margin: '14px 0 16px', fontSize: 18 }}>Trang cá nhân của bạn</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <Avatar src={avatar} name={displayName} size={68} />
                <label className="subview-upload-btn">
                  Đổi ảnh đại diện
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="field">
                  <label>Tên hiển thị</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nhập tên hiển thị"
                    required
                  />
                </div>
                <div className="field">
                  <label>Giới thiệu (Bio)</label>
                  <input
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Viết một chút về bạn..."
                  />
                </div>
                <button className="primary" type="submit" style={{ marginTop: 4 }}>
                  Lưu thay đổi
                </button>
              </form>

              <hr style={{ margin: '22px 0', borderColor: 'var(--border)' }} />

              <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>Đổi mật khẩu</h4>
              <form onSubmit={handleChangePassword}>
                <div className="field">
                  <label>Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>Mật khẩu mới</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <button className="primary" type="submit">
                  Đổi mật khẩu
                </button>
              </form>

              {profileMsg && (
                <p style={{ color: '#22c55e', marginTop: 14, fontSize: 13.5, fontWeight: 500 }}>
                  {profileMsg}
                </p>
              )}
            </div>
          )}

          {/* Sub-view: Quản lý phần Chặn */}
          {activeSubView === 'block' && (
            <div className="settings-subview">
              <button className="subview-back-btn" onClick={() => setActiveSubView(null)}>
                ← Quay lại Cài đặt
              </button>
              <h3 style={{ margin: '14px 0 8px', fontSize: 18 }}>Quản lý phần Chặn</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                Khi bạn chặn ai đó, họ sẽ không thể nhắn tin hoặc gọi điện cho bạn trên CMC Talk.
              </p>
              <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Bạn có thể chặn người dùng trực tiếp từ bảng thông tin trong bất kỳ cuộc trò chuyện cá nhân nào.
                </p>
              </div>
            </div>
          )}

          {/* Sub-view: Quản lý khoản thanh toán */}
          {activeSubView === 'payment' && (
            <div className="settings-subview">
              <button className="subview-back-btn" onClick={() => setActiveSubView(null)}>
                ← Quay lại Cài đặt
              </button>
              <h3 style={{ margin: '14px 0 8px', fontSize: 18 }}>Quản lý khoản thanh toán</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                Xem lịch sử giao dịch và phương thức thanh toán của bạn trên CMC Talk.
              </p>
              <EmptyState
                icon="💳"
                title="Chưa có phương thức thanh toán"
                description="Các khoản thanh toán an toàn và bảo mật thông qua hệ thống CMC Talk."
              />
            </div>
          )}

          {/* Sub-view: Quản lý hoạt động gửi tin nhắn */}
          {activeSubView === 'activity' && (
            <div className="settings-subview">
              <button className="subview-back-btn" onClick={() => setActiveSubView(null)}>
                ← Quay lại Cài đặt
              </button>
              <h3 style={{ margin: '14px 0 8px', fontSize: 18 }}>Quản lý hoạt động gửi tin nhắn</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                Kiểm soát bảo mật và thông tin phiên đăng nhập của bạn.
              </p>
              <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Thiết bị hiện tại</div>
                    <div style={{ fontSize: 12, color: 'var(--online)', marginTop: 2 }}>● Đang hoạt động (Web Browser)</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Windows</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
