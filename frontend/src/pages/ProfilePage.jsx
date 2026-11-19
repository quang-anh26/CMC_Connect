import React, { useEffect, useMemo, useRef, useState } from "react"
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
import "../styles/profile.css"

const RELATIONSHIPS = ["Độc thân", "Đang hẹn hò", "Đã đính hôn", "Đã kết hôn", "Mối quan hệ phức tạp"]
const BIO_MAX = 255

/* ---------- icon nhỏ dùng riêng cho trang này ---------- */
function PfIcon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }
  if (name === "cap") return <svg {...common}><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" /></svg>
  if (name === "cake") return <svg {...common}><path d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7Z" /><path d="M4 17c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0M12 12V8M12 5.5c.8-1 .8-1.6 0-2.5-.8.9-.8 1.5 0 2.5Z" /></svg>
  if (name === "camera") return <svg {...common}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg>
  if (name === "heart") return <svg {...common}><path d="M12 20s-7-4.4-9-9.2C1.7 7.5 3.6 4.5 6.8 4.5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.2 0 5.1 3 3.8 6.3C19 15.6 12 20 12 20Z" /></svg>
  if (name === "dots") return <svg {...common} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
  if (name === "chev-l") return <svg {...common}><path d="m15 5-7 7 7 7" /></svg>
  if (name === "chev-r") return <svg {...common}><path d="m9 5 7 7-7 7" /></svg>
  return null
}

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "")

/* ---------- Modal chỉnh sửa ---------- */
function EditModal({ profile, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    displayName: profile.displayName || "",
    bio: profile.bio || "",
    education: profile.education || "",
    location: profile.location || "",
    relationshipStatus: profile.relationshipStatus || "",
    birthDate: profile.birthDate ? String(profile.birthDate).slice(0, 10) : "",
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async () => {
    setBusy(true)
    try {
      const payload = { ...form }
      if (!payload.birthDate) delete payload.birthDate // backend bỏ qua giá trị null
      await userApi.updateProfile(payload)
      toast("Đã cập nhật trang cá nhân.")
      onSaved()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể cập nhật."), "error")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Chỉnh sửa trang cá nhân" close={onClose}>
      <div className="form-grid pf-form">
        <label className="full">Tên hiển thị<input value={form.displayName} maxLength={100} onChange={set("displayName")} /></label>
        <label className="full">
          <span className="pf-label-row">Tiểu sử<em>{form.bio.length}/{BIO_MAX}</em></span>
          <textarea rows={3} maxLength={BIO_MAX} value={form.bio} onChange={set("bio")} placeholder="Mô tả ngắn về bạn..." />
        </label>
        <label>Học tập<input value={form.education} maxLength={120} onChange={set("education")} placeholder="Ngành, khóa..." /></label>
        <label>Nơi sống<input value={form.location} maxLength={120} onChange={set("location")} placeholder="Thành phố, quốc gia..." /></label>
        <label>Tình trạng mối quan hệ
          <select value={form.relationshipStatus} onChange={set("relationshipStatus")}>
            <option value="">Không hiển thị</option>
            {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Ngày sinh<input type="date" value={form.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={set("birthDate")} /></label>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button disabled={busy || !form.displayName.trim()} onClick={submit}>Lưu thay đổi</Button>
      </div>
    </Modal>
  )
}

/* ---------- Xem ảnh phóng to ---------- */
function Lightbox({ photos, index, onClose, onIndex }) {
  const total = photos.length
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onIndex((index - 1 + total) % total)
      if (e.key === "ArrowRight") onIndex((index + 1) % total)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, total])
  const photo = photos[index]
  if (!photo) return null
  return (
    <div className="pf-lightbox" onClick={onClose}>
      <button type="button" className="pf-lb-close" aria-label="Đóng" onClick={onClose}><Icon name="close" size={22} /></button>
      {total > 1 && <button type="button" className="pf-lb-nav prev" aria-label="Ảnh trước" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + total) % total) }}><PfIcon name="chev-l" size={26} /></button>}
      <img src={mediaUrl(photo.imageUrl)} alt="" onClick={(e) => e.stopPropagation()} />
      {total > 1 && <button type="button" className="pf-lb-nav next" aria-label="Ảnh sau" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % total) }}><PfIcon name="chev-r" size={26} /></button>}
      <span className="pf-lb-count">{index + 1} / {total}</span>
    </div>
  )
}

/* ---------- 1 dòng thông tin ---------- */
function InfoRow({ icon, label, value, mine, addText, onAdd }) {
  if (!value && !mine) return null
  return (
    <div className="pf-row">
      <span className="pf-row-icon">{icon}</span>
      {value ? (
        <div><small>{label}</small><strong>{value}</strong></div>
      ) : (
        <button type="button" className="pf-add" onClick={onAdd}><span>+</span>{addText}</button>
      )}
    </div>
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
  const menuRef = useRef(null)
  const [tab, setTab] = useState("posts")
  const [aboutSection, setAboutSection] = useState("overview")
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendQuery, setFriendQuery] = useState("")
  const [editing, setEditing] = useState(false)
  const [friendMenu, setFriendMenu] = useState(false)
  const [viewer, setViewer] = useState(-1)
  const [friendActionBusy, setFriendActionBusy] = useState(false)
  const targetId = profileUserId || user?.userId
  const mine = String(targetId) === String(user?.userId)
  const profile = useAsync(() => userApi.getById(targetId).then((r) => r.data), [targetId])
  const feed = useAsync(() => feedApi.list().then((r) => r.data || []), [targetId])
  const p = profile.data
  const posts = useMemo(() => (feed.data || []).filter((x) => String(x.authorId) === String(targetId)), [feed.data, targetId])
  const photos = useMemo(() => posts.filter((x) => x.imageUrl && String(x.mediaType).toUpperCase() !== "VIDEO"), [posts])

  // Đổi sang trang cá nhân người khác -> về tab đầu
  useEffect(() => { setTab("posts"); setAboutSection("overview"); setFriendQuery(""); setViewer(-1) }, [targetId])

  // Danh sách bạn bè (API chỉ trả bạn của chính mình)
  useEffect(() => {
    if (!mine) { setFriends([]); return undefined }
    let active = true
    setFriendsLoading(true)
    friendApi.accepted().then(({ data }) => {
      if (active) setFriends((data || []).map((r) => friendOf(r, user?.userId)))
    }).catch(() => {
      if (active) toast("Không tải được danh sách bạn bè.", "error")
    }).finally(() => { if (active) setFriendsLoading(false) })
    return () => { active = false }
  }, [mine, user?.userId])

  // Đóng menu "Bạn bè" khi bấm ra ngoài
  useEffect(() => {
    if (!friendMenu) return undefined
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setFriendMenu(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [friendMenu])

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
  const acceptFriendRequest = async () => {
    if (!p?.friendRequestId || friendActionBusy) return
    setFriendActionBusy(true)
    try {
      await friendApi.accept(p.friendRequestId)
      await conversationApi.getOrCreatePrivate(targetId).catch(() => {})
      toast("Đã chấp nhận lời mời kết bạn.")
      profile.reload()
      window.dispatchEvent(new Event("cmctalk-notifications-updated"))
      window.dispatchEvent(new Event("cmctalk-conversations-updated"))
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể chấp nhận lời mời."), "error")
    } finally { setFriendActionBusy(false) }
  }
  const rejectFriendRequest = async () => {
    if (!p?.friendRequestId || friendActionBusy) return
    setFriendActionBusy(true)
    try {
      await friendApi.reject(p.friendRequestId)
      toast("Đã xóa lời mời kết bạn.")
      profile.reload()
      window.dispatchEvent(new Event("cmctalk-notifications-updated"))
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể xóa lời mời."), "error")
    } finally { setFriendActionBusy(false) }
  }
  const removeFriend = async () => {
    setFriendMenu(false)
    if (!window.confirm(`Bạn có chắc muốn hủy kết bạn với ${p?.displayName || "người này"}?`)) return
    setFriendActionBusy(true)
    try {
      await friendApi.remove(targetId)
      toast("Đã hủy kết bạn.")
      profile.reload()
      window.dispatchEvent(new Event("cmctalk-friends-updated"))
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể hủy kết bạn."), "error")
    } finally { setFriendActionBusy(false) }
  }
  const replacePost = (post) => feed.setData((current) => (current || []).map((item) => (
    item.postId === post.postId ? { ...item, ...post } : item
  )))

  if (profile.loading) return <Loading />
  if (profile.error) return <ErrorBlock message={profile.error} onRetry={profile.reload} />
  if (!p) return null

  const openEdit = () => setEditing(true)
  const filteredFriends = friends.filter((f) => `${f.name} ${f.username || ""}`.toLowerCase().includes(friendQuery.trim().toLowerCase()))
  const subline = [
    mine ? `${friends.length} người bạn` : null,
    `${posts.length} bài viết`,
  ].filter(Boolean).join(" · ")
  const tabs = [["posts", "Bài viết"], ["about", "Giới thiệu"], ...(mine ? [["friends", "Bạn bè"]] : []), ["photos", "Ảnh"]]

  const friendButton = () => {
    if (p.friendshipStatus === "ACCEPTED") {
      return (
        <div className="pf-menu-wrap" ref={menuRef}>
          <Button variant="secondary" icon="users" disabled={friendActionBusy} onClick={() => setFriendMenu((v) => !v)}>Bạn bè</Button>
          {friendMenu && (
            <div className="pf-menu" role="menu">
              <button type="button" role="menuitem" onClick={removeFriend}>Hủy kết bạn</button>
            </div>
          )}
        </div>
      )
    }
    if (p.friendshipStatus === "PENDING_SENT") return <Button variant="secondary" icon="clock" disabled>Đã gửi lời mời</Button>
    if (p.friendshipStatus === "PENDING_RECEIVED") {
      return (
        <>
          <Button disabled={friendActionBusy} icon="check" onClick={acceptFriendRequest}>Chấp nhận</Button>
          <Button variant="secondary" disabled={friendActionBusy} onClick={rejectFriendRequest}>Xóa lời mời</Button>
        </>
      )
    }
    return <Button icon="user_plus" onClick={addFriend}>Thêm bạn bè</Button>
  }

  const aboutRows = {
    overview: (
      <>
        <InfoRow icon={<PfIcon name="cap" />} label="Học tập" value={p.education} mine={mine} addText="Thêm nơi học tập" onAdd={openEdit} />
        <InfoRow icon={<Icon name="location" size={20} />} label="Sống tại" value={p.location} mine={mine} addText="Thêm nơi sống" onAdd={openEdit} />
        <InfoRow icon={<PfIcon name="heart" />} label="Mối quan hệ" value={p.relationshipStatus} mine={mine} addText="Thêm tình trạng mối quan hệ" onAdd={openEdit} />
        <InfoRow icon={<PfIcon name="cake" />} label="Sinh nhật" value={fmtDate(p.birthDate)} mine={mine} addText="Thêm ngày sinh" onAdd={openEdit} />
      </>
    ),
    education: <InfoRow icon={<PfIcon name="cap" />} label="Học tập" value={p.education} mine={mine} addText="Thêm nơi học tập" onAdd={openEdit} />,
    places: <InfoRow icon={<Icon name="location" size={20} />} label="Sống tại" value={p.location} mine={mine} addText="Thêm nơi sống" onAdd={openEdit} />,
    basic: (
      <>
        <InfoRow icon={<PfIcon name="cake" />} label="Ngày sinh" value={fmtDate(p.birthDate)} mine={mine} addText="Thêm ngày sinh" onAdd={openEdit} />
        <InfoRow icon={<PfIcon name="heart" />} label="Mối quan hệ" value={p.relationshipStatus} mine={mine} addText="Thêm tình trạng mối quan hệ" onAdd={openEdit} />
        <InfoRow icon={<Icon name="user_plus" size={20} />} label="Tên người dùng" value={`@${p.username}`} />
        <InfoRow icon={<Icon name="clock" size={20} />} label="Tham gia CMC Talk" value={fmtDate(p.createdAt)} />
      </>
    ),
  }
  const aboutNav = [["overview", "Tổng quan"], ["education", "Học tập"], ["places", "Nơi sống"], ["basic", "Thông tin cơ bản"]]
  const aboutHasData = {
    overview: !!(p.bio || p.education || p.location || p.relationshipStatus || p.birthDate),
    education: !!p.education,
    places: !!p.location,
    basic: true,
  }

  return (
    <div className="profile-page pf">
      <section className="pf-head">
        <div className="pf-cover">
          {p.coverImage ? <img src={mediaUrl(p.coverImage)} alt="Ảnh bìa" /> : <div className="pf-cover-fallback" />}
          {mine && (
            <>
              <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => upload(userApi.uploadCover, e, "Đã đổi ảnh bìa.")} />
              <button type="button" className="pf-cover-btn" onClick={() => coverRef.current?.click()}>
                <PfIcon name="camera" size={18} />{p.coverImage ? "Đổi ảnh bìa" : "Thêm ảnh bìa"}
              </button>
            </>
          )}
        </div>

        <div className="pf-id">
          <div className="pf-avatar">
            <button type="button" className="pf-avatar-btn" disabled={!mine} title={mine ? "Đổi ảnh đại diện" : undefined} onClick={() => mine && avatarRef.current?.click()}>
              <Avatar name={p.displayName} src={p.avatar} size="xl" />
            </button>
            {mine && <span className="pf-avatar-cam" aria-hidden="true"><PfIcon name="camera" size={16} /></span>}
            {p.online && <span className="pf-online-dot" title="Đang hoạt động" />}
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => upload(userApi.uploadAvatar, e, "Đã đổi ảnh đại diện.")} />
          </div>

          <div className="pf-info">
            <h1>{p.displayName}</h1>
            <p className="pf-username">@{p.username}{p.online ? <span className="pf-chip">Đang hoạt động</span> : null}</p>
            <p className="pf-sub">{subline}</p>
            {mine && friends.length > 0 && (
              <div className="pf-stack" aria-label="Bạn bè">
                {friends.slice(0, 8).map((f) => (
                  <button type="button" key={f.id} title={f.name} onClick={() => navigate(`/profile/${f.id}`)}>
                    <Avatar name={f.name} src={f.avatar} size="sm" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pf-actions">
            {mine ? (
              <Button variant="secondary" icon="edit" onClick={openEdit}>Chỉnh sửa trang cá nhân</Button>
            ) : (
              <>
                {friendButton()}
                <Button variant="secondary" icon="message" onClick={message}>Nhắn tin</Button>
              </>
            )}
          </div>
        </div>

        <nav className="pf-tabs" aria-label="Mục trang cá nhân">
          {tabs.map(([k, l]) => <button type="button" key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
      </section>

      <div className={`pf-body ${tab === "posts" ? "" : "single"}`}>
        {tab === "posts" && (
          <aside className="pf-aside">
            <section className="panel pf-card">
              <h3>Giới thiệu</h3>
              {p.bio ? <p className="pf-bio">{p.bio}</p> : mine ? <p className="pf-bio muted">Chưa có tiểu sử. Hãy giới thiệu đôi nét về bạn.</p> : <p className="pf-bio muted">Chưa có giới thiệu.</p>}
              {mine && <button type="button" className="pf-soft-btn" onClick={openEdit}>{p.bio ? "Chỉnh sửa tiểu sử" : "Thêm tiểu sử"}</button>}
              <div className="pf-list">
                {p.education && <span><PfIcon name="cap" size={18} />Học tập: <b>{p.education}</b></span>}
                {p.location && <span><Icon name="location" size={18} />Sống tại <b>{p.location}</b></span>}
                {p.relationshipStatus && <span><PfIcon name="heart" size={18} />{p.relationshipStatus}</span>}
                {p.birthDate && <span><PfIcon name="cake" size={18} />Sinh ngày <b>{fmtDate(p.birthDate)}</b></span>}
                <span><Icon name="clock" size={18} />Tham gia vào <b>{fmtDate(p.createdAt)}</b></span>
              </div>
              {mine && <button type="button" className="pf-soft-btn" onClick={openEdit}>Chỉnh sửa chi tiết</button>}
            </section>

            <section className="panel pf-card">
              <div className="pf-card-head"><h3>Ảnh</h3>{photos.length > 0 && <button type="button" onClick={() => setTab("photos")}>Xem tất cả ảnh</button>}</div>
              {photos.length === 0 ? <p className="pf-bio muted">Chưa có ảnh nào.</p> : (
                <div className="pf-mini-grid">
                  {photos.slice(0, 9).map((x, i) => <button type="button" key={x.postId} onClick={() => setViewer(i)}><img src={mediaUrl(x.imageUrl)} alt="" loading="lazy" /></button>)}
                </div>
              )}
            </section>

            {mine && (
              <section className="panel pf-card">
                <div className="pf-card-head"><h3>Bạn bè</h3>{friends.length > 0 && <button type="button" onClick={() => setTab("friends")}>Xem tất cả</button>}</div>
                <p className="pf-count">{friends.length} người bạn</p>
                {friendsLoading ? <Loading label="Đang tải..." /> : friends.length === 0 ? <p className="pf-bio muted">Chưa có bạn bè.</p> : (
                  <div className="pf-friend-grid">
                    {friends.slice(0, 9).map((f) => (
                      <button type="button" key={f.id} onClick={() => navigate(`/profile/${f.id}`)}>
                        <Avatar name={f.name} src={f.avatar} size="lg" />
                        <span>{f.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </aside>
        )}

        <main className="pf-main">
          {tab === "posts" && (
            <>
              {mine && <Composer me={me || p} onPosted={(post) => feed.setData([post, ...(feed.data || [])])} />}
              <div className="panel pf-title-bar"><h3>Bài viết</h3><span>{posts.length} bài</span></div>
              {feed.loading && <Loading />}
              {!feed.loading && posts.length === 0 && <EmptyState title="Chưa có bài viết" copy="Các bài viết bạn có quyền xem sẽ hiển thị tại đây." icon="home" />}
              {posts.map((post) => <PostCard key={post.postId} post={post} meId={user?.userId} onChange={replacePost} onRemove={(id) => feed.setData((feed.data || []).filter((x) => x.postId !== id))} onHide={(authorId) => feed.setData((current) => (current || []).filter((x) => String(x.authorId) !== String(authorId)))} onShared={(c) => feed.setData([c, ...(feed.data || [])])} />)}
            </>
          )}

          {tab === "about" && (
            <section className="panel pf-about">
              <nav className="pf-about-nav">
                <h3>Giới thiệu</h3>
                {aboutNav.map(([k, l]) => <button type="button" key={k} className={aboutSection === k ? "active" : ""} onClick={() => setAboutSection(k)}>{l}</button>)}
              </nav>
              <div className="pf-about-body">
                {aboutSection === "overview" && (p.bio || mine) && (
                  <div className="pf-about-bio">
                    <small>Tiểu sử</small>
                    <p className={p.bio ? "" : "muted"}>{p.bio || "Chưa có tiểu sử."}</p>
                    {mine && <button type="button" className="pf-soft-btn" onClick={openEdit}>{p.bio ? "Chỉnh sửa" : "Thêm tiểu sử"}</button>}
                  </div>
                )}
                {aboutRows[aboutSection]}
                {mine && <button type="button" className="pf-soft-btn wide" onClick={openEdit}>Chỉnh sửa thông tin</button>}
                {!mine && !aboutHasData[aboutSection] && <p className="muted">Không có thông tin để hiển thị.</p>}
              </div>
            </section>
          )}

          {tab === "photos" && (
            <section className="panel pf-card pf-wide">
              <div className="pf-card-head"><h3>Ảnh</h3><span>{photos.length} ảnh</span></div>
              {photos.length === 0 ? <EmptyState title="Chưa có ảnh" icon="image" /> : (
                <div className="pf-photo-grid">
                  {photos.map((x, i) => <button type="button" key={x.postId} onClick={() => setViewer(i)}><img src={mediaUrl(x.imageUrl)} alt="" loading="lazy" /></button>)}
                </div>
              )}
            </section>
          )}

          {tab === "friends" && mine && (
            <section className="panel pf-card pf-wide">
              <div className="pf-card-head">
                <h3>Bạn bè <em>{friends.length}</em></h3>
                <label className="pf-search"><Icon name="search" size={16} /><input value={friendQuery} onChange={(e) => setFriendQuery(e.target.value)} placeholder="Tìm bạn bè" /></label>
              </div>
              {friendsLoading ? <Loading label="Đang tải bạn bè..." /> : friends.length === 0 ? <EmptyState title="Chưa có bạn bè" icon="users" /> : filteredFriends.length === 0 ? <p className="pf-bio muted">Không tìm thấy bạn bè phù hợp.</p> : (
                <div className="pf-friend-cards">
                  {filteredFriends.map((f) => (
                    <article key={f.id}>
                      <button type="button" className="pf-friend-main" onClick={() => navigate(`/profile/${f.id}`)}>
                        <Avatar name={f.name} src={f.avatar} size="lg" />
                        <div><strong>{f.name}</strong>{f.username && <small>@{f.username}</small>}</div>
                      </button>
                      <Button variant="secondary" onClick={() => navigate(`/profile/${f.id}`)}>Xem trang</Button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {viewer >= 0 && photos.length > 0 && <Lightbox photos={photos} index={Math.min(viewer, photos.length - 1)} onClose={() => setViewer(-1)} onIndex={setViewer} />}
      {editing && <EditModal profile={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); profile.reload(); window.dispatchEvent(new Event("cmctalk-profile-updated")) }} />}
    </div>
  )
}
