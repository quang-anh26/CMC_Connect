import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, EmptyState, ErrorBlock, Loading, useAsync } from "../components/ui"
import { Composer, PostCard } from "../components/Posts"
import Stories from "../components/Stories"
import { feedApi } from "../api/feedApi"
import { eventApi } from "../api/eventApi"
import { friendApi } from "../api/friendApi"
import { presenceApi } from "../api/presenceApi"
import { conversationApi } from "../api/conversationApi"
import { useAuth } from "../context/AuthContext"
import { friendOf, monthShort } from "../utils/format"

export function UpcomingEvents() {
  const navigate = useNavigate()
  const { data } = useAsync(() => eventApi.list("UPCOMING").then((r) => r.data || []), [])
  const events = (data || []).slice(0, 2)
  return (
    <section className="aside-section">
      <div className="section-heading">
        <h3>Sự kiện sắp tới</h3>
        <button onClick={() => navigate("/events")}>Xem tất cả</button>
      </div>
      {events.length === 0 && <p className="aside-empty">Chưa có sự kiện sắp diễn ra.</p>}
      {events.map((e, i) => (
        <button className="mini-event" key={e.eventId} onClick={() => navigate(`/events/${e.eventId}`)}>
          <span className={`date-tile ${i % 2 ? "amber" : ""}`}>
            <b>{new Date(e.startsAt).getDate()}</b>
            <small>{monthShort(e.startsAt)}</small>
          </span>
          <span>
            <strong>{e.title}</strong>
            <small>
              {new Date(e.startsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {e.location}
            </small>
          </span>
        </button>
      ))}
    </section>
  )
}

export function OnlineFriends() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => {
    friendApi
      .accepted()
      .then(({ data }) => setFriends((data || []).map((r) => friendOf(r, user?.userId))))
      .catch(() => setFriends([]))
  }, [user?.userId])

  useEffect(() => {
    if (!friends.length) return undefined
    const poll = () =>
      presenceApi
        .online(friends.map((f) => f.id))
        .then(({ data }) => setOnlineIds(new Set((data?.onlineIds || []).map(String))))
        .catch(() => {})
    poll()
    const timer = setInterval(poll, 15000)
    return () => clearInterval(timer)
  }, [friends])

  const online = friends.filter((f) => onlineIds.has(String(f.id)))
  const open = async (friendId) => {
    try {
      const { data } = await conversationApi.getOrCreatePrivate(friendId)
      navigate(`/messages/${data.conversationId}`)
    } catch {
      navigate("/messages")
    }
  }

  return (
    <section className="aside-section">
      <div className="section-heading">
        <h3>Đang hoạt động</h3>
        <span className="online-label">{online.length} người</span>
      </div>
      <div className="online-list">
        {online.length === 0 && <p className="aside-empty">Hiện chưa có bạn bè nào trực tuyến.</p>}
        {online.slice(0, 6).map((f) => (
          <button key={f.id} onClick={() => open(f.id)}>
            <Avatar name={f.name} src={f.avatar} size="sm" online />
            <span>
              <strong>{f.name}</strong>
              <small>Đang hoạt động</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function FeedAside() {
  return (
    <aside className="feed-aside">
      <UpcomingEvents />
      <OnlineFriends />
      <div className="guideline-note">
        <Icon name="forum" />
        <div>
          <strong>Cùng giữ cộng đồng tích cực</strong>
          <p>Tôn trọng, hỗ trợ và kiểm chứng thông tin trước khi chia sẻ.</p>
        </div>
      </div>
    </aside>
  )
}

export default function FeedPage() {
  const { me } = useOutletContext()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const { data, loading, error, reload, setData } = useAsync(() => feedApi.list().then((r) => r.data || []), [])
  const focusPostId = params.get("postId")

  const update = useCallback((post) => setData((data || []).map((p) => (p.postId === post.postId ? post : p))), [data, setData])

  useEffect(() => {
    if (!focusPostId || !data) return
    document.getElementById(`post-${focusPostId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusPostId, data])

  return (
    <div className="feed-grid">
      <main className="feed-main">
        <Stories me={me} meId={user?.userId} />
        <Composer me={me} onPosted={(post) => setData([post, ...(data || [])])} />
        {loading && <Loading label="Đang tải bảng tin..." />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && (data || []).length === 0 && (
          <EmptyState title="Chưa có bài viết nào" copy="Hãy là người đầu tiên chia sẻ điều gì đó với cộng đồng." icon="home" />
        )}
        {(data || []).map((post) => (
          <PostCard
            key={post.postId}
            post={post}
            meId={user?.userId}
            onChange={update}
            onRemove={(id) => setData((data || []).filter((p) => p.postId !== id))}
            onShared={(created) => setData([created, ...(data || [])])}
          />
        ))}
      </main>
      <FeedAside />
    </div>
  )
}
