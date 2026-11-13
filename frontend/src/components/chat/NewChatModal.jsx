import React, { useEffect, useState } from "react"
import { Avatar, Button, Loading, Modal } from "../ui"
import { conversationApi } from "../../api/conversationApi"
import { friendApi } from "../../api/friendApi"
import { userApi } from "../../api/userApi"
import { useAuth } from "../../context/AuthContext"
import { friendOf } from "../../utils/format"
import { getApiErrorMessage } from "../../utils/apiError"

export default function NewChatModal({ onClose, onOpen }) {
  const { user } = useAuth()
  const [friends, setFriends] = useState(null)
  const [others, setOthers] = useState([])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState([])
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    friendApi.accepted().then((r) => setFriends((r.data || []).map((req) => friendOf(req, user?.userId)))).catch(() => setFriends([]))
  }, [user?.userId])

  useEffect(() => {
    const q = query.trim()
    if (!q) return setOthers([])
    const timer = setTimeout(() => userApi.search(q).then((r) => setOthers(r.data || [])).catch(() => setOthers([])), 250)
    return () => clearTimeout(timer)
  }, [query])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const friendIds = new Set((friends || []).map((f) => String(f.id)))
  const shownFriends = (friends || []).filter((f) => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase()))
  const strangers = others.filter((p) => String(p.userId) !== String(user?.userId) && !friendIds.has(String(p.userId)))

  const submit = async () => {
    if (!selected.length) return
    setBusy(true)
    setError("")
    try {
      if (selected.length === 1 && !name.trim()) {
        const { data } = await conversationApi.getOrCreatePrivate(selected[0])
        onOpen(data.conversationId)
      } else {
        if (!name.trim()) {
          setError("Vui lòng đặt tên cho nhóm trò chuyện.")
          return
        }
        const { data } = await conversationApi.createGroup({ name: name.trim(), memberIds: selected })
        onOpen(data.conversationId)
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tạo cuộc trò chuyện."))
    } finally {
      setBusy(false)
    }
  }

  const row = (id, label, avatar, hint) => (
    <label key={id} className="pick-row">
      <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
      <Avatar name={label} src={avatar} size="sm" />
      <span>{label}{hint && <small> · {hint}</small>}</span>
    </label>
  )

  return (
    <Modal title="Cuộc trò chuyện mới" close={onClose}>
      <div className="form-grid">
        <label className="full">
          Tên nhóm (chỉ cần khi chọn từ 2 người trở lên)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nhóm đồ án UX" maxLength={100} />
        </label>
        <label className="full">
          Tìm người để thêm
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm bạn bè hoặc người dùng..." />
        </label>
        <div className="full pick-list">
          {friends === null && <Loading />}
          {friends !== null && shownFriends.length === 0 && strangers.length === 0 && <p className="aside-empty">Không có ai phù hợp.</p>}
          {shownFriends.map((f) => row(f.id, f.name, f.avatar, "Bạn bè"))}
          {strangers.map((p) => row(p.userId, p.displayName, p.avatar, "Người dùng"))}
        </div>
        {error && <p className="full" style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button disabled={busy || !selected.length} onClick={submit}>{selected.length > 1 || name.trim() ? "Tạo nhóm" : "Bắt đầu trò chuyện"}</Button>
      </div>
    </Modal>
  )
}
