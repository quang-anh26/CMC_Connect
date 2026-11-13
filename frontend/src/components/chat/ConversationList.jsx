import React, { useEffect, useState } from "react"
import { Icon } from "../Icon"
import { Avatar, EmptyState, Loading } from "../ui"
import { blockApi } from "../../api/blockApi"
import { conversationApi } from "../../api/conversationApi"
import { useSocket } from "../../context/SocketContext"
import { getApiErrorMessage } from "../../utils/apiError"
import { formatListTime, isMuted, isUnread } from "./chatUtils"

const TABS = [
  ["all", "Tất cả"],
  ["unread", "Chưa đọc"],
  ["group", "Nhóm"],
]
const MORE_TABS = [
  ["strangers", "Tin nhắn từ người lạ"],
  ["archived", "Đã lưu trữ"],
]

export default function ConversationList({ state, archived, activeId, onOpen, onReload, onNew, onClosedActive }) {
  const { startCall } = useSocket()
  const [tab, setTab] = useState("all")
  const [query, setQuery] = useState("")
  const [menu, setMenu] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [, force] = useState(0)

  useEffect(() => {
    const close = () => {
      setMenu(null)
      setMoreOpen(false)
    }
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  const fail = (err, fallback) => window.alert(getApiErrorMessage(err, fallback))
  const archive = async (c, value) => {
    try {
      await conversationApi.setArchived(c.conversationId, value)
      onReload()
      if (value && String(c.conversationId) === String(activeId)) onClosedActive()
    } catch (err) {
      fail(err, "Không thể cập nhật lưu trữ đoạn chat.")
    }
  }
  const markUnread = (c) => {
    localStorage.setItem(`cmctalk-unread-${c.conversationId}`, "true")
    force((n) => n + 1)
  }
  const mute = (c) => {
    const key = `cmctalk-muted-${c.conversationId}`
    if (isMuted(c.conversationId)) localStorage.removeItem(key)
    else localStorage.setItem(key, "true")
    force((n) => n + 1)
  }
  const block = async (c) => {
    if (!c.otherUserId || !window.confirm(`Chặn ${c.name || "người dùng"}?`)) return
    try {
      await blockApi.block(c.otherUserId)
      await archive(c, true)
    } catch (err) {
      fail(err, "Không thể chặn người dùng.")
    }
  }
  const remove = async (c) => {
    if (!window.confirm("Xóa đoạn chat này khỏi danh sách của bạn?")) return
    try {
      await conversationApi.leave(c.conversationId)
      onReload()
      if (String(c.conversationId) === String(activeId)) onClosedActive()
    } catch (err) {
      fail(err, "Không thể xóa đoạn chat.")
    }
  }
  const call = (c, type) => {
    if (c.type !== "PRIVATE" || !c.otherUserUsername) return window.alert("Chỉ có thể gọi trong cuộc trò chuyện cá nhân.")
    startCall(c, type)
  }

  const open = (c) => {
    localStorage.removeItem(`cmctalk-unread-${c.conversationId}`)
    onOpen(c.conversationId)
  }

  const strangers = [...state.list.filter((c) => c.messageRequestPending), ...(state.requests || []).filter((r) => !state.list.some((c) => c.conversationId === r.conversationId))]
  const source = tab === "archived" ? archived : tab === "strangers" ? strangers : state.list
  const q = query.trim().toLowerCase()
  const shown = source.filter((c) => {
    if (q && !(c.name || "").toLowerCase().includes(q) && !(c.lastMessage || "").toLowerCase().includes(q)) return false
    if (tab === "unread") return isUnread(c)
    if (tab === "group") return c.type === "GROUP" && !c.messageRequestPending
    return true
  })
  const unreadTotal = state.list.reduce((s, c) => s + ((c.unreadCount || 0) > 0 ? c.unreadCount : 0), 0)
  const strangerCount = strangers.length

  return (
    <section className="conversation-list">
      <div className="messages-title">
        <div>
          <h1>Tin nhắn</h1>
          <span>{unreadTotal > 0 ? `${unreadTotal} chưa đọc` : "Đã đọc hết"}</span>
        </div>
        <button className="icon-button" aria-label="Tạo cuộc trò chuyện hoặc nhóm mới" title="Tạo cuộc trò chuyện hoặc nhóm mới" onClick={onNew}>
          <Icon name="plus" />
        </button>
      </div>
      <label className="message-search">
        <Icon name="search" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm cuộc trò chuyện" />
      </label>
      <div className="message-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
        <div className="tab-more" onClick={(e) => e.stopPropagation()}>
          <button className={MORE_TABS.some(([k]) => k === tab) ? "active" : ""} onClick={() => setMoreOpen(!moreOpen)}>
            {MORE_TABS.find(([k]) => k === tab)?.[1].replace("Tin nhắn từ ", "") || "Khác"}
            {strangerCount > 0 ? ` (${strangerCount})` : ""}
            <Icon name="chevron" size={12} />
          </button>
          {moreOpen && (
            <div className="pop-menu">
              {MORE_TABS.map(([key, label]) => (
                <button key={key} onClick={() => { setTab(key); setMoreOpen(false) }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="conversations">
        {state.loading && <Loading />}
        {state.error && <p className="aside-empty" style={{ padding: 16 }}>{state.error}</p>}
        {!state.loading && !state.error && shown.length === 0 && (
          <EmptyState
            title={tab === "archived" ? "Chưa lưu trữ đoạn chat nào" : tab === "strangers" ? "Chưa có tin nhắn chờ" : "Chưa có cuộc trò chuyện"}
            copy={tab === "all" ? "Nhấn dấu + để bắt đầu trò chuyện với bạn bè." : tab === "strangers" ? "Tin nhắn từ người chưa kết bạn sẽ xuất hiện ở đây." : "Không có mục nào phù hợp."}
            icon="message"
          />
        )}
        {shown.map((c) => {
          const unread = isUnread(c)
          return (
            <div key={c.conversationId} className={`conversation-item ${String(activeId) === String(c.conversationId) ? "active" : ""}`}>
              <button type="button" className="conversation-main" onClick={() => open(c)}>
                <Avatar name={c.name} src={c.avatar} online={c.type === "PRIVATE" ? Boolean(c.otherUserOnline) : undefined} />
                <span className="conversation-copy">
                  <strong>{c.name}</strong>
                  <small className={unread ? "unread-text" : ""}>
                    {c.messageRequestPending ? "Tin nhắn đang chờ · " : ""}
                    {c.lastMessage || "Chưa có tin nhắn"}
                  </small>
                </span>
                <span className="conversation-meta">
                  <small>{formatListTime(c.lastMessageAt)}</small>
                  {(c.unreadCount > 0 || unread) && <em>{c.unreadCount > 0 ? c.unreadCount : ""}</em>}
                  {isMuted(c.conversationId) && <Icon name="bell" size={12} />}
                </span>
              </button>
              <button
                type="button"
                className="conversation-more"
                aria-label="Tùy chọn đoạn chat"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenu(menu === c.conversationId ? null : c.conversationId)
                }}
              >
                <Icon name="more" size={18} />
              </button>
              {menu === c.conversationId && (
                <div className="pop-menu conversation-menu" onClick={(e) => e.stopPropagation()}>
                  {tab !== "archived" && <button onClick={() => { markUnread(c); setMenu(null) }}>Đánh dấu là chưa đọc</button>}
                  <button onClick={() => { mute(c); setMenu(null) }}>{isMuted(c.conversationId) ? "Bật thông báo" : "Tắt thông báo"}</button>
                  <button onClick={() => { archive(c, tab !== "archived"); setMenu(null) }}>{tab === "archived" ? "Bỏ lưu trữ" : "Lưu trữ đoạn chat"}</button>
                  {c.type === "PRIVATE" && <button onClick={() => { call(c, "audio"); setMenu(null) }}>Gọi thoại</button>}
                  {c.type === "PRIVATE" && <button onClick={() => { call(c, "video"); setMenu(null) }}>Chat video</button>}
                  {c.type === "PRIVATE" && <button onClick={() => { block(c); setMenu(null) }}>Chặn</button>}
                  <button className="danger" onClick={() => { remove(c); setMenu(null) }}>{c.type === "GROUP" ? "Rời nhóm" : "Xóa đoạn chat"}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
