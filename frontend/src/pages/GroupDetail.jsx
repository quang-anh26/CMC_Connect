import React, { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useToast } from "../components/ui"
import { POST_REACTIONS } from "../components/Posts"
import axiosClient from "../api/axiosClient"
import { groupApi } from "../api/groupApi"
import { friendApi } from "../api/friendApi"
import { savedApi } from "../api/savedApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { friendOf, mediaUrl, timeAgo } from "../utils/format"

const TABS = ["Bài viết", "Thành viên", "Media", "Giới thiệu"]
const ROLE_LABEL = { OWNER: "Chủ nhóm", ADMIN: "Admin", MODERATOR: "Moderator", MEMBER: "Thành viên" }
const fmt = (v) => (v ? new Date(v).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "")
const asList = (d) => (Array.isArray(d) ? d : d?.content || [])

// Tệp trong nhóm cần xác thực nên tải bằng axios (kèm token) rồi hiển thị qua blob.
function GroupPostMedia({ post }) {
  const [source, setSource] = useState("")
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl = ""
    setSource("")
    setFailed(false)
    axiosClient.get(post.mediaUrl, { responseType: "blob" })
      .then(({ data }) => {
        objectUrl = URL.createObjectURL(data)
        if (active) setSource(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      })
      .catch(() => active && setFailed(true))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [post.mediaUrl])
  if (failed) return <p className="aside-empty" style={{ padding: "0 18px 12px" }}>Không thể tải tệp đính kèm.</p>
  if (!source) return <div className="group-media-loading" aria-label="Đang tải tệp đính kèm" />
  if (post.mediaType === "IMAGE") return <img className="post-image" src={source} alt="Tệp đính kèm bài viết" />
  if (post.mediaType === "VIDEO") return <video className="post-image" src={source} controls />
  return <a className="attachment-row" style={{ margin: "0 18px 12px", width: "auto" }} href={source} download target="_blank" rel="noreferrer"><Icon name="file" /><span><strong>Mở tệp đính kèm</strong></span><Icon name="download" size={18} /></a>
}

function PollCard({ post, canVote, onVote }) {
  const options = post.poll?.options || []
  const total = options.reduce((t, o) => t + o.votes, 0)
  const ended = post.poll?.endsAt && new Date(post.poll.endsAt) <= new Date()
  return (
    <section className="group-poll" aria-label="Bình chọn">
      {options.map((o) => (
        <button type="button" key={o.optionId} disabled={!canVote || ended} className={`poll-option ${o.selected ? "selected" : ""}`} onClick={() => onVote(post, o.optionId)}>
          <span className="poll-bar" style={{ width: `${total ? Math.round((o.votes * 100) / total) : 0}%` }} />
          <span className="poll-label">{o.label}</span><b>{o.votes}</b>
        </button>
      ))}
      <p>{total} lượt chọn{post.poll?.endsAt ? ` · ${ended ? "Đã kết thúc" : `Kết thúc ${fmt(post.poll.endsAt)}`}` : ""}</p>
    </section>
  )
}

export default function GroupDetail({ groupId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [friends, setFriends] = useState([])
  const [saved, setSaved] = useState({})
  const [tab, setTab] = useState("Bài viết")
  const [sort, setSort] = useState("NEWEST")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [composerMode, setComposerMode] = useState("POST")
  const [content, setContent] = useState("")
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState("")
  const [poll, setPoll] = useState({ question: "", options: ["", ""], endsAt: "" })
  const [posting, setPosting] = useState(false)
  const [openComments, setOpenComments] = useState({})
  const [commentDraft, setCommentDraft] = useState({})
  const [replyTo, setReplyTo] = useState(null)
  const [menu, setMenu] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [mod, setMod] = useState({ requests: [], posts: [], reports: [], bans: [] })
  const [eventForm, setEventForm] = useState(null)
  const [settings, setSettings] = useState(null)
  const fileRef = useRef(null)

  const role = group?.role
  const isMember = Boolean(group?.joined)
  const canModerate = ["OWNER", "ADMIN", "MODERATOR"].includes(role)
  const canAdmin = ["OWNER", "ADMIN"].includes(role)
  const privatePreview = group?.visibility === "PRIVATE" && !isMember
  const activeTab = privatePreview ? "Giới thiệu" : tab
  const fail = (e, fb) => toast(getApiErrorMessage(e, fb), "error")

  useEffect(() => {
    const close = (e) => !e.target.closest?.(".menu-wrap") && setMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])
  useEffect(() => {
    if (!file) return setFilePreview("")
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const loadModeration = useCallback(async () => {
    const [requests, pending, reports, bans] = await Promise.all([
      groupApi.joinRequests(groupId).catch(() => ({ data: [] })),
      groupApi.pendingPosts(groupId).catch(() => ({ data: [] })),
      groupApi.reports(groupId).catch(() => ({ data: [] })),
      groupApi.bans(groupId).catch(() => ({ data: [] })),
    ])
    setMod({ requests: requests.data || [], posts: pending.data || [], reports: reports.data || [], bans: bans.data || [] })
  }, [groupId])

  const loadGroup = useCallback(async () => {
    try {
      const { data } = await groupApi.get(groupId)
      setGroup(data)
      setSettings({ name: data.name, description: data.description || "", category: data.category || "", visibility: data.visibility, avatar: data.avatar || "", coverImage: data.coverImage || "", postApprovalRequired: Boolean(data.postApprovalRequired), spamKeywords: data.spamKeywords || "" })
      setError("")
      const canView = data.joined || data.visibility === "PUBLIC"
      const [p, m, ev] = await Promise.all([
        canView ? groupApi.posts(groupId, { search, sort, mediaOnly: tab === "Media" }) : Promise.resolve({ data: [] }),
        canView ? groupApi.members(groupId) : Promise.resolve({ data: [] }),
        canView ? groupApi.events(groupId) : Promise.resolve({ data: [] }),
      ])
      const list = asList(p.data)
      setPosts(list)
      setMembers(m.data || [])
      setEvents(ev.data || [])
      Promise.allSettled(list.slice(0, 20).map((post) => savedApi.status("GROUP_POST", post.postId))).then((rs) => {
        const next = {}
        rs.forEach((r, i) => { if (r.status === "fulfilled") next[list[i].postId] = Boolean(r.value.data?.saved) })
        setSaved(next)
      })
    } catch (e) {
      setError(e.response?.status === 403 ? "Bạn không có quyền truy cập nhóm này." : getApiErrorMessage(e, "Không thể tải nhóm."))
      setGroup(null)
    } finally {
      setLoading(false)
    }
  }, [groupId, search, sort, tab])

  useEffect(() => { const t = setTimeout(loadGroup, search ? 300 : 0); return () => clearTimeout(t) }, [loadGroup, search])
  useEffect(() => { if (canModerate) loadModeration() }, [canModerate, loadModeration])
  useEffect(() => {
    if (!isMember) return
    friendApi.accepted().then((r) => setFriends((r.data || []).map((x) => friendOf(x, user?.userId)))).catch(() => {})
  }, [isMember, user?.userId])

  const joinOrLeave = async () => {
    try {
      if (isMember) {
        if (!window.confirm("Rời khỏi nhóm này?")) return
        await groupApi.leave(groupId)
        toast("Đã rời nhóm.")
      } else {
        const { data } = await groupApi.join(groupId)
        toast(data?.status === "JOINED" ? "Đã tham gia nhóm." : "Đã gửi yêu cầu tham gia, vui lòng chờ duyệt.")
      }
      loadGroup()
    } catch (e) { fail(e, "Không thể thực hiện thao tác.") }
  }

  const submitPost = async (event) => {
    event.preventDefault()
    if (!content.trim() && !file) return
    setPosting(true)
    try {
      let mediaUrlValue = null
      let mediaType = null
      if (file) {
        const { data } = await groupApi.upload(groupId, file)
        mediaUrlValue = data.url
        mediaType = data.mediaType
      }
      await groupApi.createPost(groupId, { content: content.trim(), mediaUrl: mediaUrlValue, mediaType })
      setContent(""); setFile(null)
      toast(group.postApprovalRequired ? "Bài viết đã được gửi và đang chờ quản trị viên duyệt." : "Đã đăng bài.")
      loadGroup()
    } catch (e) { fail(e, "Không thể đăng bài.") } finally { setPosting(false) }
  }

  const submitPoll = async (event) => {
    event.preventDefault()
    const options = poll.options.map((o) => o.trim()).filter(Boolean)
    if (!poll.question.trim() || options.length < 2) return toast("Bình chọn cần câu hỏi và ít nhất 2 lựa chọn.", "error")
    setPosting(true)
    try {
      await groupApi.createPoll(groupId, { question: poll.question.trim(), options, endsAt: poll.endsAt || null })
      setPoll({ question: "", options: ["", ""], endsAt: "" }); setComposerMode("POST")
      toast("Đã tạo bình chọn.")
      loadGroup()
    } catch (e) { fail(e, "Không thể tạo bình chọn.") } finally { setPosting(false) }
  }

  const votePoll = async (post, optionId) => {
    try { const { data } = await groupApi.votePoll(groupId, post.postId, optionId); setPosts((l) => l.map((p) => (p.postId === post.postId ? data : p))) } catch (e) { fail(e, "Không thể bình chọn.") }
  }
  const react = async (post, type) => {
    try { const { data } = await groupApi.react(groupId, post.postId, type); setPosts((l) => l.map((p) => (p.postId === post.postId ? data : p))) } catch (e) { fail(e, "Không thể thả cảm xúc.") }
  }
  const comment = async (post, event) => {
    event.preventDefault()
    const text = (commentDraft[post.postId] || "").trim()
    if (!text) return
    try {
      await groupApi.comment(groupId, post.postId, { content: text, parentCommentId: replyTo?.postId === post.postId ? replyTo.commentId : null })
      setCommentDraft((d) => ({ ...d, [post.postId]: "" })); setReplyTo(null)
      loadGroup()
    } catch (e) { fail(e, "Không thể gửi bình luận.") }
  }
  const removeComment = async (commentId) => {
    if (!window.confirm("Xóa bình luận này?")) return
    try { await groupApi.removeComment(groupId, commentId); loadGroup() } catch (e) { fail(e, "Không thể xóa bình luận.") }
  }
  const removePost = async (post) => {
    setMenu(null)
    if (!window.confirm("Xóa bài viết này?")) return
    try { await groupApi.removePost(groupId, post.postId); setPosts((l) => l.filter((p) => p.postId !== post.postId)); toast("Đã xóa bài viết.") } catch (e) { fail(e, "Không thể xóa bài viết.") }
  }
  const editPost = async (post) => {
    setMenu(null)
    const next = window.prompt("Chỉnh sửa nội dung bài viết:", post.content || "")
    if (next == null || !next.trim()) return
    try { const { data } = await groupApi.updatePost(groupId, post.postId, { content: next.trim() }); setPosts((l) => l.map((p) => (p.postId === post.postId ? data : p))) } catch (e) { fail(e, "Không thể sửa bài viết.") }
  }
  const pin = async (post) => {
    setMenu(null)
    try { await groupApi.pin(groupId, post.postId); loadGroup() } catch (e) { fail(e, "Không thể ghim bài viết.") }
  }
  const reportPost = async (post) => {
    setMenu(null)
    const reason = window.prompt("Lý do báo cáo bài viết này:")
    if (!reason?.trim()) return
    try { await groupApi.report(groupId, { targetType: "POST", targetId: post.postId, reason: reason.trim() }); toast("Đã gửi báo cáo.") } catch (e) { fail(e, "Không thể gửi báo cáo.") }
  }
  const toggleSave = async (post) => {
    setMenu(null)
    try { const { data } = await savedApi.toggle("GROUP_POST", post.postId); setSaved((s) => ({ ...s, [post.postId]: Boolean(data.saved) })); toast(data.saved ? "Đã lưu bài viết." : "Đã bỏ lưu bài viết.") } catch (e) { fail(e, "Không thể lưu bài viết.") }
  }

  const manageMember = async (member, action) => {
    setMenu(null)
    try {
      if (action === "warn") {
        const reason = window.prompt(`Nội dung cảnh cáo ${member.name}:`)
        if (!reason?.trim()) return
        await groupApi.warnMember(groupId, member.userId, reason.trim()); toast("Đã gửi cảnh cáo đến thành viên."); return
      }
      if (action === "role") {
        const next = window.prompt("Chọn vai trò: ADMIN, MODERATOR hoặc MEMBER", member.role)
        if (!next) return
        await groupApi.changeRole(groupId, member.userId, next.trim().toUpperCase()); toast("Đã cập nhật vai trò."); loadGroup(); return
      }
      const reason = action === "ban" ? window.prompt(`Lý do cấm ${member.name}:`) : ""
      if (action === "ban" && reason == null) return
      if (!window.confirm(action === "ban" ? `Cấm ${member.name} khỏi nhóm?` : `Xóa ${member.name} khỏi nhóm?`)) return
      if (action === "ban") await groupApi.banMember(groupId, member.userId, reason)
      else await groupApi.removeMember(groupId, member.userId)
      toast(action === "ban" ? "Đã cấm thành viên." : "Đã xóa thành viên.")
      loadGroup(); loadModeration()
    } catch (e) { fail(e, "Không thể thực hiện thao tác.") }
  }

  const decide = async (fn, ok, fb) => { try { await fn(); toast(ok); await loadModeration(); await loadGroup() } catch (e) { fail(e, fb) } }

  const invite = async (e) => {
    const userId = e.target.value
    if (!userId) return
    try { await groupApi.invite(groupId, Number(userId)); toast("Đã gửi lời mời.") } catch (err) { fail(err, "Không thể gửi lời mời.") }
    e.target.value = ""
  }

  const createEvent = async (e) => {
    e.preventDefault()
    try { await groupApi.createEvent(groupId, { ...eventForm, endsAt: eventForm.endsAt || null }); setEventForm(null); toast("Đã tạo sự kiện nhóm."); loadGroup() } catch (err) { fail(err, "Không thể tạo sự kiện.") }
  }
  const participate = async (eventId) => { try { await groupApi.participateEvent(groupId, eventId); loadGroup() } catch (e) { fail(e, "Không thể cập nhật tham gia sự kiện.") } }

  const saveSettings = async (e) => {
    e.preventDefault()
    try { await groupApi.update(groupId, settings); setSettings((s) => s); setSettingsOpen(false); toast("Đã cập nhật thông tin nhóm."); loadGroup() } catch (err) { fail(err, "Không thể cập nhật nhóm.") }
  }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const uploadImage = async (field, e) => {
    const image = e.target.files?.[0]
    e.target.value = ""
    if (!image) return
    try {
      const { data } = await groupApi.upload(groupId, image, "GROUP_IMAGE")
      if (data.mediaType !== "IMAGE") throw new Error("Chọn ảnh hợp lệ.")
      setSettings((s) => ({ ...s, [field]: data.url }))
    } catch (err) { fail(err, err.message || "Không thể tải ảnh lên.") }
  }
  const deleteGroup = async () => {
    if (!window.confirm("Xóa nhóm này? Hành động này không thể hoàn tác.")) return
    try { await groupApi.remove(groupId); toast("Đã xóa nhóm."); navigate("/groups") } catch (e) { fail(e, "Không thể xóa nhóm.") }
  }
  const unban = (m) => decide(() => groupApi.unbanMember(groupId, m.userId), "Đã bỏ cấm thành viên.", "Không thể bỏ cấm thành viên.")

  if (loading) return <Loading />
  if (!group) return (
    <div className="directory-page">
      <button className="back-link-inline" onClick={() => navigate("/groups")}>← Tất cả nhóm</button>
      <ErrorBlock message={error || "Không thể mở nhóm."} onRetry={loadGroup} />
    </div>
  )

  const authored = (p) => String(p.authorId) === String(user?.userId)
  return (
    <div className="directory-page group-detail">
      <button className="back-link-inline" onClick={() => navigate("/groups")}>← Tất cả nhóm</button>
      <section className="group-feature group-cover" style={group.coverImage ? { backgroundImage: `linear-gradient(0deg, rgba(8,15,22,.7), rgba(8,15,22,.1)), url("${mediaUrl(group.coverImage)}")` } : undefined}>
        <div className="group-cover-inner">
          <Avatar name={group.name} src={group.avatar} size="xl" />
          <div>
            <span>{group.visibility === "PRIVATE" ? "Nhóm riêng tư" : "Nhóm công khai"} · {group.memberCount} thành viên{group.category ? ` · ${group.category}` : ""}</span>
            <h2>{group.name}</h2>
          </div>
        </div>
      </section>
      <section className="group-info-bar panel">
        <p>{group.description || "Chưa có mô tả cho nhóm này."}</p>
        <div>
          {isMember ? (role !== "OWNER" && <Button variant="secondary" onClick={joinOrLeave}>Rời nhóm</Button>) : <Button onClick={joinOrLeave}>{group.visibility === "PRIVATE" ? "Yêu cầu tham gia" : "Tham gia nhóm"}</Button>}
          {canAdmin && <Button variant="secondary" icon="settings" onClick={() => setSettingsOpen(true)}>Cài đặt nhóm</Button>}
          {canModerate && <Button variant="secondary" onClick={() => { setShowAdmin(!showAdmin); loadModeration() }}>{showAdmin ? "Đóng quản trị" : `Quản trị${mod.requests.length + mod.posts.length + mod.reports.length ? ` (${mod.requests.length + mod.posts.length + mod.reports.length})` : ""}`}</Button>}
        </div>
      </section>
      <div className="event-filters">
        {(privatePreview ? ["Giới thiệu"] : TABS).map((t) => <button key={t} className={activeTab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {showAdmin && canModerate && (
        <section className="group-admin panel">
          <h2>Kiểm duyệt nhóm</h2>
          <div className="group-admin-grid">
            <div><h3>Yêu cầu tham gia ({mod.requests.length})</h3>
              {mod.requests.length === 0 && <p className="aside-empty">Không có yêu cầu đang chờ.</p>}
              {mod.requests.map((r) => (
                <div className="mod-row" key={r.id}><div><strong>{r.name || r.userName || r.displayName}</strong><small>{timeAgo(r.createdAt)}</small></div><Button onClick={() => decide(() => groupApi.decideJoin(groupId, r.id, true), "Đã duyệt thành viên.", "Không thể duyệt.")}>Duyệt</Button><Button variant="secondary" onClick={() => decide(() => groupApi.decideJoin(groupId, r.id, false), "Đã từ chối yêu cầu.", "Không thể từ chối.")}>Từ chối</Button></div>
              ))}
            </div>
            <div><h3>Bài viết chờ duyệt ({mod.posts.length})</h3>
              {mod.posts.length === 0 && <p className="aside-empty">Không có bài viết chờ duyệt.</p>}
              {mod.posts.map((p) => (
                <div className="mod-row" key={p.postId}><div><strong>{p.authorName}</strong><small>{(p.content || "Bài viết có tệp đính kèm").slice(0, 80)}</small></div><Button onClick={() => decide(() => groupApi.reviewPost(groupId, p.postId, true), "Đã duyệt bài viết.", "Không thể duyệt.")}>Duyệt</Button><Button variant="secondary" onClick={() => decide(() => groupApi.reviewPost(groupId, p.postId, false), "Đã từ chối bài viết.", "Không thể từ chối.")}>Từ chối</Button></div>
              ))}
            </div>
            <div><h3>Báo cáo ({mod.reports.length})</h3>
              {mod.reports.length === 0 && <p className="aside-empty">Không có báo cáo mới.</p>}
              {mod.reports.map((r) => (
                <div className="mod-row" key={r.id}><div><strong>{r.reporter}</strong><small>{r.reason}</small></div><Button variant="danger" onClick={() => decide(() => groupApi.decideReport(groupId, r.id, true), "Đã gỡ nội dung.", "Không thể xử lý báo cáo.")}>Gỡ nội dung</Button><Button variant="secondary" onClick={() => decide(() => groupApi.decideReport(groupId, r.id, false), "Đã đóng báo cáo.", "Không thể đóng báo cáo.")}>Bỏ qua</Button></div>
              ))}
            </div>
            <div><h3>Thành viên bị cấm ({mod.bans.length})</h3>
              {mod.bans.length === 0 && <p className="aside-empty">Danh sách trống.</p>}
              {mod.bans.map((m) => (
                <div className="mod-row" key={m.userId}><div><strong>{m.name}</strong><small>{m.reason}</small></div><Button variant="secondary" onClick={() => unban(m)}>Bỏ cấm</Button></div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="group-grid">
        <aside className="group-side">
          <section className="panel group-side-panel">
            <h3>Về nhóm</h3>
            <p>{group.description || "Chưa có mô tả."}</p>
            <dl>
              <div><dt>Quyền riêng tư</dt><dd>{group.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</dd></div>
              <div><dt>Thành viên</dt><dd>{group.memberCount}</dd></div>
              <div><dt>Chủ nhóm</dt><dd>{group.ownerName}</dd></div>
              {role && <div><dt>Vai trò của bạn</dt><dd>{ROLE_LABEL[role] || role}</dd></div>}
            </dl>
          </section>
          {isMember && friends.length > 0 && (
            <section className="panel group-side-panel">
              <h3>Mời bạn bè</h3>
              <select className="toolbar-select" defaultValue="" onChange={invite}>
                <option value="">Chọn bạn bè để mời</option>
                {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </section>
          )}
          {!privatePreview && (
            <section className="panel group-side-panel">
              <div className="section-heading"><h3>Sự kiện nhóm</h3>{isMember && <button onClick={() => setEventForm(eventForm ? null : { title: "", description: "", location: "", startsAt: "", endsAt: "" })}>{eventForm ? "Đóng" : "Tạo mới"}</button>}</div>
              {eventForm && (
                <form className="group-event-form" onSubmit={createEvent}>
                  <input required maxLength={120} placeholder="Tên sự kiện" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
                  <input placeholder="Địa điểm" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} />
                  <label>Bắt đầu<input required type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} /></label>
                  <label>Kết thúc<input type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} /></label>
                  <textarea rows={2} placeholder="Mô tả" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
                  <Button type="submit">Tạo sự kiện</Button>
                </form>
              )}
              {events.length === 0 && <p className="aside-empty">Chưa có sự kiện nào.</p>}
              {events.map((ev) => (
                <div className="group-event-item" key={ev.eventId}>
                  <strong>{ev.title}</strong>
                  <small>{fmt(ev.startsAt)}{ev.location ? ` · ${ev.location}` : ""}</small>
                  <small>{ev.participantCount} người tham gia · bởi {ev.creatorName}</small>
                  {isMember && <Button variant={ev.participating ? "primary" : "secondary"} onClick={() => participate(ev.eventId)}>{ev.participating ? "Đã tham gia" : "Tham gia"}</Button>}
                </div>
              ))}
            </section>
          )}
        </aside>

        <section className="group-main">
          {activeTab === "Thành viên" ? (
            <section className="panel group-members">
              <div className="section-heading"><h3>Thành viên</h3><span className="online-label">{members.length}</span></div>
              {members.map((m) => (
                <div className="member-row" key={m.userId}>
                  <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${m.userId}`)}><Avatar name={m.name} src={m.avatar} /></span>
                  <div><strong>{m.name}</strong><small>{ROLE_LABEL[m.role] || m.role}</small></div>
                  {canModerate && String(m.userId) !== String(user?.userId) && m.role !== "OWNER" && (
                    <div className="menu-wrap" style={{ position: "relative", marginLeft: "auto" }}>
                      <button className="icon-button" aria-label={`Tùy chọn ${m.name}`} onClick={() => setMenu(menu === `m${m.userId}` ? null : `m${m.userId}`)}><Icon name="more" /></button>
                      {menu === `m${m.userId}` && (
                        <div className="pop-menu post-menu">
                          {canAdmin && <button onClick={() => manageMember(m, "role")}>Đổi vai trò</button>}
                          <button onClick={() => manageMember(m, "warn")}>Cảnh cáo</button>
                          <button className="danger" onClick={() => manageMember(m, "ban")}>Cấm khỏi nhóm</button>
                          <button className="danger" onClick={() => manageMember(m, "remove")}>Xóa khỏi nhóm</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ) : activeTab === "Giới thiệu" ? (
            <section className="panel group-about">
              <h3>{group.name}</h3>
              <p>{group.description || "Nhóm chưa có mô tả."}</p>
              <dl>
                <div><dt>Danh mục</dt><dd>{group.category || "Chưa phân loại"}</dd></div>
                <div><dt>Quyền riêng tư</dt><dd>{group.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</dd></div>
                <div><dt>Ngày tạo</dt><dd>{fmt(group.createdAt)}</dd></div>
                <div><dt>Chủ nhóm</dt><dd>{group.ownerName}</dd></div>
                <div><dt>Duyệt bài viết</dt><dd>{group.postApprovalRequired ? "Có" : "Không"}</dd></div>
              </dl>
            </section>
          ) : (
            <>
              {activeTab === "Bài viết" && isMember && (
                <form className="composer panel" onSubmit={composerMode === "POST" ? submitPost : submitPoll}>
                  <div className="compose-modes">
                    <button type="button" className={composerMode === "POST" ? "selected" : ""} onClick={() => setComposerMode("POST")}>Bài viết</button>
                    <button type="button" className={composerMode === "POLL" ? "selected" : ""} onClick={() => setComposerMode("POLL")}>Bình chọn</button>
                  </div>
                  {composerMode === "POST" ? (
                    <>
                      <div className="composer-input"><Avatar name={user?.displayName} /><textarea rows={2} maxLength={10000} value={content} onChange={(e) => setContent(e.target.value)} placeholder={`Chia sẻ với ${group.name}...`} /></div>
                      {file && filePreview && (
                        <div className="composer-preview">
                          {file.type.startsWith("video/") ? <video src={filePreview} controls /> : file.type.startsWith("image/") ? <img src={filePreview} alt="Xem trước" /> : <span className="attachment-row"><Icon name="file" /><span><strong>{file.name}</strong></span></span>}
                          <button type="button" aria-label="Bỏ tệp" onClick={() => setFile(null)}><Icon name="close" size={16} /></button>
                        </div>
                      )}
                      <div className="composer-footer">
                        <div>
                          <input ref={fileRef} type="file" hidden accept="image/*,video/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = "" }} />
                          <button type="button" onClick={() => fileRef.current?.click()}><Icon name="image" /><span>Ảnh, video hoặc tệp</span></button>
                        </div>
                        <Button type="submit" disabled={posting || (!content.trim() && !file)}>{posting ? "Đang đăng..." : group.postApprovalRequired ? "Gửi duyệt" : "Đăng bài"}</Button>
                      </div>
                    </>
                  ) : (
                    <div className="form-grid" style={{ padding: "6px 18px 16px" }}>
                      <label className="full">Câu hỏi<textarea rows={2} required maxLength={10000} value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} placeholder="Đặt câu hỏi..." /></label>
                      {poll.options.map((o, i) => (
                        <label className="full" key={i}>Lựa chọn {i + 1}<input value={o} maxLength={120} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value : x)) })} /></label>
                      ))}
                      <div className="full" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {poll.options.length < 6 && <Button variant="secondary" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}>Thêm lựa chọn</Button>}
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>Kết thúc<input type="datetime-local" value={poll.endsAt} onChange={(e) => setPoll({ ...poll, endsAt: e.target.value })} /></label>
                        <span style={{ marginLeft: "auto" }}><Button type="submit" disabled={posting}>Tạo bình chọn</Button></span>
                      </div>
                    </div>
                  )}
                </form>
              )}
              <div className="group-post-toolbar">
                <h3>{activeTab === "Media" ? "Ảnh và tệp" : "Bài viết"}</h3>
                {activeTab === "Bài viết" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <label className="inline-search"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm trong bài viết" /></label>
                    <select className="toolbar-select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="NEWEST">Mới nhất</option><option value="OLDEST">Cũ nhất</option><option value="POPULAR">Nổi bật</option></select>
                  </div>
                )}
              </div>
              {posts.length === 0 && <EmptyState title={activeTab === "Media" ? "Chưa có tệp được chia sẻ" : "Chưa có bài viết"} copy={isMember ? "Hãy bắt đầu cuộc trò chuyện đầu tiên trong nhóm." : "Tham gia nhóm để xem và đăng bài."} icon="forum" />}
              {posts.map((p) => {
                const picked = POST_REACTIONS.find((r) => r.type === p.viewerReaction)
                const comments = p.comments || []
                return (
                  <article className="post panel" key={p.postId}>
                    {p.pinned && <div className="pinned-label"><Icon name="pin" size={14} /> Bài viết đã ghim</div>}
                    <header className="post-head">
                      <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${p.authorId}`)}><Avatar name={p.authorName} src={p.authorAvatar} /></span>
                      <div><strong>{p.authorName}</strong><span>{fmt(p.createdAt)}</span></div>
                      <div className="menu-wrap" style={{ marginLeft: "auto", position: "relative" }}>
                        <button className="icon-button" aria-label="Tùy chọn bài viết" onClick={() => setMenu(menu === `p${p.postId}` ? null : `p${p.postId}`)}><Icon name="more" /></button>
                        {menu === `p${p.postId}` && (
                          <div className="pop-menu post-menu">
                            <button onClick={() => toggleSave(p)}><Icon name="bookmark" size={16} />{saved[p.postId] ? "Bỏ lưu" : "Lưu bài viết"}</button>
                            {authored(p) && <button onClick={() => editPost(p)}><Icon name="edit" size={16} />Sửa bài viết</button>}
                            {canModerate && <button onClick={() => pin(p)}><Icon name="pin" size={16} />{p.pinned ? "Bỏ ghim" : "Ghim bài viết"}</button>}
                            {!authored(p) && isMember && <button onClick={() => reportPost(p)}>Báo cáo bài viết</button>}
                            {(authored(p) || canModerate) && <button className="danger" onClick={() => removePost(p)}><Icon name="trash" size={16} />Xóa bài viết</button>}
                          </div>
                        )}
                      </div>
                    </header>
                    {p.content && <div className="post-copy"><p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.content}</p></div>}
                    {p.poll && <PollCard post={p} canVote={isMember} onVote={votePoll} />}
                    {p.mediaUrl && <GroupPostMedia post={p} />}
                    <div className="post-meta"><span><b>{picked ? picked.emoji : "♥"}</b> {p.reactionCount} cảm xúc</span><span>{comments.length} bình luận</span></div>
                    <div className="post-actions" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                      <div className="reaction-control">
                        <button className={picked ? "active" : ""} disabled={!isMember} onClick={() => react(p, picked?.type || "LIKE")}>
                          {picked ? <span className="reaction-emoji">{picked.emoji}</span> : <Icon name="heart" />}{picked ? picked.label : "Thích"}
                        </button>
                        {isMember && <div className="reaction-picker">{POST_REACTIONS.map((r) => <button key={r.type} type="button" title={r.label} onClick={() => react(p, r.type)}>{r.emoji}</button>)}</div>}
                      </div>
                      <button onClick={() => setOpenComments((o) => ({ ...o, [p.postId]: !o[p.postId] }))}><Icon name="comment" />Bình luận</button>
                    </div>
                    {openComments[p.postId] && (
                      <div className="comment-thread">
                        {comments.map((c) => (
                          <div className={`comment-preview comment-item ${c.parentCommentId ? "reply" : ""}`} key={c.commentId}>
                            <Avatar name={c.authorName} src={c.authorAvatar} size="sm" />
                            <div><strong>{c.authorName}</strong><p>{c.content}</p>
                              <span>{timeAgo(c.createdAt)}{isMember && !c.parentCommentId && <> · <button className="link-btn" onClick={() => setReplyTo({ postId: p.postId, commentId: c.commentId, name: c.authorName })}>Trả lời</button></>}{(String(c.authorId) === String(user?.userId) || canModerate) && <> · <button className="link-btn" onClick={() => removeComment(c.commentId)}>Xóa</button></>}</span>
                            </div>
                          </div>
                        ))}
                        {isMember && (
                          <form className="comment-form" onSubmit={(e) => comment(p, e)}>
                            <input value={commentDraft[p.postId] || ""} onChange={(e) => setCommentDraft((d) => ({ ...d, [p.postId]: e.target.value }))} placeholder={replyTo?.postId === p.postId ? `Trả lời ${replyTo.name}...` : "Viết bình luận..."} maxLength={2000} />
                            <button className="button button-primary" disabled={!(commentDraft[p.postId] || "").trim()}>Gửi</button>
                          </form>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </>
          )}
        </section>
      </div>

      {settingsOpen && settings && (
        <Modal title="Cài đặt nhóm" close={() => setSettingsOpen(false)} wide>
          <form onSubmit={saveSettings}>
            <div className="form-grid">
              <label>Ảnh đại diện<input type="file" accept="image/*" onChange={(e) => uploadImage("avatar", e)} /></label>
              <label>Ảnh bìa<input type="file" accept="image/*" onChange={(e) => uploadImage("coverImage", e)} /></label>
              {(settings.avatar || settings.coverImage) && (
                <div className="full" style={{ display: "flex", gap: 10 }}>
                  {settings.avatar && <img className="form-preview" style={{ width: 80, height: 80 }} src={mediaUrl(settings.avatar)} alt="Ảnh đại diện nhóm" />}
                  {settings.coverImage && <img className="form-preview" style={{ height: 80 }} src={mediaUrl(settings.coverImage)} alt="Ảnh bìa nhóm" />}
                </div>
              )}
              <label className="full">Tên nhóm<input required maxLength={100} value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></label>
              <label className="full">Mô tả<textarea rows={3} maxLength={2000} value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} /></label>
              <label>Danh mục<input maxLength={80} value={settings.category} onChange={(e) => setSettings({ ...settings, category: e.target.value })} /></label>
              <label>Quyền riêng tư<select value={settings.visibility} onChange={(e) => setSettings({ ...settings, visibility: e.target.value })}><option value="PUBLIC">Công khai</option><option value="PRIVATE">Riêng tư</option></select></label>
              <label className="full check-row"><input type="checkbox" checked={settings.postApprovalRequired} onChange={(e) => setSettings({ ...settings, postApprovalRequired: e.target.checked })} />Duyệt bài viết trước khi đăng</label>
              <label className="full">Từ khóa lọc spam<input value={settings.spamKeywords} onChange={(e) => setSettings({ ...settings, spamKeywords: e.target.value })} placeholder="từ khóa 1, từ khóa 2" /></label>
            </div>
            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              {role === "OWNER" ? <Button variant="danger" icon="trash" onClick={deleteGroup}>Xóa nhóm</Button> : <span />}
              <div style={{ display: "flex", gap: 8 }}><Button variant="secondary" onClick={() => setSettingsOpen(false)}>Hủy</Button><Button type="submit">Lưu thay đổi</Button></div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
