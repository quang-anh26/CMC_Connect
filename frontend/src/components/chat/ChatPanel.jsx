import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "../Icon"
import { Avatar, Loading } from "../ui"
import { messageApi } from "../../api/messageApi"
import { conversationApi } from "../../api/conversationApi"
import { blockApi } from "../../api/blockApi"
import { useAuth } from "../../context/AuthContext"
import { useSocket } from "../../context/SocketContext"
import { clockTime, dayLabel, formatBytes, mediaUrl } from "../../utils/format"
import { getApiErrorMessage } from "../../utils/apiError"
import { QUICK_EMOJIS, formatLastSeen, isImageMessage, scrollToBottom } from "./chatUtils"

export default function ChatPanel({ conversationId, conversation, onConversationChange, infoOpen, onToggleInfo, onBack, onOpenImage, messagesRef, onMessages }) {
  const { user } = useAuth()
  const { subscribe, publish, connected, startCall } = useSocket()
  const [messages, setMessages] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [replyTo, setReplyTo] = useState(null)
  const [typingUsers, setTypingUsers] = useState({})
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [reactionFor, setReactionFor] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editDraft, setEditDraft] = useState("")
  const [unblocking, setUnblocking] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const historyRef = useRef(null)
  const typingTimer = useRef(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)
  const messageRefs = useRef({})
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const sendOnStopRef = useRef(false)
  const replyRef = useRef(null)
  replyRef.current = replyTo

  const myId = user?.userId
  const cannotMessage = conversation?.type === "PRIVATE" && (conversation.blockedByCurrentUser === true || conversation.blockedByOther === true)
  const isGroup = conversation?.type === "GROUP"
  const online = !isGroup && conversation?.otherUserOnline

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    sendOnStopRef.current = false
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [conversationId])

  // Chia sẻ danh sách tin nhắn cho panel thông tin (tìm kiếm, ảnh, tệp, nhảy tới tin).
  useEffect(() => {
    onMessages?.(messages)
  }, [messages, onMessages])
  useEffect(() => {
    if (!messagesRef) return
    messagesRef.current = {
      jump: (messageId) => {
        const target = messageRefs.current[messageId]
        if (!target) return
        target.scrollIntoView({ behavior: "smooth", block: "center" })
        target.classList.add("message-highlight")
        window.setTimeout(() => target.classList.remove("message-highlight"), 1400)
      },
    }
  }, [messagesRef])

  useEffect(() => {
    setMessages([])
    setPage(0)
    setHasMore(false)
    setLoading(true)
    setReplyTo(null)
    setEditing(null)
    setTypingUsers({})
    messageApi
      .history(conversationId, 0)
      .then((res) => {
        const list = res.data || []
        setMessages(list)
        setHasMore(list.length === 20)
      })
      .catch(() => setMessages([]))
      .finally(() => {
        setLoading(false)
        window.setTimeout(() => scrollToBottom(historyRef.current), 50)
      })
  }, [conversationId])

  const loadMore = () => {
    const container = historyRef.current
    const prevHeight = container?.scrollHeight || 0
    const next = page + 1
    messageApi.history(conversationId, next).then((res) => {
      const older = res.data || []
      setMessages((prev) => [...older, ...prev])
      setHasMore(older.length === 20)
      setPage(next)
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight
      })
    })
  }

  const refreshConversation = useCallback(() => {
    conversationApi
      .list()
      .then((res) => {
        const found = (res.data || []).find((c) => String(c.conversationId) === String(conversationId))
        if (found) onConversationChange?.(found)
      })
      .catch(() => {})
  }, [conversationId, onConversationChange])

  useEffect(() => {
    if (!connected || !conversationId) return undefined
    const offs = [
      subscribe(`/topic/conversation/${conversationId}`, (incoming) => {
        window.dispatchEvent(new Event("cmctalk-conversations-updated"))
        onConversationChange?.((current) => (current ? { ...current, newFriend: false } : current))
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.messageId === incoming.messageId)
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = incoming
            return copy
          }
          return [...prev, incoming]
        })
        if (String(incoming.senderId) !== String(myId)) publish("/app/chat.seen", { conversationId: Number(conversationId) })
        window.setTimeout(() => scrollToBottom(historyRef.current, true), 50)
      }),
      subscribe(`/topic/conversation/${conversationId}/typing`, (event) => {
        if (String(event.userId) === String(myId)) return
        setTypingUsers((prev) => {
          const copy = { ...prev }
          if (event.typing) copy[event.userId] = event.username
          else delete copy[event.userId]
          return copy
        })
      }),
      subscribe(`/topic/conversation/${conversationId}/seen`, () => {
        setMessages((prev) => prev.map((m) => (String(m.senderId) === String(myId) ? { ...m, deliveryStatus: "SEEN" } : m)))
      }),
      subscribe(`/topic/conversation/${conversationId}/reactions`, (update) => {
        setMessages((cur) => cur.map((m) => (String(m.messageId) === String(update.messageId) ? { ...m, reactions: update.reactions || [] } : m)))
      }),
      subscribe("/topic/presence", refreshConversation),
      subscribe(`/topic/conversation/${conversationId}/details`, refreshConversation),
    ]
    publish("/app/chat.seen", { conversationId: Number(conversationId) })
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, conversationId, myId])

  const stopTyping = () => connected && publish("/app/chat.typing", { conversationId: Number(conversationId), typing: false })
  const onType = (value) => {
    setText(value)
    if (!connected) return
    publish("/app/chat.typing", { conversationId: Number(conversationId), typing: true })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(stopTyping, 2000)
  }

  const requireConnection = () => {
    if (connected) return true
    window.alert("Kết nối thời gian thực đang bị gián đoạn. Vui lòng đợi vài giây hoặc tải lại trang.")
    return false
  }

  const send = (event) => {
    event?.preventDefault()
    if (!text.trim() || cannotMessage || !requireConnection()) return
    publish("/app/chat.send", {
      conversationId: Number(conversationId),
      content: text.trim(),
      messageType: "TEXT",
      replyToMessageId: replyTo?.messageId || null,
    })
    setText("")
    setReplyTo(null)
    setEmojiOpen(false)
    stopTyping()
  }

  const sendUpload = async (file, type) => {
    const { data } = await messageApi.upload(file)
    publish("/app/chat.send", {
      conversationId: Number(conversationId),
      content: data.url,
      messageType: type,
      replyToMessageId: replyRef.current?.messageId || null,
    })
    setReplyTo(null)
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || cannotMessage || !requireConnection()) return
    setUploading(true)
    try {
      await sendUpload(file, file.type.startsWith("image/") ? "IMAGE" : "FILE")
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể tải tệp lên."))
    } finally {
      setUploading(false)
    }
  }

  const toggleRecording = async () => {
    if (cannotMessage) return
    if (recording) {
      sendOnStopRef.current = true
      recorderRef.current?.stop()
      return
    }
    if (!requireConnection()) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      window.alert("Trình duyệt này không hỗ trợ ghi âm. Hãy dùng trình duyệt mới hơn và kết nối qua HTTPS hoặc localhost.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        const shouldSend = sendOnStopRef.current
        sendOnStopRef.current = false
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        chunksRef.current = []
        if (!shouldSend || !blob.size) return
        setUploading(true)
        try {
          const ext = blob.type.includes("mp4") ? "m4a" : "webm"
          await sendUpload(new File([blob], `voice-message.${ext}`, { type: blob.type }), "AUDIO")
        } catch (err) {
          window.alert(getApiErrorMessage(err, "Không thể gửi tin nhắn thoại."))
        } finally {
          setUploading(false)
        }
      }
      recorderRef.current = recorder
      sendOnStopRef.current = false
      recorder.start()
      setRecording(true)
    } catch (err) {
      window.alert(err.name === "NotAllowedError" ? "Bạn chưa cấp quyền sử dụng microphone. Hãy cho phép trong cài đặt trình duyệt." : "Không thể truy cập microphone. Vui lòng kiểm tra thiết bị và quyền trình duyệt.")
    }
  }

  const react = async (messageId, emoji) => {
    try {
      const { data } = await messageApi.react(messageId, Number(conversationId), emoji)
      setMessages((cur) => cur.map((m) => (String(m.messageId) === String(data.messageId) ? { ...m, reactions: data.reactions || [] } : m)))
      setReactionFor(null)
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể thả cảm xúc."))
    }
  }

  const saveEdit = async (messageId) => {
    const content = editDraft.trim()
    if (!content) return window.alert("Nội dung tin nhắn không được để trống.")
    try {
      const { data } = await messageApi.edit(messageId, content)
      setMessages((cur) => cur.map((m) => (String(m.messageId) === String(messageId) ? { ...m, content: data.content, editedAt: data.createdAt } : m)))
      if (connected) publish("/app/chat.edit", { messageId, conversationId: Number(conversationId), content })
      setEditing(null)
      setEditDraft("")
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể chỉnh sửa tin nhắn."))
    }
  }

  const recall = (messageId) => {
    if (!window.confirm("Thu hồi tin nhắn này?")) return
    if (requireConnection()) publish("/app/chat.recall", { conversationId: Number(conversationId), messageId })
  }

  const unblock = async () => {
    if (!conversation?.otherUserId || unblocking) return
    setUnblocking(true)
    try {
      await blockApi.unblock(conversation.otherUserId)
      onConversationChange?.((c) => (c ? { ...c, blockedByCurrentUser: false } : c))
    } catch (err) {
      window.alert(getApiErrorMessage(err, "Không thể bỏ chặn người dùng."))
    } finally {
      setUnblocking(false)
    }
  }

  const rows = useMemo(() => {
    let lastDay = ""
    return messages.map((m) => {
      const label = dayLabel(m.createdAt)
      const showDay = label !== lastDay
      lastDay = label
      return { m, showDay: showDay ? `${label}, ${clockTime(m.createdAt)}` : "" }
    })
  }, [messages])
  const lastMine = [...messages].reverse().find((m) => String(m.senderId) === String(myId) && !m.deleted)
  const typingNames = Object.values(typingUsers)
  const wallpaper = conversation?.backgroundImage
  const historyStyle = wallpaper
    ? {
        backgroundImage: `linear-gradient(rgba(8, 14, 22, 0.28), rgba(8, 14, 22, 0.28)), url("${mediaUrl(wallpaper)}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }
    : undefined

  return (
    <section className="chat-panel">
      <header className="chat-head">
        <div>
          <button className="icon-button chat-back" aria-label="Quay lại danh sách" onClick={onBack}>
            <Icon name="chevron" size={18} />
          </button>
          <button type="button" className="chat-head-who" onClick={onToggleInfo} title="Thông tin cuộc trò chuyện">
            <Avatar name={conversation?.name} src={conversation?.avatar} online={isGroup ? undefined : Boolean(online)} />
            <span>
              <strong>{conversation?.name || "Cuộc trò chuyện"}</strong>
              <small className={online ? "" : "offline"}>
                {isGroup ? "Nhóm chat" : online ? (<><i />Đang hoạt động</>) : `Hoạt động · ${formatLastSeen(conversation?.otherUserLastSeenAt, now)}`}
              </small>
            </span>
          </button>
        </div>
        <div>
          <button className="icon-button" title="Gọi thoại" disabled={isGroup || cannotMessage || !conversation} onClick={() => startCall(conversation, "audio")}>
            <Icon name="phone" />
          </button>
          <button className="icon-button" title="Gọi video" disabled={isGroup || cannotMessage || !conversation} onClick={() => startCall(conversation, "video")}>
            <Icon name="video" />
          </button>
          <button className={`icon-button ${infoOpen ? "on" : ""}`} title="Thông tin cuộc trò chuyện" aria-expanded={infoOpen} onClick={onToggleInfo}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <div className={`chat-history ${wallpaper ? "has-wallpaper" : ""}`} ref={historyRef} style={historyStyle}>
        {hasMore && !loading && (
          <button className="load-more" onClick={loadMore}>
            Tải thêm tin nhắn cũ hơn
          </button>
        )}
        {loading && <Loading label="Đang tải tin nhắn..." />}
        {!loading && messages.length === 0 && <div className="chat-day">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên! 👋</div>}
        {rows.map(({ m, showDay }) => {
          if (m.messageType === "SYSTEM") {
            return (
              <div key={m.messageId} className="chat-day system-row">
                {m.content}
              </div>
            )
          }
          const mine = String(m.senderId) === String(myId)
          const img = isImageMessage(m) && !m.deleted
          const reactions = m.reactions || []
          return (
            <React.Fragment key={m.messageId}>
              {showDay && <div className="chat-day">{showDay}</div>}
              <div
                className={`bubble-row ${mine ? "outgoing" : "incoming"}`}
                ref={(el) => {
                  if (el) messageRefs.current[m.messageId] = el
                }}
              >
                {!mine && <Avatar name={m.senderDisplayName || conversation?.name} src={m.senderAvatar || conversation?.avatar} size="sm" />}
                <div>
                  {isGroup && !mine && <em className="sender-name">{m.senderDisplayName}</em>}
                  <div className="bubble-wrap">
                    {m.deleted ? (
                      <div className="bubble recalled">Tin nhắn đã được thu hồi</div>
                    ) : img ? (
                      <button type="button" className="chat-image-btn" onClick={() => onOpenImage?.(m.content)}>
                        <img className="chat-image" src={mediaUrl(m.content)} alt="Ảnh đính kèm" />
                      </button>
                    ) : m.messageType === "AUDIO" ? (
                      <audio className="chat-audio" controls preload="metadata" src={mediaUrl(m.content)}>
                        Trình duyệt không hỗ trợ phát âm thanh.
                      </audio>
                    ) : m.messageType === "FILE" ? (
                      <a className="file-bubble file-link" href={mediaUrl(m.content)} target="_blank" rel="noreferrer" download>
                        <Icon name="file" />
                        <div>
                          <strong>{m.attachments?.[0]?.fileName || "Tệp đính kèm"}</strong>
                          <span>{m.attachments?.[0]?.fileSize ? formatBytes(m.attachments[0].fileSize) : "Nhấn để tải xuống"}</span>
                        </div>
                        <Icon name="download" size={18} />
                      </a>
                    ) : (
                      <div className="bubble">
                        {m.replyToMessageId && (
                          <button type="button" className="reply-quote" onClick={() => messagesRef?.current?.jump(m.replyToMessageId)}>
                            <Icon name="reply" size={12} /> {m.replyToContentPreview || "tin nhắn"}
                          </button>
                        )}
                        {m.content}
                        {m.editedAt && <em className="edited"> (đã chỉnh sửa)</em>}
                      </div>
                    )}
                    {!m.deleted && (
                      <div className="msg-tools">
                        <button title="Thả cảm xúc" onClick={() => setReactionFor(reactionFor === m.messageId ? null : m.messageId)}>
                          <Icon name="smile" size={15} />
                        </button>
                        <button title="Trả lời" onClick={() => setReplyTo(m)}>
                          <Icon name="reply" size={15} />
                        </button>
                        {mine && m.messageType === "TEXT" && !img && (
                          <button
                            title="Sửa"
                            onClick={() => {
                              setEditing(m.messageId)
                              setEditDraft(m.content || "")
                            }}
                          >
                            <Icon name="edit" size={15} />
                          </button>
                        )}
                        {mine && (
                          <button title="Thu hồi" onClick={() => recall(m.messageId)}>
                            <Icon name="trash" size={15} />
                          </button>
                        )}
                        {reactionFor === m.messageId && (
                          <div className="pop-menu emoji-menu reaction-menu">
                            {QUICK_EMOJIS.map((e) => (
                              <button key={e} type="button" onClick={() => react(m.messageId, e)}>
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {editing === m.messageId && mine && !m.deleted && (
                    <div className="inline-editor">
                      <input
                        value={editDraft}
                        autoFocus
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(m.messageId)
                          if (e.key === "Escape") setEditing(null)
                        }}
                      />
                      <button type="button" onClick={() => saveEdit(m.messageId)}>Lưu</button>
                      <button type="button" onClick={() => setEditing(null)}>Hủy</button>
                    </div>
                  )}
                  {reactions.length > 0 && (
                    <div className="reaction-row">
                      {reactions.map((r) => {
                        const mineReacted = r.userIds?.some((id) => String(id) === String(myId))
                        return (
                          <button key={r.emoji} type="button" className={mineReacted ? "active" : ""} title={mineReacted ? "Bỏ cảm xúc" : "Thả cảm xúc"} onClick={() => react(m.messageId, r.emoji)}>
                            {r.emoji} <span>{r.count}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <span>
                    {clockTime(m.createdAt)}
                    {mine && lastMine?.messageId === m.messageId ? ` · ${m.deliveryStatus === "SEEN" ? "Đã xem" : "Đã gửi"}` : ""}
                  </span>
                </div>
              </div>
            </React.Fragment>
          )
        })}
        {typingNames.length > 0 && (
          <div className="typing">
            <span><i /><i /><i /></span>
            <small>{typingNames.join(", ")} đang nhập...</small>
          </div>
        )}
      </div>

      {replyTo && (
        <div className="reply-bar">
          <span>Đang trả lời: {replyTo.deleted ? "tin nhắn đã thu hồi" : (replyTo.content || "").slice(0, 60)}</span>
          <button onClick={() => setReplyTo(null)} aria-label="Hủy trả lời"><Icon name="close" size={16} /></button>
        </div>
      )}

      {conversation?.type === "PRIVATE" && conversation.blockedByCurrentUser ? (
        <div className="chat-blocked">
          <span>Bạn đã chặn người này</span>
          <button type="button" className="button button-secondary" onClick={unblock} disabled={unblocking}>
            {unblocking ? "Đang bỏ chặn..." : "Bỏ chặn"}
          </button>
        </div>
      ) : conversation?.type === "PRIVATE" && conversation.blockedByOther ? (
        <div className="chat-blocked">Người này đã chặn bạn; bạn không thể nhắn tin.</div>
      ) : (
        <form className="chat-composer" onSubmit={send}>
          <input ref={fileRef} type="file" hidden onChange={onFile} />
          <input ref={imageRef} type="file" accept="image/*" hidden onChange={onFile} />
          <button type="button" aria-label="Đính kèm tệp" title="Đính kèm tệp" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Icon name="plus" />
          </button>
          <button type="button" aria-label="Gửi ảnh" title="Gửi ảnh" disabled={uploading} onClick={() => imageRef.current?.click()}>
            <Icon name="image" />
          </button>
          <button type="button" className={`voice-btn ${recording ? "recording" : ""}`} aria-pressed={recording} aria-label={recording ? "Dừng ghi âm và gửi" : "Ghi âm tin nhắn thoại"} title={recording ? "Dừng ghi âm và gửi" : "Ghi âm tin nhắn thoại"} disabled={uploading} onClick={toggleRecording}>
            <Icon name="mic" />
          </button>
          {recording && <span className="recording-label"><i />Đang ghi âm</span>}
          <input
            value={text}
            onChange={(e) => onType(e.target.value)}
            placeholder={uploading ? "Đang tải lên..." : recording ? "Nhấn micro để dừng và gửi" : "Nhập tin nhắn..."}
            disabled={recording}
          />
          <div className="emoji-anchor">
            <button type="button" aria-label="Biểu tượng cảm xúc" onClick={() => setEmojiOpen(!emojiOpen)}>
              <Icon name="smile" />
            </button>
            {emojiOpen && (
              <div className="pop-menu emoji-menu up">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => { setText((t) => t + e); setEmojiOpen(false) }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <button className="send-button" aria-label="Gửi" disabled={!text.trim()}>
            <Icon name="send" />
          </button>
        </form>
      )}
    </section>
  )
}
