import React, { useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import { friendApi } from '../api/friendApi'
import { conversationApi } from '../api/conversationApi'
import { userApi } from '../api/userApi'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function FriendsPage() {
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [accepted, setAccepted] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const navigate = useNavigate()
  const { user } = useAuth()

  const load = () => {
    friendApi.received().then((res) => setReceived(res.data))
    friendApi.sent().then((res) => setSent(res.data))
    friendApi.accepted().then((res) => setAccepted(res.data))
    userApi.search('').then((res) => {
      setSuggestions((res.data || []).filter((candidate) =>
        !candidate.relationshipStatus || candidate.relationshipStatus === 'REJECTED'
      ))
    })
  }

  useEffect(load, [])

  const accept = async (id, senderId) => {
    await friendApi.accept(id)
    load()
    const { data } = await conversationApi.getOrCreatePrivate(senderId)
    window.dispatchEvent(new Event('kapatalk-conversations-updated'))
    navigate(`/chat/${data.conversationId}`)
  }

  const reject = async (id) => {
    await friendApi.reject(id)
    load()
  }

  const sendRequest = async (receiverId) => {
    try {
      await friendApi.send(receiverId)
      load()
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể gửi lời mời kết bạn')
    }
  }

  return (
    <div className="chat-area">
      <div className="chat-header"><strong>Lời mời kết bạn</strong></div>
      <div className="friend-panel" style={{ overflowY: 'auto' }}>
        <h3>Đã nhận ({received.length})</h3>
        {received.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Không có lời mời nào</p>}
        {received.map((r) => (
          <div key={r.id} className="friend-request-row">
            <Avatar src={r.senderAvatar} name={r.senderDisplayName} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.senderDisplayName}</div>
              <div style={{ fontSize: 12, color: '#999' }}>@{r.senderUsername}</div>
            </div>
            <div className="actions">
              <button className="btn-accept" onClick={() => accept(r.id, r.senderId)}>Chấp nhận</button>
              <button className="btn-reject" onClick={() => reject(r.id)}>Từ chối</button>
            </div>
          </div>
        ))}

        <h3 style={{ marginTop: 24 }}>Đã gửi ({sent.length})</h3>
        {sent.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Chưa gửi lời mời nào</p>}
        {sent.map((r) => (
          <div key={r.id} className="friend-request-row">
            <div style={{ flex: 1, fontSize: 14 }}>Đang chờ phản hồi từ user #{r.receiverId}</div>
          </div>
        ))}
      </div>

      <div className="friend-panel" style={{ overflowY: 'auto' }}>
        <h3>Bạn bè ({accepted.length})</h3>
        {accepted.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Chưa có bạn bè</p>}
        {accepted.map((friend) => {
          const isSender = String(friend.senderId) === String(user?.userId)
          const friendName = isSender ? friend.receiverDisplayName : friend.senderDisplayName
          const friendAvatar = isSender ? friend.receiverAvatar : friend.senderAvatar
          return (
            <div key={friend.id} className="friend-request-row">
              <button type="button" className="friend-profile-link" onClick={() => navigate(`/feed/profile/${isSender ? friend.receiverId : friend.senderId}`)} aria-label={`Xem trang cá nhân ${friendName}`}><Avatar src={friendAvatar} name={friendName} size={36} /></button>
              <div style={{ flex: 1 }}>
                <button type="button" className="friend-profile-name" onClick={() => navigate(`/feed/profile/${isSender ? friend.receiverId : friend.senderId}`)}>{friendName}</button>
                <div style={{ fontSize: 12, color: '#999' }}>Đã kết bạn</div>
              </div>
            </div>
          )
        })}

        <h3 style={{ marginTop: 24 }}>Gợi ý liên hệ ({suggestions.length})</h3>
        {suggestions.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Chưa có gợi ý liên hệ</p>}
        {suggestions.map((candidate) => (
          <div key={candidate.userId} className="friend-request-row">
            <Avatar src={candidate.avatar} name={candidate.displayName} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{candidate.displayName}</div>
              <div style={{ fontSize: 12, color: '#999' }}>@{candidate.username}</div>
            </div>
            <div className="actions">
              <button className="btn-accept" onClick={() => sendRequest(candidate.userId)}>
                Kết bạn
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
