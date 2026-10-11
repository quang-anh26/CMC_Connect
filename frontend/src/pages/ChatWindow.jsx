import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import ContactInfoPanel from '../components/ContactInfoPanel'
import { messageApi } from '../api/messageApi'
import { conversationApi } from '../api/conversationApi'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import {
  VideoCallIcon,
  PhoneCallIcon,
  InfoIcon,
  PaperclipIcon,
  MicrophoneIcon,
  EmojiIcon,
  SendPaperPlane,
  DoubleCheckIcon,
} from '../components/Icons'

function formatMsgTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatLastSeen(dateStr, now) {
  if (!dateStr) return 'chưa rõ thời gian'
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 60000))
  if (elapsedMinutes < 1) return 'vừa xong'
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} giờ trước`
  const elapsedDays = Math.floor(elapsedHours / 24)
  return `${elapsedDays} ngày trước`
}

function isImageMessage(message) {
  if (!message) return false

  if (message.messageType === 'IMAGE') return true
  if (message.messageType === 'AUDIO' || message.messageType === 'FILE') return false

  const content = typeof message.content === 'string' ? message.content.trim() : ''
  if (!content) return false

  return (
    content.startsWith('/uploads/') ||
    content.startsWith('http://') ||
    content.startsWith('https://')
  )
}

export default function ChatWindow() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const { subscribe, publish, connected, startCall } = useSocket()

  const [conversationInfo, setConversationInfo] = useState(null)
  const [messages, setMessages] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [typingUsers, setTypingUsers] = useState({})
  const [uploading, setUploading] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(true)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [activeReactionMessage, setActiveReactionMessage] = useState(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const bottomRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageRefs = useRef({})
  const voiceRecorderRef = useRef(null)
  const voiceStreamRef = useRef(null)
  const voiceChunksRef = useRef([])
  const sendVoiceOnStopRef = useRef(false)

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '👏', '🔥', '🎉']

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    sendVoiceOnStopRef.current = false
    voiceRecorderRef.current?.stop()
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [conversationId])

  // Load real conversation metadata
  useEffect(() => {
    if (!conversationId) return
    conversationApi
      .list()
      .then((res) => {
        const found = res.data?.find((c) => String(c.conversationId) === String(conversationId))
        setConversationInfo(found || null)
      })
      .catch(() => {})

    setShowInfoPanel(true)
  }, [conversationId])

  // Load real messages history
  useEffect(() => {
    if (!conversationId) return
    setMessages([])
    setPage(0)
    setHasMore(false)
    setLoadingHistory(true)

    messageApi
      .history(conversationId, 0)
      .then((res) => {
        setMessages(res.data || [])
        setHasMore((res.data || []).length === 20)
        setLoadingHistory(false)
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      })
      .catch(() => {
        setMessages([])
        setLoadingHistory(false)
      })
  }, [conversationId])

  const loadMore = useCallback(() => {
    if (!conversationId) return
    const nextPage = page + 1
    const container = messagesContainerRef.current
    const prevHeight = container?.scrollHeight || 0

    messageApi.history(conversationId, nextPage).then((res) => {
      const older = res.data || []
      setMessages((prev) => [...older, ...prev])
      setHasMore(older.length === 20)
      setPage(nextPage)
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight
      })
    })
  }, [conversationId, page])

  // Realtime subscriptions
  useEffect(() => {
    if (!connected || !conversationId) return

    const unsubMessages = subscribe(`/topic/conversation/${conversationId}`, (incoming) => {
      window.dispatchEvent(new Event('kapatalk-conversations-updated'))
      setConversationInfo((current) => current ? { ...current, newFriend: false } : current)
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.messageId === incoming.messageId)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = incoming
          return copy
        }
        return [...prev, incoming]
      })
      if (String(incoming.senderId) !== String(user?.userId)) {
        publish('/app/chat.seen', { conversationId: Number(conversationId) })
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })

    const unsubTyping = subscribe(`/topic/conversation/${conversationId}/typing`, (event) => {
      if (String(event.userId) === String(user?.userId)) return
      setTypingUsers((prev) => {
        const copy = { ...prev }
        if (event.typing) copy[event.userId] = event.username
        else delete copy[event.userId]
        return copy
      })
    })

    const unsubSeen = subscribe(`/topic/conversation/${conversationId}/seen`, () => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m.senderId) === String(user?.userId) ? { ...m, deliveryStatus: 'SEEN' } : m
        )
      )
    })

    const unsubReactions = subscribe(`/topic/conversation/${conversationId}/reactions`, (update) => {
      setMessages((current) => current.map((message) => (
        String(message.messageId) === String(update.messageId)
          ? { ...message, reactions: update.reactions || [] }
          : message
      )))
    })

    const unsubPresence = subscribe('/topic/presence', () => {
      conversationApi.list().then((res) => {
        const found = res.data?.find((c) => String(c.conversationId) === String(conversationId))
        setConversationInfo(found || null)
      }).catch(() => {})
    })

    const unsubDetails = subscribe(`/topic/conversation/${conversationId}/details`, () => {
      conversationApi.list().then((res) => {
        const found = res.data?.find((c) => String(c.conversationId) === String(conversationId))
        setConversationInfo(found || null)
      }).catch(() => {})
    })

    publish('/app/chat.seen', { conversationId: Number(conversationId) })

    return () => {
      unsubMessages()
      unsubTyping()
      unsubSeen()
      unsubReactions()
      unsubPresence()
      unsubDetails()
    }
  }, [connected, conversationId, user?.userId])

  const handleSend = () => {
    if (!text.trim() || !conversationId) return

    publish('/app/chat.send', {
      conversationId: Number(conversationId),
      content: text.trim(),
      messageType: 'TEXT',
      replyToMessageId: replyTo?.messageId || null,
    })
    setText('')
    setReplyTo(null)
    setShowEmojiPicker(false)
    stopTyping()
  }

  const handleReaction = async (messageId, emoji) => {
    if (!conversationId) return
    try {
      const { data } = await messageApi.react(messageId, Number(conversationId), emoji)
      setMessages((current) => current.map((message) => (
        String(message.messageId) === String(data.messageId)
          ? { ...message, reactions: data.reactions || [] }
          : message
      )))
      setActiveReactionMessage(null)
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể thả cảm xúc')
    }
  }

  const handleEditMessage = async (messageId, content) => {
    const trimmed = content.trim()
    if (!trimmed) {
      alert('Nội dung tin nhắn không được để trống')
      return
    }

    try {
      const { data } = await messageApi.edit(messageId, trimmed)
      setMessages((current) => current.map((message) => (
        String(message.messageId) === String(messageId)
          ? { ...message, content: data.content, editedAt: data.createdAt }
          : message
      )))
      if (connected && conversationId) {
        publish('/app/chat.edit', {
          messageId,
          conversationId: Number(conversationId),
          content: trimmed,
        })
      }
      setEditingMessageId(null)
      setEditingDraft('')
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể chỉnh sửa tin nhắn')
    }
  }

  const handleTyping = (value) => {
    setText(value)
    if (connected && conversationId) {
      publish('/app/chat.typing', { conversationId: Number(conversationId), typing: true })
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(stopTyping, 2000)
    }
  }

  const stopTyping = () => {
    if (connected && conversationId) {
      publish('/app/chat.typing', { conversationId: Number(conversationId), typing: false })
    }
  }

  const handleRecall = (messageId) => {
    if (!window.confirm('Thu hồi tin nhắn này?')) return
    if (connected && conversationId) {
      publish('/app/chat.recall', { conversationId: Number(conversationId), messageId })
    }
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !conversationId) return
    setUploading(true)
    try {
      const { data } = await messageApi.upload(file)
      const isImage = file.type.startsWith('image/')
      publish('/app/chat.send', {
        conversationId: Number(conversationId),
        content: data.url,
        messageType: isImage ? 'IMAGE' : 'FILE',
        replyToMessageId: replyTo?.messageId || null,
      })
      setReplyTo(null)
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tải tệp lên')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleVoiceRecording = async () => {
    if (isRecordingVoice) {
      sendVoiceOnStopRef.current = true
      voiceRecorderRef.current?.stop()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Trình duyệt này không hỗ trợ ghi âm. Hãy dùng trình duyệt mới hơn và kết nối qua HTTPS hoặc localhost.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStreamRef.current = stream
      voiceChunksRef.current = []

      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        voiceStreamRef.current = null
        voiceRecorderRef.current = null
        setIsRecordingVoice(false)

        const shouldSend = sendVoiceOnStopRef.current
        sendVoiceOnStopRef.current = false
        const audioBlob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        voiceChunksRef.current = []
        if (!shouldSend || !audioBlob.size || !conversationId) return

        const extension = audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
        setUploading(true)
        try {
          const voiceFile = new File([audioBlob], `voice-message.${extension}`, { type: audioBlob.type })
          const { data } = await messageApi.upload(voiceFile)
          publish('/app/chat.send', {
            conversationId: Number(conversationId),
            content: data.url,
            messageType: 'AUDIO',
            replyToMessageId: replyTo?.messageId || null,
          })
          setReplyTo(null)
        } catch (err) {
          alert(err.response?.data?.message || 'Không thể gửi tin nhắn thoại')
        } finally {
          setUploading(false)
        }
      }

      voiceRecorderRef.current = recorder
      sendVoiceOnStopRef.current = false
      recorder.start()
      setIsRecordingVoice(true)
    } catch (err) {
      const message = err.name === 'NotAllowedError'
        ? 'Bạn chưa cấp quyền sử dụng microphone. Hãy cho phép trong cài đặt trình duyệt.'
        : 'Không thể truy cập microphone. Vui lòng kiểm tra thiết bị và quyền trình duyệt.'
      alert(message)
    }
  }

  const jumpToMessage = useCallback((messageId) => {
    const target = messageRefs.current[messageId]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.classList.add('message-highlight')
      window.setTimeout(() => target.classList.remove('message-highlight'), 1400)
    }
  }, [])

  const otherUserId = useMemo(
    () => messages.find((m) => String(m.senderId) !== String(user?.userId))?.senderId ?? null,
    [messages, user?.userId]
  )

  const sharedImages = useMemo(() => {
    return messages
      .filter((m) => isImageMessage(m) && !m.deleted)
      .map((m) => m.content)
      .reverse()
  }, [messages])

  const headerAvatar = conversationInfo?.avatar
  const headerName = conversationInfo?.name || 'Cuộc trò chuyện'
  const isOnline = conversationInfo?.otherUserOnline

  return (
    <div className="chat-layout-wrapper">
      <div className="chat-area">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-header-left" onClick={() => setShowInfoPanel((v) => !v)}>
            <div className="avatar-wrapper">
              <Avatar src={headerAvatar} name={headerName} size={42} />
              {conversationInfo?.type === 'PRIVATE' && isOnline && (
                <span className="online-indicator-dot" />
              )}
            </div>
            <div className="chat-header-info">
              <div className="chat-header-name">{headerName}</div>
              <div className="chat-header-status">
                {conversationInfo?.newFriend
                  ? 'Bạn mới'
                  : conversationInfo?.type === 'GROUP'
                  ? 'Nhóm chat'
                  : isOnline
                  ? 'Đang online'
                  : `Hoạt động · ${formatLastSeen(conversationInfo?.otherUserLastSeenAt, now)}`}
              </div>
            </div>
          </div>

          <div className="chat-header-actions">
            <button className="header-action-btn" title="Gọi video" onClick={() => startCall(conversationInfo, 'video')} disabled={conversationInfo?.type === 'GROUP'}>
              <VideoCallIcon size={20} color="#8da2b5" />
            </button>
            <button className="header-action-btn" title="Gọi thoại" onClick={() => startCall(conversationInfo, 'audio')} disabled={conversationInfo?.type === 'GROUP'}>
              <PhoneCallIcon size={19} color="#8da2b5" />
            </button>
            <button
              className="header-action-btn"
              onClick={() => setShowInfoPanel((v) => !v)}
              title="Thông tin cuộc trò chuyện"
            >
              <InfoIcon size={20} color="#8da2b5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="chat-messages" ref={messagesContainerRef}>
          {hasMore && !loadingHistory && (
            <div className="load-more" onClick={loadMore}>
              ⌃ Tải thêm tin nhắn cũ hơn
            </div>
          )}

          {loadingHistory && (
            <div className="empty-state" style={{ height: 80 }}>
              Đang tải tin nhắn...
            </div>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="empty-state" style={{ height: 180, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 32 }}>👋</div>
              <div style={{ color: 'var(--text-secondary)' }}>Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</div>
            </div>
          )}

          {/* Date Separator */}
          {messages.length > 0 && (
            <div className="date-separator">
              <span>Hôm nay</span>
            </div>
          )}

          {messages.map((m) => {
            const mine = String(m.senderId) === String(user?.userId)
            const timeDisplay = formatMsgTime(m.createdAt)
            const isImageBubble = isImageMessage(m) && !m.deleted

            if (m.messageType === 'SYSTEM') {
              return (
                <div key={m.messageId} className="system-message-row">
                  <span>{m.content}</span>
                </div>
              )
            }

            return (
              <div
                key={m.messageId}
                ref={(element) => {
                  if (element) messageRefs.current[m.messageId] = element
                }}
                className={`msg-group-row ${mine ? 'mine' : 'theirs'}`}
              >
                {!mine && (
                  <div className="msg-sender-avatar">
                    <Avatar
                      src={m.senderAvatar || headerAvatar}
                      name={m.senderDisplayName || headerName}
                      size={32}
                    />
                  </div>
                )}

                <div className="msg-bubble-container">
                  <div className={`msg-bubble ${mine ? 'bubble-mine' : 'bubble-theirs'} ${m.deleted ? 'deleted' : ''} ${isImageBubble ? 'image-message' : ''}`}>
                    {m.replyToMessageId && !m.deleted && (
                      <div className="msg-reply-quote">
                        ↩ {m.replyToContentPreview || 'tin nhắn'}
                      </div>
                    )}

                    <div className="msg-content-row">
                      {m.deleted ? (
                        <span className="msg-deleted-text">Tin nhắn đã được thu hồi</span>
                      ) : isImageMessage(m) ? (
                        <img
                          src={m.content}
                          alt="attachment"
                          className="msg-image-content"
                        />
                      ) : m.messageType === 'AUDIO' ? (
                        <audio className="msg-audio-content" controls preload="metadata" src={m.content}>
                          Trình duyệt không hỗ trợ phát âm thanh.
                        </audio>
                      ) : m.messageType === 'FILE' ? (
                        <a
                          href={m.content}
                          target="_blank"
                          rel="noreferrer"
                          className="msg-file-content"
                        >
                          📎 Tệp đính kèm
                        </a>
                      ) : (
                        <span className="msg-text-content">{m.content}</span>
                      )}

                      {/* Inline time & status stamp */}
                      <span className="msg-inline-meta">
                        <span className="msg-time-stamp">{timeDisplay}</span>
                        {mine && !m.deleted && (
                          <span className="msg-status-icon">
                            <DoubleCheckIcon
                              size={14}
                              color={m.deliveryStatus === 'SEEN' ? '#60a5fa' : 'rgba(255,255,255,0.7)'}
                            />
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {m.reactions?.length > 0 && (
                    <div className="msg-reaction-list">
                      {m.reactions.map((reaction) => {
                        const reactedByMe = reaction.userIds?.some((id) => String(id) === String(user?.userId))
                        return (
                          <button
                            key={reaction.emoji}
                            type="button"
                            className={`msg-reaction-chip ${reactedByMe ? 'active' : ''}`}
                            title={reactedByMe ? 'Bỏ cảm xúc' : 'Thả cảm xúc'}
                            onClick={() => handleReaction(m.messageId, reaction.emoji)}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {!m.deleted && m.messageType !== 'SYSTEM' && (
                    <div className="msg-reaction-tools">
                      <button
                        type="button"
                        className="msg-react-trigger"
                        title="Thả cảm xúc"
                        aria-label="Thả cảm xúc"
                        onClick={() => setActiveReactionMessage((current) => current === m.messageId ? null : m.messageId)}
                      >
                        <EmojiIcon size={16} />
                      </button>
                      {activeReactionMessage === m.messageId && (
                        <div className="msg-reaction-picker">
                          {quickEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="msg-reaction-option"
                              title={`Thả ${emoji}`}
                              onClick={() => handleReaction(m.messageId, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions hover */}
                  {!m.deleted && (
                    <div className="msg-actions-hover">
                      <span onClick={() => setReplyTo(m)}>Trả lời</span>
                      {mine && <span onClick={() => { setEditingMessageId(m.messageId); setEditingDraft(m.content || '') }}>Sửa</span>}
                      {mine && <span onClick={() => handleRecall(m.messageId)}>Thu hồi</span>}
                    </div>
                  )}

                  {editingMessageId === m.messageId && mine && !m.deleted && (
                    <div className="inline-message-editor">
                      <input
                        type="text"
                        value={editingDraft}
                        onChange={(event) => setEditingDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleEditMessage(m.messageId, editingDraft)
                          if (event.key === 'Escape') {
                            setEditingMessageId(null)
                            setEditingDraft('')
                          }
                        }}
                        autoFocus
                      />
                      <div className="inline-message-editor-actions">
                        <button type="button" onClick={() => handleEditMessage(m.messageId, editingDraft)}>Lưu</button>
                        <button type="button" onClick={() => { setEditingMessageId(null); setEditingDraft('') }}>Hủy</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="typing-indicator">
            {Object.values(typingUsers).join(', ')} đang nhập...
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="reply-preview-bar">
            <span>
              Đang trả lời:{' '}
              {replyTo.deleted
                ? 'tin nhắn đã thu hồi'
                : (replyTo.content || '').slice(0, 50)}
            </span>
            <button className="icon-btn" onClick={() => setReplyTo(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Emoji picker popup */}
        {showEmojiPicker && (
          <div className="emoji-picker-popup">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                onClick={() => {
                  setText((prev) => prev + emoji)
                  setShowEmojiPicker(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Chat Input Bar */}
        <div className="chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />

          <button
            type="button"
            className="input-tool-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Đính kèm tệp/ảnh"
          >
            <PaperclipIcon size={20} color="#8da2b5" />
          </button>

          <button
            type="button"
            className="input-tool-btn"
            onClick={() => setShowEmojiPicker((v) => !v)}
            title="Biểu tượng cảm xúc"
          >
            <EmojiIcon size={20} color="#8da2b5" />
          </button>

          <button
            type="button"
            className={`input-tool-btn voice-record-btn ${isRecordingVoice ? 'recording' : ''}`}
            onClick={handleVoiceRecording}
            disabled={uploading}
            title={isRecordingVoice ? 'Dừng ghi âm và gửi' : 'Ghi âm tin nhắn thoại'}
            aria-label={isRecordingVoice ? 'Dừng ghi âm và gửi' : 'Ghi âm tin nhắn thoại'}
            aria-pressed={isRecordingVoice}
          >
            <MicrophoneIcon size={20} />
          </button>

          <div className="chat-input-pill">
            {isRecordingVoice && <span className="voice-recording-label">Đang ghi âm</span>}
            <input
              type="text"
              placeholder={isRecordingVoice ? 'Dừng để gửi tin nhắn thoại' : 'Nhập tin nhắn...'}
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>

          <button
            type="button"
            className="send-action-btn"
            onClick={handleSend}
            disabled={!text.trim()}
            title="Gửi"
          >
            <SendPaperPlane size={18} />
          </button>
        </div>
      </div>

      {/* Right Column: Real Contact Info Panel */}
      {showInfoPanel && (
        <ContactInfoPanel
          conversationInfo={conversationInfo}
          otherUserId={otherUserId}
          images={sharedImages}
          messages={messages}
          onClose={() => setShowInfoPanel(false)}
          onJumpToMessage={jumpToMessage}
          onDetailsUpdated={(updated) => setConversationInfo((current) => current ? { ...current, ...updated } : updated)}
        />
      )}
    </div>
  )
}
