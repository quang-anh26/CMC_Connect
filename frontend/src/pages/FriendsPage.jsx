import React, { useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { friendApi } from '../api/friendApi'
import { conversationApi } from '../api/conversationApi'
import { useNavigate } from 'react-router-dom'

function EmptyRequests({ icon, title, description }) {
  return (
    <div className="friends-empty-state">
      <div className="friends-empty-icon" aria-hidden="true">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

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
    <div className="chat-area friends-page">
      <header className="friends-page-topbar">
        <div className="friends-brand-mark" aria-hidden="true">✦</div>
        <div className="friends-topbar-copy">
          <span className="friends-eyebrow">CMC TALK · KẾT NỐI BẠN BÈ</span>
          <strong>Lời mời kết bạn</strong>
        </div>
        <div className="friends-topbar-count"><span>{received.length + sent.length}</span> lời mời</div>
      </header>

      <div className="friend-panel friends-page-content">
        <section className="friends-hero">
          <div className="friends-hero-copy">
            <span className="friends-kicker">MỞ RỘNG KẾT NỐI</span>
            <h1>Kết nối với mọi người</h1>
            <p>Quản lý lời mời kết bạn đã nhận và theo dõi những lời mời ông đã gửi.</p>
          </div>
          <div className="friends-hero-art" aria-hidden="true">
            <span className="friends-orbit friends-orbit-one" />
            <span className="friends-orbit friends-orbit-two" />
            <span className="friends-person friends-person-back">●</span>
            <span className="friends-person friends-person-front">●</span>
            <span className="friends-hero-plus">＋</span>
          </div>
          <div className="friends-stats">
            <div className="friends-stat"><span className="friends-stat-icon">✉</span><div><strong>{received.length}</strong><small>Lời mời đã nhận</small></div></div>
            <div className="friends-stat"><span className="friends-stat-icon">➤</span><div><strong>{sent.length}</strong><small>Lời mời đã gửi</small></div></div>
          </div>
        </section>

        {loading && <div className="friends-feedback-card"><LoadingState label="Đang tải lời mời..." /></div>}
        {!loading && error && <div className="friends-feedback-card"><ErrorState title="Không tải được lời mời" message={error} onRetry={retry} /></div>}

        {!loading && !error && <div className="friends-requests-grid">
          <section className="friends-request-card ui-card">
            <div className="friends-section-heading">
              <div className="friends-section-icon received-icon">↓</div>
              <div><h2>Đã nhận</h2><p>Những người muốn kết nối với ông</p></div>
              <span className="friends-count-pill">{received.length}</span>
            </div>
            {received.length === 0 ? <EmptyRequests icon="✉" title="Chưa có lời mời nào" description="Khi có người gửi lời mời kết bạn, thông tin sẽ xuất hiện tại đây." /> : (
              <div className="friends-request-list">
                {received.map((r) => (
                  <div key={r.id} className="friends-request-item">
                    <Avatar src={r.senderAvatar} name={r.senderDisplayName} size={48} />
                    <div className="friends-person-info">
                      <strong>{r.senderDisplayName}</strong>
                      <span>@{r.senderUsername}</span>
                      <small>Muốn kết nối với bạn</small>
                    </div>
                    <div className="friends-request-actions">
                      <button className="ui-button ui-button--primary friends-accept-button" onClick={() => accept(r.id, r.senderId)}>Chấp nhận</button>
                      <button className="ui-button ui-button--quiet friends-reject-button" onClick={() => reject(r.id)}>Từ chối</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="friends-request-card ui-card">
            <div className="friends-section-heading">
              <div className="friends-section-icon sent-icon">↗</div>
              <div><h2>Đã gửi</h2><p>Những lời mời đang chờ phản hồi</p></div>
              <span className="friends-count-pill">{sent.length}</span>
            </div>
            {sent.length === 0 ? <EmptyRequests icon="➤" title="Chưa gửi lời mời nào" description="Các lời mời ông gửi đi sẽ được tổng hợp tại đây để tiện theo dõi." /> : (
              <div className="friends-request-list">
                {sent.map((r) => (
                  <div key={r.id} className="friends-request-item friends-sent-item">
                    <div className="friends-sent-avatar" aria-hidden="true">↗</div>
                    <div className="friends-person-info">
                      <strong>Người dùng #{r.receiverId}</strong>
                      <span>Lời mời kết bạn đã gửi</span>
                    </div>
                    <span className="friends-pending-pill"><i /> Đang chờ</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>}
      </div>
    </div>
  )
}
