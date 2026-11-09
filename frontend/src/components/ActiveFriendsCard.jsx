import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { friendApi } from '../api/friendApi'
import { presenceApi } from '../api/presenceApi'
import { conversationApi } from '../api/conversationApi'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

const PRESENCE_POLL_MS = 30000

// /api/friends/accepted có thể trả về thẳng thông tin bạn bè hoặc một bản ghi kết bạn lồng
// thông tin hai phía; hàm này lấy ra "người bạn" (không phải mình) ở cả hai dạng.
function normalizeFriend(item, myId) {
  if (!item) return null
  const nested = [item.friend, item.user, item.otherUser, item.sender, item.receiver, item.requester, item.addressee]
    .filter(Boolean)
    .find((candidate) => String(candidate.userId ?? candidate.id) !== String(myId))
  const source = nested || item
  const id = source.userId ?? source.friendId ?? source.friendUserId ?? source.otherUserId ?? source.id
    ?? (String(item.senderId) !== String(myId) ? item.senderId : item.receiverId)
  if (id == null || String(id) === String(myId)) return null
  const name = source.displayName || source.friendName || source.fullName || source.name || source.username || 'Người dùng'
  const flag = source.online ?? source.isOnline ?? source.active ?? item.online ?? item.isOnline
  const statusText = String(source.status || '').toUpperCase()
  return {
    id,
    name,
    avatar: source.avatar || source.friendAvatar || source.avatarUrl || null,
    serverOnline: flag === true || statusText === 'ONLINE',
  }
}

export default function ActiveFriendsCard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [onlineIds, setOnlineIds] = useState(() => new Set())
  const [state, setState] = useState('loading')

  const loadFriends = useCallback(() => {
    setState('loading')
    friendApi.accepted()
      .then((response) => {
        const seen = new Set()
        const list = (response.data || [])
          .map((item) => normalizeFriend(item, user?.userId))
          .filter((friend) => friend && !seen.has(String(friend.id)) && seen.add(String(friend.id)))
        setFriends(list)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [user?.userId])

  useEffect(() => { loadFriends() }, [loadFriends])

  const idsKey = friends.map((friend) => friend.id).join(',')
  useEffect(() => {
    if (!idsKey) {
      setOnlineIds(new Set())
      return undefined
    }
    let cancelled = false
    const fetchPresence = () => {
      presenceApi.online(idsKey.split(','))
        .then((response) => {
          if (!cancelled) setOnlineIds(new Set((response.data?.onlineIds || []).map(String)))
        })
        .catch(() => {})
    }
    fetchPresence()
    const timerId = window.setInterval(fetchPresence, PRESENCE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timerId)
    }
  }, [idsKey])

  // Đang hoạt động đứng trước, ngoại tuyến đứng sau; mỗi nhóm xếp theo tên.
  const { online, offline } = useMemo(() => {
    const byName = (a, b) => a.name.localeCompare(b.name, 'vi')
    const withStatus = friends.map((friend) => ({ ...friend, isOnline: onlineIds.has(String(friend.id)) || friend.serverOnline }))
    return {
      online: withStatus.filter((friend) => friend.isOnline).sort(byName),
      offline: withStatus.filter((friend) => !friend.isOnline).sort(byName),
    }
  }, [friends, onlineIds])

  const openChat = async (friend) => {
    try {
      const response = await conversationApi.getOrCreatePrivate(friend.id)
      navigate(`/chat/${response.data.conversationId}`)
    } catch {
      navigate(`/feed/profile/${friend.id}`)
    }
  }

  const renderRow = (friend) => (
    <li key={friend.id}>
      <button type="button" className="friend-row" onClick={() => openChat(friend)} title={`Nhắn tin cho ${friend.name}`}>
        <span className={`friend-avatar ${friend.isOnline ? 'is-online' : ''}`}>
          <Avatar src={friend.avatar} name={friend.name} size={36} />
          <span className="friend-dot" aria-hidden="true" />
        </span>
        <span className="friend-text">
          <strong>{friend.name}</strong>
          <small>{friend.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}</small>
        </span>
      </button>
    </li>
  )

  return (
    <section className="aside-card friends-card" aria-label="Bạn bè đang hoạt động">
      <div className="aside-heading friends-card-heading">
        <strong>Bạn bè</strong>
        {state === 'ready' && friends.length > 0 && (
          <span className="friends-card-count"><i aria-hidden="true" />{online.length} đang hoạt động</span>
        )}
      </div>

      {state === 'loading' && (
        <div className="friends-skeleton" aria-busy="true" aria-label="Đang tải danh sách bạn bè">
          {[0, 1, 2, 3].map((index) => <div key={index}><span /><span /></div>)}
        </div>
      )}

      {state === 'error' && (
        <div className="friends-empty">
          <p>Không tải được danh sách bạn bè.</p>
          <button type="button" onClick={loadFriends}>Thử lại</button>
        </div>
      )}

      {state === 'ready' && friends.length === 0 && (
        <div className="friends-empty">
          <p>Bạn chưa có bạn bè nào.</p>
          <button type="button" onClick={() => navigate('/friends')}>Tìm bạn bè</button>
        </div>
      )}

      {state === 'ready' && friends.length > 0 && (
        <div className="friends-scroll" tabIndex={0} aria-label="Danh sách bạn bè, cuộn để xem thêm">
          {online.length > 0 && (
            <>
              <div className="friends-group-label">Đang hoạt động · {online.length}</div>
              <ul className="friends-list">{online.map(renderRow)}</ul>
            </>
          )}
          {offline.length > 0 && (
            <>
              <div className="friends-group-label">Ngoại tuyến · {offline.length}</div>
              <ul className="friends-list">{offline.map(renderRow)}</ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
