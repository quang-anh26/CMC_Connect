import React, { useEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { friendApi } from '../api/friendApi'
import { conversationApi } from '../api/conversationApi'
import { userApi } from '../api/userApi'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, FriendsIcon, MailIcon, PlusIcon, SendIcon, UserPlusIcon } from '../components/Icons'
import '../styles/friends-suggestions.css'

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
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState('')
  const [suggestionActionError, setSuggestionActionError] = useState('')
  const [sendingRequestIds, setSendingRequestIds] = useState([])
  const [sentRequestIds, setSentRequestIds] = useState([])
  const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState([])
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const suggestionRailRef = useRef(null)
  const showingAllSuggestions = location.pathname === '/friends/suggestions'

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

  const loadSuggestions = async () => {
    setSuggestionsLoading(true)
    setSuggestionsError('')
    try {
      const [usersRes, acceptedRes, sentRes, receivedRes] = await Promise.all([
        userApi.search(''),
        friendApi.accepted(),
        friendApi.sent(),
        friendApi.received(),
      ])
      const excludedIds = new Set([
        ...(acceptedRes.data || []).flatMap((request) => [request.senderId, request.receiverId]),
        ...(sentRes.data || []).map((request) => request.receiverId),
        ...(receivedRes.data || []).map((request) => request.senderId),
      ].filter((id) => id != null).map(String))
      const currentUserId = user?.userId == null ? null : String(user.userId)
      const eligibleUsers = (usersRes.data || []).filter((candidate) => {
        const candidateId = String(candidate.userId)
        return candidateId !== currentUserId
          && candidate.status === 'ACTIVE'
          && candidate.friendshipStatus !== 'ACCEPTED'
          && candidate.friendshipStatus !== 'PENDING'
          && !excludedIds.has(candidateId)
      })
      setSuggestions(eligibleUsers)
      setSentRequestIds((sentRes.data || []).map((request) => String(request.receiverId)))
    } catch {
      setSuggestionsError('Không tải được danh sách gợi ý kết bạn. Vui lòng thử lại.')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadSuggestions()
  }, [user?.userId])

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

  const sendFriendRequest = async (receiverId) => {
    const id = String(receiverId)
    if (sendingRequestIds.includes(id) || sentRequestIds.includes(id)) return
    setSuggestionActionError('')
    setSendingRequestIds((current) => [...current, id])
    try {
      await friendApi.send(receiverId)
      setSentRequestIds((current) => [...current, id])
    } catch (err) {
      setSuggestionActionError(err.response?.data?.message || 'Không thể gửi lời mời kết bạn. Vui lòng thử lại.')
    } finally {
      setSendingRequestIds((current) => current.filter((sendingId) => sendingId !== id))
    }
  }

  const hideSuggestion = (userId) => {
    const id = String(userId)
    setHiddenSuggestionIds((current) => current.includes(id) ? current : [...current, id])
  }

  const visibleSuggestions = suggestions.filter(
    (candidate) => !hiddenSuggestionIds.includes(String(candidate.userId))
  )

  const scrollSuggestions = (direction) => {
    const rail = suggestionRailRef.current
    if (!rail) return
    const card = rail.querySelector('.friends-suggestion-card')
    const distance = card ? card.getBoundingClientRect().width + 14 : rail.clientWidth * 0.8
    rail.scrollBy({ left: direction * distance * 2, behavior: 'smooth' })
  }

  const renderSuggestionCard = (candidate) => {
    const candidateId = String(candidate.userId)
    const requestSent = sentRequestIds.includes(candidateId)
    const sending = sendingRequestIds.includes(candidateId)
    const detail = candidate.bio || candidate.location
    // Màu nền thẻ ổn định theo từng người dùng (cùng id luôn ra cùng màu)
    const hue = (Array.from(String(candidate.userId)).reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) * 47) % 360
    return (
      <article className="friends-suggestion-card" key={candidate.userId}>
        <div className="friends-suggestion-photo" style={{ '--card-hue': hue }}>
          <Avatar
            className="friends-suggestion-avatar"
            src={candidate.avatar}
            name={candidate.displayName || candidate.username}
            size={112}
          />
          <button
            type="button"
            className="friends-suggestion-hide"
            onClick={() => hideSuggestion(candidate.userId)}
            aria-label={`Ẩn gợi ý ${candidate.displayName || candidate.username}`}
            title="Ẩn gợi ý"
          >
            ×
          </button>
        </div>
        <div className="friends-suggestion-info">
          <strong>{candidate.displayName || candidate.username}</strong>
          {candidate.username && <span className="friends-suggestion-handle">@{candidate.username}</span>}
          {detail && <small title={detail}>{detail}</small>}
        </div>
        <button
          type="button"
          className={`friends-suggestion-button ${requestSent ? 'is-sent' : ''}`}
          disabled={requestSent || sending}
          onClick={() => sendFriendRequest(candidate.userId)}
        >
          <span className="friends-suggestion-button-icon" aria-hidden="true">{requestSent ? <CheckIcon size="1em" /> : <PlusIcon size="1em" />}</span>
          {sending ? 'Đang gửi...' : requestSent ? 'Đã gửi lời mời' : 'Thêm bạn bè'}
        </button>
      </article>
    )
  }

  if (showingAllSuggestions) {
    return (
      <main className="chat-area friends-page friends-all-suggestions">
        <header className="friends-page-topbar">
          <button type="button" className="friends-suggestions-back" onClick={() => navigate('/friends')}>
            <ArrowLeftIcon size="1.1em" /> <span>Quay lại</span>
          </button>
          <div className="friends-topbar-copy">
            <span className="friends-eyebrow">CMC TALK · KẾT NỐI BẠN BÈ</span>
            <strong>Những người bạn có thể biết</strong>
          </div>
        </header>
        <section className="friends-all-suggestions-content" aria-labelledby="friends-all-title">
          <div className="friends-all-suggestions-heading">
            <div>
              <span className="friends-kicker">KẾT NỐI MỚI</span>
              <h1 id="friends-all-title">Những người bạn có thể biết</h1>
              <p>Khám phá và kết nối với những người bạn mới.</p>
            </div>
          </div>
          {suggestionActionError && <p className="friends-suggestion-error" role="alert">{suggestionActionError}</p>}
          {suggestionsLoading ? (
            <div className="friends-suggestions-state"><LoadingState label="Đang tải gợi ý..." /></div>
          ) : suggestionsError ? (
            <div className="friends-suggestions-state">
              <ErrorState compact message={suggestionsError} onRetry={loadSuggestions} />
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <EmptyRequests
              icon={<FriendsIcon size={28} />}
              title="Chưa có gợi ý phù hợp"
              description="Hiện không còn tài khoản nào phù hợp để gợi ý."
            />
          ) : (
            <div className="friends-suggestion-grid friends-all-suggestion-grid">
              {visibleSuggestions.map(renderSuggestionCard)}
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <div className="chat-area friends-page">
      <header className="friends-page-topbar">
        <div className="friends-brand-mark" aria-hidden="true"><FriendsIcon size={22} /></div>
        <div className="friends-topbar-copy">
          <span className="friends-eyebrow">CMC TALK · KẾT NỐI BẠN BÈ</span>
          <strong>Lời mời kết bạn</strong>
        </div>
        <div className="friends-topbar-count"><span>{received.length + sent.length}</span> lời mời</div>
      </header>

      <div className="friend-panel friends-page-content">
        <section className="friends-suggestions" aria-labelledby="friends-suggestions-title">
          <div className="friends-suggestions-heading">
            <div>
              <span className="friends-kicker">KẾT NỐI MỚI</span>
              <h2 id="friends-suggestions-title">Gợi ý kết bạn</h2>
            </div>
            {!suggestionsLoading && !suggestionsError && visibleSuggestions.length > 0 && (
              <button
                type="button"
                className="friends-suggestions-view-all"
                onClick={() => navigate('/friends/suggestions')}
              >
                Xem tất cả
              </button>
            )}
          </div>
          {suggestionsLoading ? (
            <div className="friends-suggestions-state"><LoadingState label="Đang tải gợi ý..." /></div>
          ) : suggestionsError ? (
            <div className="friends-suggestions-state">
              <ErrorState compact message={suggestionsError} onRetry={loadSuggestions} />
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <EmptyRequests
              icon={<FriendsIcon size={28} />}
              title="Chưa có gợi ý phù hợp"
              description="Hiện không còn tài khoản nào phù hợp để gợi ý."
            />
          ) : (
            <>
              {suggestionActionError && <p className="friends-suggestion-error" role="alert">{suggestionActionError}</p>}
              <div className="friends-suggestion-carousel">
                {visibleSuggestions.length > 4 && (
                  <button
                    type="button"
                    className="friends-suggestion-arrow is-left"
                    aria-label="Xem gợi ý trước"
                    onClick={() => scrollSuggestions(-1)}
                  >
                    ‹
                  </button>
                )}
                <div className="friends-suggestion-grid friends-suggestion-rail" ref={suggestionRailRef}>
                  {visibleSuggestions.map(renderSuggestionCard)}
                </div>
                {visibleSuggestions.length > 4 && (
                  <button
                    type="button"
                    className="friends-suggestion-arrow is-right"
                    aria-label="Xem gợi ý tiếp theo"
                    onClick={() => scrollSuggestions(1)}
                  >
                    ›
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {loading && <div className="friends-feedback-card"><LoadingState label="Đang tải lời mời..." /></div>}
        {!loading && error && <div className="friends-feedback-card"><ErrorState title="Không tải được lời mời" message={error} onRetry={retry} /></div>}

        {!loading && !error && <div className="friends-requests-grid">
          <section className="friends-request-card ui-card">
            <div className="friends-section-heading">
              <div className="friends-section-icon received-icon"><UserPlusIcon size={18} /></div>
              <div><h2>Đã nhận</h2><p>Những người muốn kết nối với ông</p></div>
              <span className="friends-count-pill">{received.length}</span>
            </div>
            {received.length === 0 ? <EmptyRequests icon={<MailIcon size={28} />} title="Chưa có lời mời nào" description="Khi có người gửi lời mời kết bạn, thông tin sẽ xuất hiện tại đây." /> : (
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
              <div className="friends-section-icon sent-icon"><SendIcon size={17} /></div>
              <div><h2>Đã gửi</h2><p>Những lời mời đang chờ phản hồi</p></div>
              <span className="friends-count-pill">{sent.length}</span>
            </div>
            {sent.length === 0 ? <EmptyRequests icon={<SendIcon size={28} />} title="Chưa gửi lời mời nào" description="Các lời mời ông gửi đi sẽ được tổng hợp tại đây để tiện theo dõi." /> : (
              <div className="friends-request-list">
                {sent.map((r) => (
                  <div key={r.id} className="friends-request-item friends-sent-item">
                    <div className="friends-sent-avatar" aria-hidden="true"><SendIcon size={18} /></div>
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
