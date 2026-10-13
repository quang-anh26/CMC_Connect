import React, { useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import { friendApi } from '../api/friendApi'
import { conversationApi } from '../api/conversationApi'
import { useNavigate } from 'react-router-dom'

export default function FriendsPage() {
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const navigate = useNavigate()

  const load = () => {
    friendApi.received().then((res) => setReceived(res.data))
    friendApi.sent().then((res) => setSent(res.data))
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
    </div>
  )
}
