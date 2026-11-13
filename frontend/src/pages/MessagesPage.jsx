import React, { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { EmptyState } from "../components/ui"
import CallOverlay from "../components/CallOverlay"
import ChatPanel from "../components/chat/ChatPanel"
import ContactInfo from "../components/chat/ContactInfo"
import ConversationList from "../components/chat/ConversationList"
import NewChatModal from "../components/chat/NewChatModal"
import { Icon } from "../components/Icon"
import { conversationApi } from "../api/conversationApi"
import { useSocket } from "../context/SocketContext"
import { mediaUrl } from "../utils/format"

export default function MessagesPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { callRequest, clearCallRequest } = useSocket()
  const [info, setInfo] = useState(true)
  const [creating, setCreating] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [state, setState] = useState({ list: [], requests: [], loading: true, error: "" })
  const [archived, setArchived] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const chatRef = useRef(null)

  const load = useCallback(() => {
    Promise.all([conversationApi.list(), conversationApi.requests().catch(() => ({ data: [] }))])
      .then(([list, requests]) => setState({ list: list.data || [], requests: requests.data || [], loading: false, error: "" }))
      .catch(() => setState((s) => ({ ...s, loading: false, error: "Không tải được danh sách trò chuyện." })))
    conversationApi.archived().then((res) => setArchived(res.data || [])).catch(() => setArchived([]))
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 10000)
    window.addEventListener("cmctalk-conversations-updated", load)
    return () => {
      clearInterval(timer)
      window.removeEventListener("cmctalk-conversations-updated", load)
    }
  }, [load])

  // Thông tin cuộc trò chuyện đang mở: lấy từ danh sách, được cập nhật cục bộ khi đổi biệt danh/hình nền/chặn.
  useEffect(() => {
    if (!conversationId) return setSelected(null)
    const found = [...state.list, ...(state.requests || []), ...archived].find((c) => String(c.conversationId) === String(conversationId))
    if (found) setSelected((cur) => (cur && String(cur.conversationId) === String(conversationId) ? { ...found, ...patchedKeys(cur, found) } : found))
  }, [conversationId, state.list, state.requests, archived])

  const patchSelected = useCallback((valueOrFn) => {
    setSelected((cur) => (typeof valueOrFn === "function" ? valueOrFn(cur) : cur ? { ...cur, ...valueOrFn } : valueOrFn))
  }, [])

  const openConversation = (id) => {
    setCreating(false)
    load()
    navigate(`/messages/${id}`)
  }

  return (
    <div className={`messages-layout ${conversationId && info ? "with-info" : ""} ${conversationId ? "has-chat" : ""}`}>
      <ConversationList
        state={state}
        archived={archived}
        activeId={conversationId}
        onOpen={openConversation}
        onReload={load}
        onNew={() => setCreating(true)}
        onClosedActive={() => navigate("/messages")}
      />
      {conversationId ? (
        <ChatPanel
          key={conversationId}
          conversationId={conversationId}
          conversation={selected}
          onConversationChange={patchSelected}
          infoOpen={info}
          onToggleInfo={() => setInfo((v) => !v)}
          onBack={() => navigate("/messages")}
          onOpenImage={setLightbox}
          messagesRef={chatRef}
          onMessages={setMessages}
        />
      ) : (
        <section className="chat-panel chat-empty">
          <EmptyState title="Chọn một cuộc trò chuyện" copy="Chọn bạn bè ở danh sách bên trái hoặc bắt đầu cuộc trò chuyện mới." icon="message" />
        </section>
      )}
      {conversationId && info && selected && (
        <ContactInfo
          key={conversationId}
          conversation={selected}
          messages={messages}
          onClose={() => setInfo(false)}
          onUpdated={patchSelected}
          onJump={(id) => chatRef.current?.jump(id)}
          onOpenImage={setLightbox}
          onArchived={() => { load(); navigate("/messages") }}
          onLeft={() => { load(); navigate("/messages") }}
        />
      )}
      {creating && <NewChatModal onClose={() => setCreating(false)} onOpen={openConversation} />}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" aria-label="Đóng" onClick={() => setLightbox(null)}><Icon name="close" size={22} /></button>
          <img src={mediaUrl(lightbox)} alt="Ảnh phóng to" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <CallOverlay conversationInfo={callRequest} visible={Boolean(callRequest)} onClose={clearCallRequest} />
    </div>
  )
}

// Giữ lại các thay đổi cục bộ mới hơn dữ liệu danh sách (vd. vừa đổi biệt danh/hình nền).
function patchedKeys(current, fresh) {
  const keep = {}
  ;["topic", "backgroundImage", "otherUserNickname", "currentUserNickname", "blockedByCurrentUser"].forEach((k) => {
    if (current[k] !== undefined && fresh[k] === undefined) keep[k] = current[k]
  })
  return keep
}
