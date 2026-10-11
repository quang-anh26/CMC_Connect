import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import { conversationApi } from '../api/conversationApi'
import { userApi } from '../api/userApi'
import { friendApi } from '../api/friendApi'
import { blockApi } from '../api/blockApi'
import { useSocket } from '../context/SocketContext'
import { SearchIcon, MoreVerticalIcon, ChatIcon } from './Icons'

export function formatConversationTime(dateStr) {
  if (!dateStr) return ''

  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr

  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Hôm qua'
  }

  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) {
    const daysMap = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
    return daysMap[d.getDay()]
  }

  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function Sidebar({ activeConversationId }) {
  const { subscribe, connected, startCall } = useSocket()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState([])
  const [archivedConversations, setArchivedConversations] = useState([])
  const [showArchivedOnly, setShowArchivedOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [groupOpen, setGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [groupSaving, setGroupSaving] = useState(false)
  const [openConversationMenu, setOpenConversationMenu] = useState(null)

  const loadConversations = () => {
    conversationApi
      .list()
      .then((activeRes) => {
        const list = activeRes.data || []
        setConversations(list)
      })
      .catch(() => setConversations([]))

    conversationApi
      .archived()
      .then((archivedRes) => setArchivedConversations(archivedRes.data || []))
      .catch(() => setArchivedConversations([]))
  }

  const setConversationArchived = async (conversationId, archived) => {
    try {
      await conversationApi.setArchived(conversationId, archived)
      loadConversations()
      if (archived && String(conversationId) === String(activeConversationId)) {
        navigate('/')
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể cập nhật lưu trữ đoạn chat')
    }
  }

  const markConversationUnread = (conversationId) => {
    localStorage.setItem(`kapatalk-unread-${conversationId}`, 'true')
    setConversations((current) => current.map((conversation) => (
      conversation.conversationId === conversationId
        ? { ...conversation, unreadCount: Math.max(conversation.unreadCount || 0, 1) }
        : conversation
    )))
    setOpenConversationMenu(null)
  }

  const clearConversationUnread = (conversationId) => {
    localStorage.removeItem(`kapatalk-unread-${conversationId}`)
    setConversations((current) => current.map((conversation) => (
      String(conversation.conversationId) === String(conversationId)
        ? { ...conversation, unreadCount: 0 }
        : conversation
    )))
  }

  const openConversation = (conversationId) => {
    clearConversationUnread(conversationId)
    navigate(`/chat/${conversationId}`)
  }

  const toggleConversationMute = (conversationId) => {
    const key = `kapatalk-muted-${conversationId}`
    if (localStorage.getItem(key) === 'true') localStorage.removeItem(key)
    else localStorage.setItem(key, 'true')
    setOpenConversationMenu(null)
  }

  const startConversationCall = (conversation, type) => {
    if (conversation.type !== 'PRIVATE' || !conversation.otherUserUsername) {
      alert('Chỉ có thể gọi trong cuộc trò chuyện cá nhân')
      return
    }
    startCall(conversation, type)
    setOpenConversationMenu(null)
  }

  const blockConversationUser = async (conversation) => {
    if (!conversation.otherUserId || !window.confirm(`Chặn ${conversation.name || 'người dùng'}?`)) return
    try {
      await blockApi.block(conversation.otherUserId)
      setOpenConversationMenu(null)
      await setConversationArchived(conversation.conversationId, true)
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể chặn người dùng')
    }
  }

  const deleteConversation = async (conversation) => {
    if (!window.confirm('Xóa đoạn chat này khỏi danh sách của bạn?')) return
    try {
      await conversationApi.leave(conversation.conversationId)
      setOpenConversationMenu(null)
      loadConversations()
      if (String(conversation.conversationId) === String(activeConversationId)) navigate('/')
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa đoạn chat')
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (activeConversationId) clearConversationUnread(activeConversationId)
  }, [activeConversationId])

  useEffect(() => {
    const refreshConversations = () => loadConversations()
    window.addEventListener('kapatalk-conversations-updated', refreshConversations)
    return () => window.removeEventListener('kapatalk-conversations-updated', refreshConversations)
  }, [])

  useEffect(() => {
    const showArchived = () => setShowArchivedOnly(true)
    const showActive = () => setShowArchivedOnly(false)
    window.addEventListener('kapatalk-show-archived', showArchived)
    window.addEventListener('kapatalk-show-active', showActive)
    return () => {
      window.removeEventListener('kapatalk-show-archived', showArchived)
      window.removeEventListener('kapatalk-show-active', showActive)
    }
  }, [])

  useEffect(() => {
    const closeConversationMenu = (event) => {
      if (!event.target.closest('.conversation-options-menu, .conversation-archive-btn')) {
        setOpenConversationMenu(null)
      }
    }

    document.addEventListener('click', closeConversationMenu)
    return () => document.removeEventListener('click', closeConversationMenu)
  }, [])

  useEffect(() => {
    if (!connected) return
    const unsubs = conversations.flatMap((c) => [
      subscribe(`/topic/conversation/${c.conversationId}`, () => loadConversations()),
      subscribe(`/topic/conversation/${c.conversationId}/seen`, () => loadConversations()),
      subscribe(`/topic/conversation/${c.conversationId}/details`, () => loadConversations()),
    ])
    const unsubPresence = subscribe('/topic/presence', () => loadConversations())
    return () => {
      unsubs.forEach((u) => u())
      unsubPresence()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, conversations.length])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(() => {
      userApi
        .search(searchTerm)
        .then((res) => setSearchResults(res.data || []))
        .catch(() => setSearchResults([]))
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  const openPrivateChat = async (otherUserId) => {
    try {
      const { data } = await conversationApi.getOrCreatePrivate(otherUserId)
      setSearchTerm('')
      setSearchResults([])
      loadConversations()
      navigate(`/chat/${data.conversationId}`)
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể mở cuộc trò chuyện')
    }
  }

  const sendFriendRequest = async (receiverId) => {
    try {
      await friendApi.send(receiverId)
      alert('Đã gửi lời mời kết bạn')
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể gửi lời mời')
    }
  }

  const toggleGroupMember = (user) => {
    setGroupMembers((current) =>
      current.some((member) => member.userId === user.userId)
        ? current.filter((member) => member.userId !== user.userId)
        : [...current, user]
    )
  }

  const createGroup = async (event) => {
    event.preventDefault()
    if (!groupName.trim() || groupMembers.length === 0) return
    setGroupSaving(true)
    try {
      const { data } = await conversationApi.createGroup({
        name: groupName.trim(),
        memberIds: groupMembers.map((member) => member.userId),
      })
      setGroupOpen(false)
      setGroupName('')
      setGroupMembers([])
      setSearchTerm('')
      setSearchResults([])
      loadConversations()
      navigate(`/chat/${data.conversationId}`)
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tạo nhóm')
    } finally {
      setGroupSaving(false)
    }
  }

  return (
    <div className="sidebar">
      {/* Search Input Bar with Create Group Button */}
      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm bạn bè, tin nhắn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon-btn">
            <SearchIcon size={16} color="#8392a5" />
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            className="icon-btn"
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', padding: '2px 8px' }}
            onClick={() => setGroupOpen((v) => !v)}
            title="Tạo nhóm chat mới"
          >
            <span>＋ Tạo nhóm</span>
          </button>
        </div>
      </div>

      {/* Group Create Modal / Panel toggle if open */}
      {groupOpen && (
        <div className="group-create-panel">
          <div className="group-create-title">
            <strong>Tạo nhóm mới</strong>
            <button className="icon-btn" onClick={() => setGroupOpen(false)} title="Đóng">
              ✕
            </button>
          </div>
          <form onSubmit={createGroup}>
            <input
              className="group-name-input"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Tên nhóm"
              required
            />
            <div className="group-selected-list">
              {groupMembers.map((member) => (
                <button
                  type="button"
                  key={member.userId}
                  onClick={() => toggleGroupMember(member)}
                >
                  {member.displayName} ×
                </button>
              ))}
              {groupMembers.length === 0 && <span>Chọn ít nhất một người</span>}
            </div>
            <input
              className="group-name-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm người để thêm vào nhóm..."
            />
            {searchResults.map((user) => {
              const selected = groupMembers.some((member) => member.userId === user.userId)
              return (
                <button
                  type="button"
                  key={user.userId}
                  className={`group-user-result ${selected ? 'selected' : ''}`}
                  onClick={() => toggleGroupMember(user)}
                >
                  <Avatar src={user.avatar} name={user.displayName} size={32} />
                  <span>
                    {user.displayName}
                    <small>@{user.username}</small>
                  </span>
                  <span>{selected ? '✓' : '+'}</span>
                </button>
              )
            })}
            <button
              className="group-submit-btn"
              type="submit"
              disabled={groupSaving || !groupName.trim() || groupMembers.length === 0}
            >
              {groupSaving ? 'Đang tạo...' : 'Tạo nhóm'}
            </button>
          </form>
        </div>
      )}

      {/* Search results overlay/panel */}
      {searchResults.length > 0 && (
        <div className="search-results-panel">
          <div className="search-results-title">Kết quả tìm kiếm</div>
          {searchResults.map((u) => (
            <div
              key={u.userId}
              className="conversation-item search-item"
              onClick={() => u.relationshipStatus === 'ACCEPTED' && openPrivateChat(u.userId)}
              title={u.relationshipStatus === 'ACCEPTED' ? 'Mở cuộc trò chuyện' : undefined}
            >
              <Avatar src={u.avatar} name={u.displayName} size={42} />
              <div className="conv-meta">
                <div className="conv-name">{u.displayName}</div>
                <div className="conv-last">@{u.username}</div>
              </div>
              {u.friendshipStatus === 'ACCEPTED' ? (
                <span className="search-friend-status">Đã kết bạn</span>
<<<<<<< HEAD
              ) : u.relationshipStatus === 'PENDING' ? (
                <>
                  <span className="search-friend-status">Đã gửi</span>
                  <button type="button" className="icon-btn" title="Nhắn tin" onClick={(event) => {
                    event.stopPropagation()
                    openPrivateChat(u.userId)
                  }}>
                    <ChatIcon size={18} />
                  </button>
                </>
=======
              ) : u.friendshipStatus === 'PENDING' ? (
                <span className="search-friend-status">Đã gửi</span>
>>>>>>> origin/main
              ) : (
                <>
                  <button
                    className="icon-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      sendFriendRequest(u.userId)
                    }}
                    title="Gửi lời mời kết bạn"
                  >
                    ➕
                  </button>
                  <button type="button" className="icon-btn" title="Nhắn tin" onClick={(event) => {
                    event.stopPropagation()
                    openPrivateChat(u.userId)
                  }}>
                    <ChatIcon size={18} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Real Conversation List */}
      <div className="conversation-list">
        {showArchivedOnly ? (
          archivedConversations.length === 0 ? (
            <div className="sidebar-empty-state" style={{ padding: '20px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Chưa có đoạn chat lưu trữ</p>
            </div>
          ) : null
        ) : conversations.length === 0 ? (
          <div className="sidebar-empty-state" style={{ padding: '20px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-secondary)' }}>
              Chưa có cuộc trò chuyện nào
            </p>
          </div>
        ) : (
          conversations.map((c) => {
            const isActive = String(c.conversationId) === String(activeConversationId)

            return (
              <div
                key={c.conversationId}
                className={`conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => openConversation(c.conversationId)}
              >
                <div className="avatar-wrapper">
                  <Avatar src={c.avatar} name={c.name} size={46} />
                  {c.type === 'PRIVATE' && c.otherUserOnline && (
                    <span className="online-indicator-dot" />
                  )}
                </div>

                <div className="conv-meta">
                  <div className="conv-top-row">
                    <span className="conv-name">{c.name || 'Cuộc trò chuyện'}</span>
                    <span className={`conv-time ${c.unreadCount > 0 ? 'unread' : ''}`}>
                      {formatConversationTime(c.lastMessageAt)}
                    </span>
                  </div>
                  <div className="conv-bottom-row">
                    <span className="conv-last">{c.newFriend ? 'Bạn mới' : c.lastMessage || 'Chưa có tin nhắn'}</span>
                    {(c.unreadCount > 0 || localStorage.getItem(`kapatalk-unread-${c.conversationId}`) === 'true') && (
                      <span className="unread-dot" title="Tin nhắn chưa đọc" />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="conversation-archive-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenConversationMenu((current) => current === c.conversationId ? null : c.conversationId)
                  }}
                  title="Tùy chọn đoạn chat"
                >
                  <MoreVerticalIcon size={18} />
                </button>
                {openConversationMenu === c.conversationId && (
                  <div className="conversation-options-menu" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => markConversationUnread(c.conversationId)}>Đánh dấu là chưa đọc</button>
                    <button type="button" onClick={() => toggleConversationMute(c.conversationId)}>Tắt thông báo</button>
                    <button type="button" onClick={() => {
                      if (c.otherUserId) navigate(`/feed/profile/${c.otherUserId}`)
                      setOpenConversationMenu(null)
                    }}>Xem trang cá nhân</button>
                    <button type="button" onClick={() => startConversationCall(c, 'audio')}>Gọi thoại</button>
                    <button type="button" onClick={() => startConversationCall(c, 'video')}>Chat video</button>
                    <button type="button" onClick={() => blockConversationUser(c)}>Chặn</button>
                    <button type="button" onClick={() => {
                      setOpenConversationMenu(null)
                      setConversationArchived(c.conversationId, true)
                    }}>Lưu trữ đoạn chat</button>
                    <button type="button" className="danger-option" onClick={() => deleteConversation(c)}>Xóa đoạn chat</button>
                  </div>
                )}
              </div>
            )
          })
        )}

        {archivedConversations.length > 0 && (
          <div className="archived-conversations">
            <div className="archived-heading">Đã lưu trữ</div>
            {archivedConversations.map((c) => (
              <div
                key={c.conversationId}
                className="conversation-item archived-item"
                onClick={() => navigate(`/chat/${c.conversationId}`)}
              >
                <Avatar src={c.avatar} name={c.name} size={46} />
                <div className="conv-meta">
                  <div className="conv-name">{c.name || 'Cuộc trò chuyện'}</div>
                  <div className="conv-last">{c.lastMessage || 'Chưa có tin nhắn'}</div>
                </div>
                <button
                  type="button"
                  className="conversation-archive-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    setConversationArchived(c.conversationId, false)
                  }}
                  title="Bỏ lưu trữ đoạn chat"
                >
                  Hiện
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
