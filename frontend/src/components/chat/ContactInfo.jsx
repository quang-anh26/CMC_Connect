import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../Icon"
import { Avatar, Modal } from "../ui"
import { blockApi } from "../../api/blockApi"
import { conversationApi } from "../../api/conversationApi"
import { messageApi } from "../../api/messageApi"
import { useAuth } from "../../context/AuthContext"
import { mediaUrl } from "../../utils/format"
import { getApiErrorMessage } from "../../utils/apiError"
import { CHAT_WALLPAPERS, formatLastSeen, isImageMessage } from "./chatUtils"

function DetailEditor({ field, conversation, otherUserId, onClose, onSaved }) {
  const { user } = useAuth()
  const [target, setTarget] = useState(otherUserId)
  const [value, setValue] = useState(field === "nickname" ? conversation.otherUserNickname || "" : conversation.topic || "")
  const [background, setBackground] = useState(conversation.backgroundImage || "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) return setError("Vui lòng chọn một tệp hình ảnh.")
    if (file.size > 10 * 1024 * 1024) return setError("Ảnh không được vượt quá 10 MB.")
    setUploading(true)
    setError("")
    try {
      const { data } = await messageApi.upload(file)
      setBackground(data.url)
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tải ảnh lên."))
    } finally {
      setUploading(false)
    }
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = field === "nickname" ? { targetUserId: Number(target), nickname: value } : { topic: value, backgroundImage: background }
    try {
      const { data } = await conversationApi.updateDetails(conversation.conversationId, payload)
      onSaved(data)
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể cập nhật thông tin cuộc trò chuyện."))
    } finally {
      setSaving(false)
    }
  }

  const customBackground = background && !CHAT_WALLPAPERS.some((w) => w.src === background)
  return (
    <Modal title={field === "nickname" ? "Đổi biệt danh" : "Chủ đề và hình nền"} close={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          {field === "nickname" && (
            <label className="full">
              Đổi biệt danh cho
              <select
                value={target || ""}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  setTarget(id)
                  setValue(id === Number(user?.userId) ? conversation.currentUserNickname || "" : conversation.otherUserNickname || "")
                }}
              >
                <option value={user?.userId}>{`Tôi (${conversation.currentUserDisplayName || user?.displayName || "Bạn"})`}</option>
                <option value={otherUserId}>{conversation.otherUserDisplayName || conversation.name}</option>
              </select>
            </label>
          )}
          <label className="full">
            {field === "nickname" ? "Biệt danh" : "Chủ đề"}
            <input autoFocus maxLength={field === "nickname" ? 50 : 255} value={value} onChange={(e) => setValue(e.target.value)} placeholder={field === "nickname" ? "Nhập biệt danh" : "Nhập chủ đề"} />
          </label>
          {field === "topic" && (
            <div className="full wallpaper-picker">
              <strong>Hình nền đoạn chat</strong>
              <div className="wallpaper-grid">
                <button type="button" className={!background ? "selected" : ""} onClick={() => setBackground("")}>
                  <span className="wp-none">Mặc định</span>
                </button>
                {CHAT_WALLPAPERS.map((w) => (
                  <button type="button" key={w.id} className={background === w.src ? "selected" : ""} onClick={() => setBackground(w.src)} title={w.name}>
                    <img src={w.src} alt={w.name} />
                    <small>{w.name}</small>
                  </button>
                ))}
                {customBackground && (
                  <button type="button" className="selected" title="Ảnh của bạn">
                    <img src={mediaUrl(background)} alt="Ảnh của bạn" />
                    <small>Ảnh của bạn</small>
                  </button>
                )}
              </div>
              <label className="upload-wallpaper">
                <Icon name="image" size={16} />
                {uploading ? "Đang tải ảnh..." : "Tải ảnh nền từ máy"}
                <input type="file" accept="image/*" hidden onChange={upload} disabled={uploading} />
              </label>
            </div>
          )}
          {error && <p className="full" style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}><span>Hủy</span></button>
          <button className="button button-primary" disabled={saving || uploading}><span>{saving ? "Đang lưu..." : "Lưu"}</span></button>
        </div>
      </form>
    </Modal>
  )
}

export default function ContactInfo({ conversation, messages, onClose, onUpdated, onJump, onOpenImage, onArchived, onLeft }) {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [muted, setMuted] = useState(() => localStorage.getItem(`cmctalk-muted-${conversation.conversationId}`) === "true")
  const [busy, setBusy] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(t)
  }, [])

  const isGroup = conversation.type === "GROUP"
  const otherUserId = conversation.otherUserId
  const blocked = Boolean(conversation.blockedByCurrentUser)
  const online = !isGroup && conversation.otherUserOnline
  const live = (messages || []).filter((m) => !m.deleted)
  const images = live.filter(isImageMessage).map((m) => m.content).reverse()
  const files = live.filter((m) => m.messageType === "FILE")
  const preview = images.slice(0, 4)
  const remaining = images.length > 4 ? images.length - 3 : 0

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return live
      .filter((m) => m.messageType !== "SYSTEM" && String(m.content || "").toLowerCase().includes(term))
      .slice(-8)
      .reverse()
  }, [live, query])

  const toggleMute = () => {
    const key = `cmctalk-muted-${conversation.conversationId}`
    if (muted) localStorage.removeItem(key)
    else localStorage.setItem(key, "true")
    setMuted(!muted)
  }

  const toggleBlock = async () => {
    if (!otherUserId || busy) return
    if (!blocked && !window.confirm(`Chặn người dùng ${conversation.name}? Họ sẽ không thể nhắn tin cho bạn.`)) return
    setBusy(true)
    try {
      if (blocked) await blockApi.unblock(otherUserId)
      else await blockApi.block(otherUserId)
      onUpdated({ blockedByCurrentUser: !blocked })
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể thực hiện thao tác."))
    } finally {
      setBusy(false)
    }
  }

  const archive = async () => {
    try {
      await conversationApi.setArchived(conversation.conversationId, true)
      onArchived?.()
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể lưu trữ đoạn chat."))
    }
  }

  const leave = async () => {
    if (!window.confirm(isGroup ? "Rời khỏi nhóm này?" : "Xóa đoạn chat này khỏi danh sách của bạn?")) return
    try {
      await conversationApi.leave(conversation.conversationId)
      onLeft?.()
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể thực hiện thao tác."))
    }
  }

  return (
    <aside className="contact-info" id="chat-contact-info">
      <button className="close-info" onClick={onClose} aria-label="Đóng thông tin"><Icon name="close" size={18} /></button>
      <Avatar name={conversation.name} src={conversation.avatar} size="xl" />
      <h3>{conversation.name}</h3>
      <span className="info-status">
        <i className={isGroup || online ? "on" : ""} />
        {isGroup ? "Nhóm chat" : online ? "Đang hoạt động" : `Hoạt động · ${formatLastSeen(conversation.otherUserLastSeenAt, now)}`}
      </span>

      <div className="info-meta-cards">
        {!isGroup && (
          <button type="button" onClick={() => setEditing("nickname")}>
            <Icon name="users" size={18} />
            <small>Biệt danh</small>
            <strong>{conversation.otherUserNickname || "Đặt biệt danh"}</strong>
          </button>
        )}
        <button type="button" onClick={() => setEditing("topic")}>
          <Icon name="image" size={18} />
          <small>Chủ đề & hình nền</small>
          <strong>{conversation.topic || "Thêm chủ đề"}</strong>
        </button>
      </div>

      <div className="contact-actions">
        {!isGroup && otherUserId && (
          <button onClick={() => navigate(`/profile/${otherUserId}`)}>
            <Icon name="users" />
            <small>Trang cá nhân</small>
          </button>
        )}
        <button onClick={() => setSearchOpen(!searchOpen)}>
          <Icon name="search" />
          <small>Tìm kiếm</small>
        </button>
        <button onClick={toggleMute}>
          <Icon name="bell" />
          <small>{muted ? "Bật thông báo" : "Tắt thông báo"}</small>
        </button>
      </div>

      {searchOpen && (
        <div className="conversation-search">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nhập chữ để tìm trong đoạn chat..." />
          {query.trim() && matches.length === 0 && <p className="aside-empty">Không tìm thấy tin nhắn phù hợp.</p>}
          {matches.map((m) => (
            <button key={m.messageId} type="button" onClick={() => onJump?.(m.messageId)}>
              <strong>{m.senderDisplayName || "Bạn"}</strong>
              <span>{String(m.content).replace(/\s+/g, " ").slice(0, 90)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="info-list">
        <div className="info-section-title">Ảnh và video ({images.length})</div>
        {preview.length > 0 ? (
          <div className="info-media">
            {preview.map((url, i) => (
              <button type="button" key={i} onClick={() => onOpenImage?.(url)}>
                <img src={mediaUrl(url)} alt={`Ảnh ${i + 1}`} />
                {i === 3 && remaining > 0 && <span className="more">+{remaining}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="aside-empty">Chưa có ảnh nào được gửi.</p>
        )}
        <button type="button" onClick={() => setFilesOpen(!filesOpen)}>
          Tệp đã chia sẻ ({files.length}) <Icon name="chevron" />
        </button>
        {filesOpen && (
          <div className="info-files">
            {files.length === 0 && <p className="aside-empty">Chưa có tệp nào.</p>}
            {files.map((m) => (
              <a key={m.messageId} href={mediaUrl(m.content)} target="_blank" rel="noreferrer" download>
                <Icon name="file" size={16} /> {m.attachments?.[0]?.fileName || "Tệp đính kèm"}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="info-actions-bottom">
        <button type="button" onClick={archive}><Icon name="bookmark" size={16} />Lưu trữ đoạn chat</button>
        {!isGroup && otherUserId && (
          <button type="button" disabled={busy} onClick={toggleBlock}><Icon name="lock" size={16} />{blocked ? "Bỏ chặn người dùng" : "Chặn người dùng"}</button>
        )}
        <button type="button" className="danger" onClick={leave}><Icon name="trash" size={16} />{isGroup ? "Rời nhóm" : "Xóa đoạn chat"}</button>
      </div>

      {editing && (
        <DetailEditor
          field={editing}
          conversation={conversation}
          otherUserId={otherUserId}
          onClose={() => setEditing(null)}
          onSaved={(data) => {
            onUpdated(data)
            setEditing(null)
            window.dispatchEvent(new Event("cmctalk-conversations-updated"))
          }}
        />
      )}
    </aside>
  )
}
