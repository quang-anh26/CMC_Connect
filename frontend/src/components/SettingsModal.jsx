import React, { useRef, useState } from "react"
import { Avatar, Button, Modal } from "./ui"
import { Icon } from "./Icon"
import { userApi } from "../api/userApi"
import { useAuth } from "../context/AuthContext"
import { readThemeMode, saveThemeMode } from "../utils/theme"
import { getApiErrorMessage } from "../utils/apiError"

const flag = (key, fallback) => {
  const v = localStorage.getItem(key)
  return v === null ? fallback : v
}

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export default function SettingsModal({ me, onClose, onSaved }) {
  const { user, setUser } = useAuth()
  const avatarRef = useRef(null)
  const [tab, setTab] = useState("general")
  const [theme, setTheme] = useState(readThemeMode())
  const [activeStatus, setActiveStatus] = useState(flag("messenger-active-status", "ON") !== "OFF")
  const [sound, setSound] = useState(flag("messenger-sound", "true") !== "false")
  const [dnd, setDnd] = useState(flag("messenger-dnd", "false") === "true")
  const [profile, setProfile] = useState({ displayName: me?.displayName || "", bio: me?.bio || "", education: me?.education || "", location: me?.location || "" })
  const [avatar, setAvatar] = useState(me?.avatar || "")
  const [passwords, setPasswords] = useState({ oldPassword: "", newPassword: "", confirm: "" })
  const [message, setMessage] = useState({ text: "", error: false })
  const [busy, setBusy] = useState(false)
  const note = (text, error = false) => setMessage({ text, error })

  const changeTheme = (mode) => {
    saveThemeMode(mode)
    setTheme(mode)
  }
  const toggleActive = (on) => {
    localStorage.setItem("messenger-active-status", on ? "ON" : "OFF")
    setActiveStatus(on)
    window.dispatchEvent(new Event("cmctalk-active-status-changed"))
  }
  const toggleSound = (on) => {
    localStorage.setItem("messenger-sound", String(on))
    setSound(on)
  }
  const toggleDnd = (on) => {
    localStorage.setItem("messenger-dnd", String(on))
    setDnd(on)
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await userApi.updateProfile({ ...profile, avatar })
      setUser?.((u) => (u ? { ...u, displayName: data.displayName } : u))
      note("Đã cập nhật trang cá nhân thành công!")
      onSaved?.()
    } catch (err) {
      note(getApiErrorMessage(err, "Cập nhật thất bại."), true)
    } finally {
      setBusy(false)
    }
  }

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const { data } = await userApi.uploadAvatar(file)
      setAvatar(data.avatar || data.url || avatar)
      note("Đã cập nhật ảnh đại diện.")
      onSaved?.()
    } catch (err) {
      note(getApiErrorMessage(err, "Không thể tải ảnh lên."), true)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (passwords.newPassword.length < 6) return note("Mật khẩu mới phải có ít nhất 6 ký tự.", true)
    if (passwords.newPassword !== passwords.confirm) return note("Mật khẩu xác nhận không khớp.", true)
    setBusy(true)
    try {
      await userApi.changePassword({ oldPassword: passwords.oldPassword, newPassword: passwords.newPassword })
      setPasswords({ oldPassword: "", newPassword: "", confirm: "" })
      note("Đã đổi mật khẩu thành công!")
    } catch (err) {
      note(getApiErrorMessage(err, "Đổi mật khẩu thất bại."), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Cài đặt" close={onClose} wide>
      <div className="settings-layout">
        <nav className="settings-tabs">
          {[["general", "Chung", "settings"], ["profile", "Trang cá nhân", "users"], ["password", "Mật khẩu", "lock"]].map(([key, label, icon]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); note("") }}>
              <Icon name={icon} size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {message.text && <p className={`settings-note ${message.error ? "error" : ""}`}>{message.text}</p>}
          {tab === "general" && (
            <>
              <h3>Giao diện</h3>
              <div className="theme-options">
                {[["light", "Sáng", "sun"], ["dark", "Tối", "moon"], ["auto", "Tự động theo hệ thống", "settings"]].map(([mode, label, icon]) => (
                  <button key={mode} type="button" className={theme === mode ? "selected" : ""} onClick={() => changeTheme(mode)}>
                    <Icon name={icon} size={18} />
                    {label}
                  </button>
                ))}
              </div>
              <h3>Hoạt động & thông báo</h3>
              <Switch checked={activeStatus} onChange={toggleActive} label="Trạng thái hoạt động" hint={activeStatus ? "Bạn bè thấy khi bạn đang trực tuyến." : "Bạn sẽ hiển thị ngoại tuyến với mọi người."} />
              <Switch checked={sound} onChange={toggleSound} label="Âm thanh thông báo" hint="Phát âm thanh khi có tin nhắn hoặc cuộc gọi." />
              <Switch checked={dnd} onChange={toggleDnd} label="Không làm phiền" hint="Tạm tắt thông báo trên thiết bị này." />
            </>
          )}
          {tab === "profile" && (
            <form onSubmit={saveProfile}>
              <div className="settings-avatar">
                <Avatar name={profile.displayName || user?.username} src={avatar} size="xl" />
                <input ref={avatarRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
                <Button variant="secondary" icon="image" onClick={() => avatarRef.current?.click()}>Đổi ảnh đại diện</Button>
              </div>
              <div className="form-grid">
                <label className="full">Tên hiển thị<input value={profile.displayName} maxLength={100} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} placeholder="Nhập tên hiển thị" /></label>
                <label className="full">Giới thiệu (Bio)<textarea rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Viết một chút về bạn..." /></label>
                <label>Học tập<input value={profile.education} onChange={(e) => setProfile({ ...profile, education: e.target.value })} /></label>
                <label>Nơi sống<input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></label>
              </div>
              <div className="modal-actions"><Button type="submit" disabled={busy || !profile.displayName.trim()}>Lưu thay đổi</Button></div>
            </form>
          )}
          {tab === "password" && (
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <label className="full">Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={passwords.oldPassword} onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })} /></label>
                <label className="full">Mật khẩu mới<input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></label>
                <label className="full">Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></label>
              </div>
              <div className="modal-actions"><Button type="submit" disabled={busy || !passwords.oldPassword || !passwords.newPassword}>Đổi mật khẩu</Button></div>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}
