import React, { useEffect, useRef, useState } from "react"
import { useNavigate, useOutletContext, useParams } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useAsync, useToast } from "../components/ui"
import { Composer, PostCard } from "../components/Posts"
import { userApi } from "../api/userApi"
import { feedApi } from "../api/feedApi"
import { friendApi } from "../api/friendApi"
import { conversationApi } from "../api/conversationApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { friendOf, mediaUrl } from "../utils/format"

function EditModal({ profile, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ displayName: profile.displayName || "", bio: profile.bio || "", education: profile.education || "", location: profile.location || "" })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async () => {
    setBusy(true)
    try { await userApi.updateProfile(form); toast("Đã cập nhật trang cá nhân."); onSaved() } catch (err) { toast(getApiErrorMessage(err, "Không thể cập nhật."), "error") } finally { setBusy(false) }
  }
  return (
    <Modal title="Chỉnh sửa trang cá nhân" close={onClose}>
      <div className="form-grid">
        <label className="full">Tên hiển thị<input value={form.displayName} maxLength={100} onChange={set("displayName")} /></label>
        <label className="full">Giới thiệu<textarea rows={3} value={form.bio} onChange={set("bio")} /></label>
        <label>Học tập<input value={form.education} onChange={set("education")} placeholder="Ngành, khóa..." /></label>
        <label>Nơi sống<input value={form.location} onChange={set("location")} /></label>
      </div>
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={busy || !form.displayName.trim()} onClick={submit}>Lưu thay đổi</Button></div>
    </Modal>
  )
}

export default function ProfilePage() {
  const { profileUserId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { me } = useOutletContext()
  const coverRef = useRef(null)
  const avatarRef = useRef(null)
  const [tab, setTab] = useState("posts")
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const targetId = profileUserId || user?.userId
  const mine = String(targetId) === String(user?.userId)
  const profile = useAsync(() => userApi.getById(targetId).then((r) => r.data), [targetId])
  const feed = useAsync(() => feedApi.list().then((r) => r.data || []), [targetId])
  const p = profile.data
  const posts = (feed.data || []).filter((x) => String(x.authorId) === String(targetId))
  const photos = posts.filter((x) => x.imageUrl && String(x.mediaType).toUpperCase() !== "VIDEO")

  useEffect(() => {
    if (tab !== "friends" || !mine) return
    let active = true
    setFriendsLoading(true)
    friendApi.accepted().then(({ data }) => {
      if (active) setFriends((data || []).map((r) => friendOf(r, user?.userId)))
    }).catch(() => {
      if (active) toast("Không tải được danh sách bạn bè.", "error")
    }).finally(() => { if (active) setFriendsLoading(false) })
    return () => { active = false }
  }, [tab, mine, user?.userId])

  const upload = async (fn, e, ok) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try { await fn(file); toast(ok); profile.reload(); window.dispatchEvent(new Event("cmctalk-profile-updated")) } catch (err) { toast(getApiErrorMessage(err, "Không thể tải ảnh lên."), "error") }
  }
  const message = async () => {
    try { const { data } = await conversationApi.getOrCreatePrivate(targetId); navigate(`/messages/${data.conversationId}`) } catch (err) { toast(getApiErrorMessage(err, "Không thể mở cuộc trò chuyện."), "error") }
  }
  const addFriend = async () => {
    try { await friendApi.send(targetId); toast("Đã gửi lời mời kết bạn."); profile.reload() } catch (err) { toast(getApiErrorMessage(err, "Không thể gửi lời mời."), "error") }
  }
  const replacePost = (post) => feed.setData((feed.data || []).map((x) => (x.postId === post.postId ? post : x)))

  if (profile.loading) return <Loading />
  if (profile.error) return <ErrorBlock message={profile.error} onRetry={profile.reload} />
  if (!p) return null

  return (
    <div className="profile-page">
      <div className="profile-hero">
        {p.coverImage ? <img src={mediaUrl(p.coverImage)} alt="Ảnh bìa" /> : <div className="cover-fallback" />}
        {mine && (
          <>
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => upload(userApi.uploadCover, e, "Đã đổi ảnh bìa.")} />
            <button onClick={() => coverRef.current?.click()}><Icon name="image" />Đổi ảnh bìa</button>
          </>
        )}
      </div>
      <section className="profile-summary">
        <span style={{ position: "relative", cursor: mine ? "pointer" : "default", marginTop: -45 }} onClick={() => mine && avatarRef.current?.click()} title={mine ? "Đổi ảnh đại diện" : undefined}>
          <Avatar name={p.displayName} src={p.avatar} size="xl" />
        </span>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => upload(userApi.uploadAvatar, e, "Đã đổi ảnh đại diện.")} />
        <div className="profile-identity">
          <h1>{p.displayName}</h1>
          <p>{p.education || `@${p.username}`}</p>
          <span>{p.location || "Thành viên CMC Talk"}{p.online ? " · Đang hoạt động" : ""}</span>
        </div>
        <div className="profile-actions">
          {mine ? (
            <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>Chỉnh sửa trang cá nhân</Button>
          ) : (
            <>
              <Button icon="message" onClick={message}>Nhắn tin</Button>
              {p.friendshipStatus === "ACCEPTED" ? <Button variant="secondary" icon="check" disabled>Bạn bè</Button>
                : p.friendshipStatus === "PENDING" ? <Button variant="secondary" disabled>Đã gửi lời mời</Button>
                : <Button variant="secondary" icon="user_plus" onClick={addFriend}>Kết bạn</Button>}
            </>
          )}
        </div>
      </section>
      <div className="profile-tabs">
        {[["posts", "Bài viết"], ["about", "Giới thiệu"], ...(mine ? [["friends", "Bạn bè"]] : []), ["photos", "Ảnh"]].map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="profile-content">
        <aside>
          <section className="panel intro-panel">
            <h3>Giới thiệu</h3>
            <p>{p.bio || "Chưa có giới thiệu."}</p>
            {p.education && <span><Icon name="forum" />{p.education}</span>}
            {p.location && <span><Icon name="location" />{p.location}</span>}
            {p.birthDate && <span><Icon name="calendar" />{new Date(p.birthDate).toLocaleDateString("vi-VN")}</span>}
            <span><Icon name="clock" />Tham gia {new Date(p.createdAt).toLocaleDateString("vi-VN")}</span>
          </section>
        </aside>
        <main>
          {tab === "posts" && (
            <>
              {mine && <Composer me={me || p} onPosted={(post) => feed.setData([post, ...(feed.data || [])])} />}
              {feed.loading && <Loading />}
              {!feed.loading && posts.length === 0 && <EmptyState title="Chưa có bài viết" copy="Các bài viết bạn có quyền xem sẽ hiển thị tại đây." icon="home" />}
              {posts.map((post) => <PostCard key={post.postId} post={post} meId={user?.userId} onChange={replacePost} onRemove={(id) => feed.setData((feed.data || []).filter((x) => x.postId !== id))} onShared={(c) => feed.setData([c, ...(feed.data || [])])} />)}
            </>
          )}
          {tab === "about" && (
            <section className="panel intro-panel" style={{ padding: 20 }}>
              <h3>Thông tin</h3>
              <p>Tên hiển thị: {p.displayName}</p><p>Username: @{p.username}</p>
              {p.relationshipStatus && <p>Tình trạng: {p.relationshipStatus}</p>}
              <p>{p.bio || "Chưa có giới thiệu."}</p>
            </section>
          )}
          {tab === "photos" && (photos.length === 0 ? <EmptyState title="Chưa có ảnh" icon="image" /> : <div className="photo-grid">{photos.map((x) => <img key={x.postId} src={mediaUrl(x.imageUrl)} alt="" />)}</div>)}
          {tab === "friends" && (friendsLoading ? <Loading label="Đang tải bạn bè..." /> : friends.length === 0 ? <EmptyState title="Chưa có bạn bè" icon="users" /> : <div className="profile-friends">{friends.map((friend) => <article className="panel" key={friend.id}><Avatar name={friend.name} src={friend.avatar} size="lg" /><div><strong>{friend.name}</strong></div><Button variant="secondary" onClick={() => navigate(`/profile/${friend.id}`)}>Trang cá nhân</Button></article>)}</div>)}
        </main>
      </div>
      {editing && <EditModal profile={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); profile.reload(); window.dispatchEvent(new Event("cmctalk-profile-updated")) }} />}
    </div>
  )
}
