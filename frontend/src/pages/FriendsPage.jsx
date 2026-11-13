import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
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
      setState({
        received: received.data || [],
        sent: sent.data || [],
        friends,
        people: (people.data || []).filter((p) => p.status === "ACTIVE" && !excluded.has(String(p.userId))),
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

  const q = query.trim().toLowerCase()
  const match = (name) => !q || (name || "").toLowerCase().includes(q)
  const friends = state.friends.filter((f) => match(f.name))
  const people = state.people.filter((p) => match(p.displayName) || match(p.username))

  return (
    <div className="directory-page">
      <header className="page-title-row">
        <div>
          <h1>Bạn bè</h1>
          <p>Kết nối với bạn học và những người bạn có thể biết.</p>
        </div>
        <label className="inline-search">
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm bạn bè" />
        </label>
      </header>
      {state.loading && <Loading />}
      {state.error && <ErrorBlock message={state.error} onRetry={load} />}
      {!state.loading && !state.error && (
        <>
          {state.received.length > 0 && (
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
          {state.sent.length > 0 && (
            <>
              <div className="section-title"><h2>Lời mời đã gửi</h2></div>
              <div className="people-grid">
                {state.sent.map((r) => (
                  <article className="person-card" key={r.id}>
                    <div className="person-cover" />
                    <Avatar name={r.receiverDisplayName} src={r.receiverAvatar} size="lg" />
                    <h3>{r.receiverDisplayName}</h3>
                    <p>@{r.receiverUsername}</p>
                    <Button variant="secondary" disabled={busyIds.includes(`s${r.id}`)} onClick={() => run(`s${r.id}`, () => friendApi.cancel(r.id), "Đã hủy lời mời.")}>Hủy lời mời</Button>
                  </article>
                ))}
              </div>
            </>
          )}
          <div className="section-title"><h2>Bạn bè của bạn ({friends.length})</h2></div>
          {friends.length === 0 ? (
            <EmptyState title="Chưa có bạn bè" copy="Gửi lời mời kết bạn ở phần gợi ý bên dưới." icon="users" />
          ) : (
            <div className="people-grid">
              {friends.map((f, i) => (
                <article className="person-card" key={f.id}>
                  <div className={`person-cover pc${i % 4}`} />
                  <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${f.id}`)}><Avatar name={f.name} src={f.avatar} size="lg" /></span>
                  <h3>{f.name}</h3>
                  <p>Bạn bè</p>
                  <Button variant="secondary" icon="message" onClick={() => message(f.id)}>Nhắn tin</Button>
                </article>
              ))}
            </div>
          )}
          <div className="section-title"><h2>Gợi ý cho bạn</h2></div>
          {people.length === 0 ? (
            <EmptyState title="Không có gợi ý nào" copy="Bạn đã kết nối với tất cả mọi người." icon="users" />
          ) : (
            <div className="people-grid">
              {people.map((p, i) => (
                <article className="person-card" key={p.userId}>
                  <div className={`person-cover pc${i % 4}`} />
                  <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${p.userId}`)}><Avatar name={p.displayName} src={p.avatar} size="lg" /></span>
                  <h3>{p.displayName}</h3>
                  <p>{p.education || `@${p.username}`}</p>
                  <Button variant="secondary" icon="plus" disabled={busyIds.includes(`p${p.userId}`)} onClick={() => run(`p${p.userId}`, () => friendApi.send(p.userId), "Đã gửi lời mời kết bạn.")}>Thêm bạn bè</Button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
