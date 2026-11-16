import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, useToast } from "../components/ui"
import { friendApi } from "../api/friendApi"
import { userApi } from "../api/userApi"
import { conversationApi } from "../api/conversationApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { friendOf } from "../utils/format"

export default function FriendsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { friendsSection } = useParams()
  const toast = useToast()
  const [state, setState] = useState({ received: [], sent: [], friends: [], people: [], loading: true, error: "" })
  const [query, setQuery] = useState("")
  const [busyIds, setBusyIds] = useState([])

  const load = useCallback(async () => {
    try {
      const [received, sent, accepted, people] = await Promise.all([friendApi.received(), friendApi.sent(), friendApi.accepted(), userApi.search("")])
      const friends = (accepted.data || []).map((r) => friendOf(r, user?.userId))
      const excluded = new Set([
        String(user?.userId),
        ...friends.map((f) => String(f.id)),
        ...(sent.data || []).map((r) => String(r.receiverId)),
        ...(received.data || []).map((r) => String(r.senderId)),
      ])
      const suggestions = (people.data || []).filter((p) => p.status === "ACTIVE" && !excluded.has(String(p.userId)))
      for (let i = suggestions.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const current = suggestions[i]
        suggestions[i] = suggestions[j]
        suggestions[j] = current
      }
      setState({
        received: received.data || [],
        sent: sent.data || [],
        friends,
        people: suggestions,
        loading: false,
        error: "",
      })
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Không tải được dữ liệu bạn bè." }))
    }
  }, [user?.userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refreshRequests = () => {
      Promise.all([friendApi.received(), friendApi.sent()])
        .then(([received, sent]) => setState((current) => ({
          ...current,
          received: received.data || [],
          sent: sent.data || [],
        })))
        .catch(() => {})
    }
    const timer = window.setInterval(refreshRequests, 20000)
    window.addEventListener("focus", refreshRequests)
    window.addEventListener("cmctalk-notifications-updated", refreshRequests)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refreshRequests)
      window.removeEventListener("cmctalk-notifications-updated", refreshRequests)
    }
  }, [])

  useEffect(() => {
    setQuery("")
  }, [friendsSection])

  const run = async (key, fn, done) => {
    setBusyIds((b) => [...b, key])
    try {
      await fn()
      if (done) toast(done)
      await load()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể thực hiện thao tác."), "error")
    } finally {
      setBusyIds((b) => b.filter((x) => x !== key))
    }
  }

  const accept = async (req) => {
    await run(`r${req.id}`, async () => {
      await friendApi.accept(req.id)
      await conversationApi.getOrCreatePrivate(req.senderId).catch(() => {})
      window.dispatchEvent(new Event("cmctalk-conversations-updated"))
    }, "Đã chấp nhận lời mời kết bạn.")
  }

  const message = async (friendId) => {
    try {
      const { data } = await conversationApi.getOrCreatePrivate(friendId)
      navigate(`/messages/${data.conversationId}`)
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể mở cuộc trò chuyện."), "error")
    }
  }

  const openProfileFromCard = (event, profileId) => {
    if (event.target.closest("button")) return
    navigate(`/profile/${profileId}`)
  }
  const openProfileFromCardKey = (event, profileId) => {
    if (event.target.closest("button")) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      navigate(`/profile/${profileId}`)
    }
  }

  const q = query.trim().toLowerCase()
  const match = (name) => !q || (name || "").toLowerCase().includes(q)
  const friends = state.friends.filter((f) => match(f.name))
  const sent = state.sent.filter((r) => match(r.receiverDisplayName) || match(r.receiverUsername))
  const people = state.people.filter((p) => match(p.displayName) || match(p.username))
  const sectionTitles = { sent: "Lời mời đã gửi", friends: "Bạn bè của bạn", suggestions: "Gợi ý cho bạn" }
  const searchPlaceholders = { sent: "Tìm lời mời đã gửi", friends: "Tìm bạn bè", suggestions: "Tìm gợi ý kết bạn" }

  return (
    <div className="directory-page">
      <header className="page-title-row">
        <div>
          {friendsSection ? (
            <>
              <button type="button" className="directory-back" onClick={() => navigate("/friends")}>
                <span><Icon name="arrow" /></span> Bạn bè
              </button>
              <h1>{sectionTitles[friendsSection] || "Danh sách bạn bè"}</h1>
              <p>Danh sách đầy đủ trong mục này.</p>
            </>
          ) : (
            <>
              <h1>Bạn bè</h1>
              <p>Kết nối với bạn học và những người bạn có thể biết.</p>
            </>
          )}
        </div>
        {friendsSection && <label className="inline-search">
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholders[friendsSection] || "Tìm trong danh sách"} />
        </label>}
      </header>
      {state.loading && <Loading />}
      {state.error && <ErrorBlock message={state.error} onRetry={load} />}
      {!state.loading && !state.error && (
        <>
          {!friendsSection && state.received.length > 0 && (
            <section className="request-strip">
              <div>
                <h2>Lời mời kết bạn</h2>
                <span>{state.received.length} lời mời mới</span>
              </div>
              <div className="request-list">
                {state.received.map((r) => (
                  <article key={r.id}>
                    <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${r.senderId}`)}><Avatar name={r.senderDisplayName} src={r.senderAvatar} size="lg" /></span>
                    <div>
                      <h3>{r.senderDisplayName}</h3>
                      <p>@{r.senderUsername}</p>
                    </div>
                    <div>
                      <Button disabled={busyIds.includes(`r${r.id}`)} onClick={() => accept(r)}>Chấp nhận</Button>
                      <Button variant="secondary" disabled={busyIds.includes(`r${r.id}`)} onClick={() => run(`r${r.id}`, () => friendApi.reject(r.id))}>Xóa</Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {(!friendsSection || friendsSection === "sent") && (
            <>
              <div className="section-title">
                <h2>Lời mời đã gửi ({sent.length})</h2>
                {!friendsSection && <button type="button" onClick={() => navigate("/friends/sent")}>Xem tất cả</button>}
              </div>
              {sent.length === 0 ? <EmptyState title="Không có lời mời đã gửi" icon="users" /> : <div className="people-grid">
                {sent.slice(0, friendsSection === "sent" ? sent.length : 4).map((r) => (
                  <article className="person-card person-card-link" key={r.id} role="link" tabIndex={0} onClick={(event) => openProfileFromCard(event, r.receiverId)} onKeyDown={(event) => openProfileFromCardKey(event, r.receiverId)}>
                    <div className="person-cover" />
                    <Avatar name={r.receiverDisplayName} src={r.receiverAvatar} size="lg" />
                    <h3>{r.receiverDisplayName}</h3>
                    <p>@{r.receiverUsername}</p>
                    <Button variant="secondary" disabled={busyIds.includes(`s${r.id}`)} onClick={() => run(`s${r.id}`, () => friendApi.cancel(r.id), "Đã hủy lời mời.")}>Hủy lời mời</Button>
                  </article>
                ))}
              </div>}
            </>
          )}
          {(!friendsSection || friendsSection === "friends") && <>
            <div className="section-title">
              <h2>Bạn bè của bạn ({friends.length})</h2>
              {!friendsSection && <button type="button" onClick={() => navigate("/friends/friends")}>Xem tất cả</button>}
            </div>
            {friends.length === 0 ? (
              <EmptyState title="Chưa có bạn bè" copy="Gửi lời mời kết bạn ở phần gợi ý bên dưới." icon="users" />
            ) : (
              <div className="people-grid">
                {friends.slice(0, friendsSection === "friends" ? friends.length : 4).map((f, i) => (
                <article className="person-card person-card-link" key={f.id} role="link" tabIndex={0} onClick={(event) => openProfileFromCard(event, f.id)} onKeyDown={(event) => openProfileFromCardKey(event, f.id)}>
                  <div className={`person-cover pc${i % 4}`} />
                  <span><Avatar name={f.name} src={f.avatar} size="lg" /></span>
                  <h3>{f.name}</h3>
                  <p>@{f.username || f.name}</p>
                  <Button variant="secondary" icon="message" onClick={() => message(f.id)}>Nhắn tin</Button>
                </article>
              ))}
              </div>
            )}
          </>}
          {(!friendsSection || friendsSection === "suggestions") && <>
            <div className="section-title">
              <h2>Gợi ý cho bạn</h2>
              {!friendsSection && <button type="button" onClick={() => navigate("/friends/suggestions")}>Xem tất cả</button>}
            </div>
            {people.length === 0 ? (
              <EmptyState title="Không có gợi ý nào" copy="Bạn đã kết nối với tất cả mọi người." icon="users" />
            ) : (
              <div className="people-grid">
                {people.slice(0, friendsSection === "suggestions" ? people.length : 4).map((p, i) => (
                <article className="person-card person-card-link" key={p.userId} role="link" tabIndex={0} onClick={(event) => openProfileFromCard(event, p.userId)} onKeyDown={(event) => openProfileFromCardKey(event, p.userId)}>
                  <div className={`person-cover pc${i % 4}`} />
                  <span><Avatar name={p.displayName} src={p.avatar} size="lg" /></span>
                  <h3>{p.displayName}</h3>
                  <p>{p.education || `@${p.username}`}</p>
                  <Button variant="secondary" icon="plus" disabled={busyIds.includes(`p${p.userId}`)} onClick={() => run(`p${p.userId}`, () => friendApi.send(p.userId), "Đã gửi lời mời kết bạn.")}>Thêm bạn bè</Button>
                </article>
              ))}
              </div>
            )}
          </>}
        </>
      )}
    </div>
  )
}
