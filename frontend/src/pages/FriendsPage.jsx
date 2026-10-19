import React, { useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { friendApi } from '../api/friendApi'
import { conversationApi } from '../api/conversationApi'
import { useNavigate } from 'react-router-dom'

export default function FriendsPage() {
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => {
    setError('')
    Promise.all([friendApi.received(), friendApi.sent()])
      .then(([receivedRes, sentRes]) => {
        setReceived(receivedRes.data)
        setSent(sentRes.data)
      })
      .catch(() => setError('Không tải được danh sách lời mời. Vui lòng thử lại.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const retry = () => {
    setLoading(true)
    load()
  }

  const accept = async (id, senderId) => {
    await friendApi.accept(id)
    load()
    const { data } = await conversationApi.getOrCreatePrivate(senderId)
    window.dispatchEvent(new Event('cmctalk-conversations-updated'))
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
        {loading && <LoadingState label="Đang tải lời mời..." />}
        {!loading && error && <ErrorState title="Không tải được lời mời" message={error} onRetry={retry} />}
        {!loading && !error && (<>
        <h3>Đã nhận ({received.length})</h3>
        {received.length === 0 && <EmptyState compact icon="✉" description="Không có lời mời nào" />}
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
        {sent.length === 0 && <EmptyState compact icon="➤" description="Chưa gửi lời mời nào" />}
        {sent.map((r) => (
          <div key={r.id} className="friend-request-row">
            <div style={{ flex: 1, fontSize: 14 }}>Đang chờ phản hồi từ user #{r.receiverId}</div>
          </div>
        ))}
        </>)}
      </div>
    </div>
  )
}
