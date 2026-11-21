import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate, useSearchParams } from "react-router-dom"
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

const TABS = ["Bài viết", "Thành viên", "Sự kiện", "Giới thiệu"]
const EVENT_FILTERS = [["ALL", "Tất cả"], ["UPCOMING", "Sự kiện sắp diễn ra"], ["ENDED", "Sự kiện kết thúc"]]
const ROLE_LABEL = { OWNER: "Chủ nhóm", ADMIN: "Phó nhóm", MODERATOR: "Thành viên", MEMBER: "Thành viên" }
const memberRolePriority = (role) => role === "OWNER" ? 0 : role === "ADMIN" ? 1 : 2
const fmt = (v) => (v ? new Date(v).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "")
const groupEventEndTime = (event) => {
  const endsAt = new Date(event.endsAt || event.startsAt)
  if (!event.endsAt) endsAt.setHours(24, 0, 0, 0)
  return endsAt.getTime()
}
const groupEventStatus = (event, now = Date.now()) => {
  const startsAt = new Date(event.startsAt).getTime()
  const endsAt = groupEventEndTime(event)
  if (startsAt > now) return "UPCOMING"
  if (endsAt > now) return "ONGOING"
  return "ENDED"
}
const EVENT_STATUS_LABEL = { UPCOMING: "Sắp diễn ra", ONGOING: "Đang diễn ra", ENDED: "Đã kết thúc" }
const formatPollDeadline = (value) => {
  if (!value) return "dd/mm/yyyy --:--"
  const [date, time = ""] = value.split("T")
  const [year, month, day] = date.split("-")
  return `${day}/${month}/${year}${time ? ` ${time}` : ""}`
}
const asList = (d) => (Array.isArray(d) ? d : d?.content || [])

// Tệp trong nhóm cần xác thực nên tải bằng axios (kèm token) rồi hiển thị qua blob.
function GroupPostMedia({ post, onOpenPost }) {
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
  if (post.mediaType === "IMAGE") {
    const image = <img className="post-image" src={source} alt="Tệp đính kèm bài viết" />
    return onOpenPost ? <button type="button" className="group-post-media-open" onClick={onOpenPost} aria-label="Mở bài viết và bình luận">{image}</button> : image
  }
  if (post.mediaType === "VIDEO") return <video className="post-image" src={source} controls />
  return <a className="attachment-row" style={{ margin: "0 18px 12px", width: "auto" }} href={source} download target="_blank" rel="noreferrer"><Icon name="file" /><span><strong>Mở tệp đính kèm</strong></span><Icon name="download" size={18} /></a>
}

function ModerationPostPreview({ post, expanded = false }) {
  if (!post) return null
  const options = post.poll?.options || []
  return (
    <div className={`mod-target-post${expanded ? " expanded" : ""}`}>
      <div className="mod-target-post-heading">
        <strong>{post.poll ? "Bình chọn" : "Bài viết"} · {post.authorName || "Không rõ người đăng"}</strong>
        {post.createdAt && <small>{fmt(post.createdAt)}</small>}
      </div>
      {post.content && <p className="mod-target-post-copy">{post.content}</p>}
      {post.poll && (
        <div className="mod-target-poll-options">
          {options.map((option, index) => <span key={option.optionId || option.label || option || index}>{index + 1}. {typeof option === "string" ? option : option.label}</span>)}
          {post.poll.endsAt && <small>Kết thúc {fmt(post.poll.endsAt)}</small>}
        </div>
      )}
      {post.mediaUrl && <div className="mod-target-post-media"><GroupPostMedia post={post} /></div>}
      {!post.content && !post.poll && !post.mediaUrl && <p className="mod-target-post-copy empty">Bài viết không có nội dung xem trước.</p>}
    </div>
  )
}

function PollCard({ post, canVote, onVote }) {
  const options = post.poll?.options || []
  const total = options.reduce((t, o) => t + o.votes, 0)
  const ended = post.poll?.endsAt && new Date(post.poll.endsAt) <= new Date()
  return (
    <section className="group-poll" aria-label="Bình chọn">
      {options.map((o) => {
        const percentage = total ? Math.round((o.votes * 100) / total) : 0
        return (
          <button type="button" key={o.optionId} disabled={!canVote || ended} className={`poll-option ${o.selected ? "selected" : ""}`} onClick={() => onVote(post, o.optionId)}>
            <span className="poll-bar" style={{ width: `${percentage}%` }} />
            <span className="poll-label">{o.label}</span><b title={`${o.votes} lượt chọn`}>{percentage}%</b>
          </button>
        )
      })}
      <p>{total} lượt chọn{post.poll?.endsAt ? ` · ${ended ? "Đã kết thúc" : `Kết thúc ${fmt(post.poll.endsAt)}`}` : ""}</p>
    </section>
  )
}

export default function GroupDetail({ groupId, commentsOnlyPostId = null, onCloseComments }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [friends, setFriends] = useState([])
  const [friendSearch, setFriendSearch] = useState("")
  const [friendPickerOpen, setFriendPickerOpen] = useState(false)
  const [invitingFriendId, setInvitingFriendId] = useState(null)
  const [invitedFriendIds, setInvitedFriendIds] = useState(() => new Set())
  const [saved, setSaved] = useState({})
  const [tab, setTab] = useState("Bài viết")
  const [eventFilter, setEventFilter] = useState("ALL")
  const [eventNow, setEventNow] = useState(() => Date.now())
  const [sort, setSort] = useState("NEWEST")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [composerMode, setComposerMode] = useState("POST")
  const [content, setContent] = useState("")
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState("")
  const [poll, setPoll] = useState({ question: "", options: ["", ""] })
  const [pollEndAt, setPollEndAt] = useState("")
  const [posting, setPosting] = useState(false)
  const [openComments, setOpenComments] = useState({})
  const commentListRefs = useRef({})
  const [commentDraft, setCommentDraft] = useState({})
  const [replyTo, setReplyTo] = useState(null)
  const [commentToDelete, setCommentToDelete] = useState(null)
  const [deletingComment, setDeletingComment] = useState(false)
  const [postToDelete, setPostToDelete] = useState(null)
  const [deletingPost, setDeletingPost] = useState(false)
  const [reportingPost, setReportingPost] = useState(null)
  const [reportReason, setReportReason] = useState("")
  const [sendingReport, setSendingReport] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [editDraft, setEditDraft] = useState("")
  const [editPollOptions, setEditPollOptions] = useState(["", ""])
  const [editPollEndAt, setEditPollEndAt] = useState("")
  const [editFile, setEditFile] = useState(null)
  const [editFilePreview, setEditFilePreview] = useState("")
  const [removeCurrentMedia, setRemoveCurrentMedia] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [menu, setMenu] = useState(null)
  const [memberMenuPosition, setMemberMenuPosition] = useState(null)
  const [memberActionTarget, setMemberActionTarget] = useState(null)
  const [memberActionReason, setMemberActionReason] = useState("")
  const [savingMemberAction, setSavingMemberAction] = useState(false)
  const [groupActionConfirm, setGroupActionConfirm] = useState(null)
  const [savingGroupAction, setSavingGroupAction] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [mod, setMod] = useState({ requests: [], posts: [], reports: [], bans: [] })
  const [moderationTarget, setModerationTarget] = useState(null)
  const [loadingReportId, setLoadingReportId] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)
  const [memberRoleValue, setMemberRoleValue] = useState("MEMBER")
  const [savingMemberRole, setSavingMemberRole] = useState(false)
  const [eventForm, setEventForm] = useState(null)
  const [eventMediaFile, setEventMediaFile] = useState(null)
  const [eventMediaPreview, setEventMediaPreview] = useState("")
  const [viewingEvent, setViewingEvent] = useState(null)
  const [settings, setSettings] = useState(null)
  const fileRef = useRef(null)
  const editFileRef = useRef(null)
  const eventMediaRef = useRef(null)
  const friendPickerRef = useRef(null)

  const role = group?.role
  const isMember = Boolean(group?.joined)
  const canModerate = ["OWNER", "ADMIN"].includes(role)
  const canAdmin = ["OWNER", "ADMIN"].includes(role)
  const canManageRoles = role === "OWNER"
  const privatePreview = group?.visibility === "PRIVATE" && !isMember
  const activeTab = privatePreview ? "Giới thiệu" : TABS.includes(tab) ? tab : "Bài viết"
  const fail = (e, fb) => toast(getApiErrorMessage(e, fb), "error")
  const openCommentsPostId = commentsOnlyPostId == null ? searchParams.get("openComments") : String(commentsOnlyPostId)
  const showDateTimePicker = (event) => {
    try { event.currentTarget.showPicker?.() } catch { /* trình duyệt có thể đã mở bộ chọn */ }
  }

  useEffect(() => {
    if (!openCommentsPostId || loading) return
    if (posts.some((post) => String(post.postId) === openCommentsPostId)) {
      setOpenComments((current) => ({ ...current, [openCommentsPostId]: true }))
    }
  }, [openCommentsPostId, posts, loading])

  const closePostComments = (postId) => {
    setOpenComments((current) => ({ ...current, [postId]: false }))
    if (String(commentsOnlyPostId) === String(postId)) onCloseComments?.()
    if (searchParams.get("openComments") === String(postId)) {
      const next = new URLSearchParams(searchParams)
      next.delete("openComments")
      if (next.get("postId") === String(postId)) next.delete("postId")
      setSearchParams(next, { replace: true })
    }
  }

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest?.(".menu-wrap")) {
        setMenu(null)
        setMemberMenuPosition(null)
      }
    }
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])
  useEffect(() => {
    if (!menu?.startsWith("m") || !memberMenuPosition) return undefined
    const close = () => { setMenu(null); setMemberMenuPosition(null) }
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [menu, memberMenuPosition])
  useEffect(() => {
    if (!groupActionConfirm || savingGroupAction) return undefined
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return
      event.stopImmediatePropagation()
      setGroupActionConfirm(null)
    }
    window.addEventListener("keydown", closeOnEscape, true)
    return () => window.removeEventListener("keydown", closeOnEscape, true)
  }, [groupActionConfirm, savingGroupAction])
  useEffect(() => {
    if (groupActionConfirm !== "leave") return undefined
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [groupActionConfirm])
  useEffect(() => {
    if (!commentToDelete && !postToDelete) return undefined
    const closeConfirm = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation()
        setCommentToDelete(null)
        setPostToDelete(null)
      }
    }
    window.addEventListener("keydown", closeConfirm, true)
    return () => window.removeEventListener("keydown", closeConfirm, true)
  }, [commentToDelete, postToDelete])
  useEffect(() => {
    if (!file) return setFilePreview("")
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (!editFile) return setEditFilePreview("")
    const url = URL.createObjectURL(editFile)
    setEditFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editFile])
  useEffect(() => {
    if (!eventMediaFile) return setEventMediaPreview("")
    const url = URL.createObjectURL(eventMediaFile)
    setEventMediaPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [eventMediaFile])

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
        canView ? groupApi.posts(groupId, { sort }) : Promise.resolve({ data: [] }),
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
  }, [groupId, sort])

  useEffect(() => { loadGroup() }, [loadGroup])
  useEffect(() => {
    const transitions = events.flatMap((event) => [new Date(event.startsAt).getTime(), groupEventEndTime(event)]
      .filter((time) => Number.isFinite(time) && time > eventNow))
    if (!transitions.length) return undefined
    const nextTransition = Math.min(...transitions)
    const timer = setTimeout(() => setEventNow(Date.now()), Math.min(nextTransition - eventNow + 50, 2147483000))
    return () => clearTimeout(timer)
  }, [events, eventNow])
  useEffect(() => { if (canModerate) loadModeration() }, [canModerate, loadModeration])
  useEffect(() => {
    if (!friendPickerOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!friendPickerRef.current?.contains(event.target)) setFriendPickerOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => document.removeEventListener("mousedown", closeOnOutsideClick)
  }, [friendPickerOpen])
  useEffect(() => {
    if (!isMember) return
    friendApi.accepted().then((r) => setFriends((r.data || []).map((x) => friendOf(x, user?.userId)))).catch(() => {})
  }, [isMember, user?.userId])

  const joinOrLeave = async () => {
    try {
      if (isMember) {
        setGroupActionConfirm("leave")
        return
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
      await groupApi.createPoll(groupId, { question: poll.question.trim(), options, endsAt: pollEndAt || null })
      setPoll({ question: "", options: ["", ""] }); setComposerMode("POST")
      setPollEndAt("")
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
  const removeComment = async () => {
    if (!commentToDelete || deletingComment) return
    setDeletingComment(true)
    try {
      await groupApi.removeComment(groupId, commentToDelete.commentId)
      setCommentToDelete(null)
      loadGroup()
    } catch (e) { fail(e, "Không thể xóa bình luận.") }
    finally { setDeletingComment(false) }
  }
  const removePost = async () => {
    if (!postToDelete || deletingPost) return
    setMenu(null)
    setDeletingPost(true)
    try {
      await groupApi.removePost(groupId, postToDelete.postId)
      setPosts((list) => list.filter((post) => post.postId !== postToDelete.postId))
      setPostToDelete(null)
      toast(postToDelete.poll ? "Đã xóa bình chọn." : "Đã xóa bài viết.")
    } catch (e) { fail(e, postToDelete.poll ? "Không thể xóa bình chọn." : "Không thể xóa bài viết.") }
    finally { setDeletingPost(false) }
  }
  const editPost = (post) => {
    setMenu(null)
    setEditingPost(post)
    setEditDraft(post.content || "")
    setEditPollOptions(post.poll?.options?.map((option) => option.label) || ["", ""])
    const existingPollEnd = post.poll?.endsAt || ""
    setEditPollEndAt(existingPollEnd.slice(0, 16))
    setEditFile(null)
    setEditFilePreview("")
    setRemoveCurrentMedia(false)
    if (editFileRef.current) editFileRef.current.value = ""
  }
  const saveEditedPost = async (event) => {
    event.preventDefault()
    if (!editingPost || savingEdit) return
    const content = editDraft.trim()
    if (editingPost.poll) {
      if (!content) return toast("Vui lòng nhập câu hỏi cho bình chọn.", "error")
      const options = editPollOptions.map((option) => option.trim()).filter(Boolean)
      if (options.length < 2) return toast("Bình chọn cần ít nhất hai lựa chọn.", "error")
      setSavingEdit(true)
      try {
        const { data } = await groupApi.updatePoll(groupId, editingPost.postId, {
          question: content,
          options,
          endsAt: editPollEndAt || null,
        })
        setPosts((list) => list.map((post) => post.postId === editingPost.postId ? data : post))
        setEditingPost(null)
        toast("Đã lưu bình chọn.")
      } catch (e) { fail(e, "Không thể sửa bình chọn.") }
      finally { setSavingEdit(false) }
      return
    }
    const hasCurrentMedia = Boolean(editingPost.mediaUrl && !removeCurrentMedia)
    if (!content && !hasCurrentMedia && !editFile) return
    setSavingEdit(true)
    try {
      let mediaUrlValue = editingPost.mediaUrl || null
      let mediaType = editingPost.mediaType || null
      if (editFile) {
        const { data: uploaded } = await groupApi.upload(groupId, editFile, "POST")
        mediaUrlValue = uploaded.url
        mediaType = uploaded.mediaType
      } else if (removeCurrentMedia) {
        // An empty string explicitly clears the existing attachment on the server.
        mediaUrlValue = ""
        mediaType = null
      }
      const { data } = await groupApi.updatePost(groupId, editingPost.postId, {
        content,
        mediaUrl: mediaUrlValue,
        mediaType,
      })
      setPosts((list) => list.map((post) => post.postId === editingPost.postId ? data : post))
      setEditingPost(null)
      setEditFile(null)
      setEditFilePreview("")
      setRemoveCurrentMedia(false)
      if (editFileRef.current) editFileRef.current.value = ""
      toast("Đã cập nhật bài viết.")
    } catch (e) { fail(e, "Không thể sửa bài viết.") }
    finally { setSavingEdit(false) }
  }
  const pin = async (post) => {
    setMenu(null)
    try { await groupApi.pin(groupId, post.postId); loadGroup() } catch (e) { fail(e, post.poll ? "Không thể ghim bình chọn." : "Không thể ghim bài viết.") }
  }
  const reportPost = (post) => {
    setMenu(null)
    setReportReason("")
    setReportingPost(post)
  }
  const closeReport = () => {
    if (sendingReport) return
    setReportingPost(null)
    setReportReason("")
  }
  const submitReport = async (event) => {
    event.preventDefault()
    if (!reportingPost || !reportReason.trim() || sendingReport) return
    const post = reportingPost
    setSendingReport(true)
    try {
      await groupApi.report(groupId, { targetType: "POST", targetId: post.postId, reason: reportReason.trim() })
      toast(post.poll ? "Đã gửi báo cáo bình chọn." : "Đã gửi báo cáo bài viết.")
      setReportingPost(null)
      setReportReason("")
    } catch (e) { fail(e, post.poll ? "Không thể gửi báo cáo bình chọn." : "Không thể gửi báo cáo bài viết.") }
    finally { setSendingReport(false) }
  }
  const toggleSave = async (post) => {
    setMenu(null)
    try { const { data } = await savedApi.toggle("GROUP_POST", post.postId); setSaved((s) => ({ ...s, [post.postId]: Boolean(data.saved) })); toast(data.saved ? (post.poll ? "Đã lưu bình chọn." : "Đã lưu bài viết.") : (post.poll ? "Đã bỏ lưu bình chọn." : "Đã bỏ lưu bài viết.")) } catch (e) { fail(e, post.poll ? "Không thể lưu bình chọn." : "Không thể lưu bài viết.") }
  }

  const manageMember = (member, action) => {
    setMenu(null)
    setMemberMenuPosition(null)
    if (action === "role") {
      setMemberRoleValue(member.role === "ADMIN" ? "ADMIN" : "MEMBER")
      setRoleTarget(member)
      return
    }
    setMemberActionReason("")
    setMemberActionTarget({ member, action })
  }

  const toggleMemberMenu = (event, member) => {
    const memberMenu = `m${member.userId}`
    if (menu === memberMenu) {
      setMenu(null)
      setMemberMenuPosition(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 170
    const menuHeight = role === "OWNER" ? 112 : 78
    const leftOfButton = rect.left - menuWidth - 8
    const left = leftOfButton >= 8 ? leftOfButton : Math.max(8, Math.min(rect.right + 8, window.innerWidth - menuWidth - 8))
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - menuHeight - 8))
    setMemberMenuPosition({ top, left })
    setMenu(memberMenu)
  }

  const submitMemberAction = async (event) => {
    event.preventDefault()
    if (!memberActionTarget || savingMemberAction) return
    const { member, action } = memberActionTarget
    setSavingMemberAction(true)
    try {
      if (action === "block") await groupApi.banMember(groupId, member.userId, memberActionReason.trim())
      else await groupApi.removeMember(groupId, member.userId)
      toast(action === "block" ? "Đã chặn thành viên khỏi nhóm." : "Đã xóa thành viên khỏi nhóm.")
      setMemberActionTarget(null)
      setMemberActionReason("")
      await Promise.all([loadGroup(), loadModeration()])
    } catch (e) {
      fail(e, action === "block" ? "Không thể chặn thành viên khỏi nhóm." : "Không thể xóa thành viên khỏi nhóm.")
    } finally {
      setSavingMemberAction(false)
    }
  }

  const saveMemberRole = async (event) => {
    event.preventDefault()
    if (!roleTarget || savingMemberRole) return
    setSavingMemberRole(true)
    try {
      await groupApi.changeRole(groupId, roleTarget.userId, memberRoleValue)
      toast("Đã cập nhật vai trò thành viên.")
      setRoleTarget(null)
      await loadGroup()
    } catch (e) {
      fail(e, "Không thể cập nhật vai trò thành viên.")
    } finally {
      setSavingMemberRole(false)
    }
  }

  const decide = async (fn, ok, fb, afterSuccess) => { try { await fn(); toast(ok); await loadModeration(); await loadGroup(); afterSuccess?.() } catch (e) { fail(e, fb) } }

  const findReportPost = (report, source = posts) => {
    if (report.targetPost) return report.targetPost
    if (report.targetType === "POST") return source.find((post) => String(post.postId) === String(report.targetId)) || null
    if (report.targetType === "COMMENT") {
      return source.find((post) => post.comments?.some((comment) => String(comment.commentId) === String(report.targetId))) || null
    }
    return null
  }
  const findReportComment = (report, source = posts) => report.targetComment || source
    .flatMap((post) => post.comments || [])
    .find((comment) => String(comment.commentId) === String(report.targetId)) || null

  const openReport = async (report) => {
    setLoadingReportId(String(report.id))
    let source = posts
    let targetPost = findReportPost(report, source)
    if (!targetPost && report.targetExists !== false) {
      try {
        const { data } = await groupApi.posts(groupId, { sort: "NEWEST" })
        source = asList(data)
        setPosts(source)
        targetPost = findReportPost(report, source)
      } catch { /* Nội dung có thể đã bị xóa hoặc không tải được. */ }
    }
    const targetComment = findReportComment(report, source)
    setModerationTarget({
      kind: "REPORT",
      item: {
        ...report,
        targetPost,
        targetComment,
        previewUnavailable: !targetPost && report.targetExists !== false,
        targetExists: report.targetExists ?? Boolean(targetPost || targetComment),
      },
    })
    setLoadingReportId(null)
  }

  const inviteFriend = async (friend) => {
    if (invitingFriendId || invitedFriendIds.has(String(friend.id))) return
    setInvitingFriendId(String(friend.id))
    try {
      await groupApi.invite(groupId, Number(friend.id))
      setInvitedFriendIds((current) => new Set(current).add(String(friend.id)))
      toast(`Đã gửi lời mời cho ${friend.name}.`)
    } catch (err) { fail(err, "Không thể gửi lời mời.") }
    finally { setInvitingFriendId(null) }
  }

  const createEvent = async (e) => {
    e.preventDefault()
    setPosting(true)
    try {
      let mediaUrl = null
      let mediaType = null
      if (eventMediaFile) {
        const { data: upload } = await groupApi.upload(groupId, eventMediaFile, "EVENT")
        mediaUrl = upload.url
        mediaType = upload.mediaType
      }
      await groupApi.createEvent(groupId, { ...eventForm, endsAt: eventForm.endsAt || null, mediaUrl, mediaType })
      setEventForm(null)
      setEventMediaFile(null)
      setEventMediaPreview("")
      if (eventMediaRef.current) eventMediaRef.current.value = ""
      setComposerMode("POST")
      toast("Đã tạo sự kiện nhóm.")
      loadGroup()
    } catch (err) { fail(err, "Không thể tạo sự kiện.") }
    finally { setPosting(false) }
  }
  const participate = async (eventId) => { try { await groupApi.participateEvent(groupId, eventId); loadGroup() } catch (e) { fail(e, "Không thể cập nhật tham gia sự kiện.") } }
  const openAllEvents = () => { setEventFilter("ALL"); setTab("Sự kiện") }

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
  const deleteGroup = () => setGroupActionConfirm("delete")
  const submitGroupAction = async () => {
    if (!groupActionConfirm || savingGroupAction) return
    setSavingGroupAction(true)
    try {
      if (groupActionConfirm === "delete") {
        await groupApi.remove(groupId)
        toast("Đã xóa nhóm.")
        navigate("/groups")
      } else {
        await groupApi.leave(groupId)
        toast("Đã rời nhóm.")
        setGroupActionConfirm(null)
        await loadGroup()
      }
    } catch (e) {
      fail(e, groupActionConfirm === "delete" ? "Không thể xóa nhóm." : "Không thể rời nhóm.")
    } finally {
      setSavingGroupAction(false)
    }
  }
  const unban = (m) => decide(() => groupApi.unbanMember(groupId, m.userId), "Đã gỡ chặn thành viên.", "Không thể gỡ chặn thành viên.")

  if (loading) return <Loading />
  if (!group) return (
    <div className="directory-page">
      <button className="back-link-inline" onClick={() => navigate("/groups")}>← Tất cả nhóm</button>
      <ErrorBlock message={error || "Không thể mở nhóm."} onRetry={loadGroup} />
    </div>
  )

  const authored = (p) => String(p.authorId) === String(user?.userId)
  const orderedPosts = sort === "POPULAR"
    ? [...posts].sort((a, b) => (Number(b.reactionCount) || 0) - (Number(a.reactionCount) || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : posts
  const orderedMembers = [...members].sort((a, b) => memberRolePriority(a.role) - memberRolePriority(b.role) || new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0))
  const now = eventNow
  const upcomingEvents = events.filter((event) => groupEventStatus(event, now) === "UPCOMING")
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const activeEvents = events.filter((event) => groupEventStatus(event, now) === "ONGOING")
    .sort((a, b) => groupEventEndTime(a) - groupEventEndTime(b))
  const endedEvents = events.filter((event) => groupEventStatus(event, now) === "ENDED")
    .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
  const allEvents = [...events].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
  const featuredEvent = activeEvents[0] || upcomingEvents[0] || null
  const featuredEventStatus = featuredEvent ? groupEventStatus(featuredEvent, now) : null
  const filteredEvents = eventFilter === "UPCOMING" ? upcomingEvents : eventFilter === "ENDED" ? endedEvents : allEvents
  const sidebarEvent = upcomingEvents[0] || null
  const normalizedFriendQuery = friendSearch.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const matchingFriends = friends.filter((friend) => {
    const name = (friend.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const username = (friend.username || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    return !normalizedFriendQuery || name.includes(normalizedFriendQuery) || username.includes(normalizedFriendQuery)
  })
  const renderGroupEventCard = (event, featured = false) => {
    const status = groupEventStatus(event, now)
    return (
      <article className={`group-event-list-item${event.mediaUrl ? " has-media" : ""}${featured ? " featured" : ""}`} key={event.eventId}>
        {event.mediaUrl && <div className={`group-event-list-media${event.mediaType === "VIDEO" ? " video" : ""}`}><GroupPostMedia post={{ mediaUrl: event.mediaUrl, mediaType: event.mediaType }} /></div>}
        <div className="group-event-list-content">
          <div className="group-event-list-heading">
            <h3>{event.title}</h3>
            <span className={`group-event-status ${status.toLowerCase()}`}>{EVENT_STATUS_LABEL[status]}</span>
          </div>
          <p>{event.description || "Sự kiện chưa có mô tả."}</p>
          <div className="group-event-list-meta">
            <span><Icon name="calendar" size={15} />{fmt(event.startsAt)}{event.endsAt ? ` – ${fmt(event.endsAt)}` : ""}</span>
            {event.location && <span><Icon name="location" size={15} />{event.location}</span>}
            <span><Icon name="users" size={15} />{event.participantCount ?? 0} người tham gia</span>
            <span><Icon name="group" size={15} />{event.creatorName || "Không rõ người tạo"}</span>
          </div>
          <div className="group-event-actions">
            <Button variant="secondary" onClick={() => setViewingEvent(event)}>Xem thông tin</Button>
            {isMember && status !== "ENDED" && <Button variant={event.participating ? "primary" : "secondary"} onClick={() => participate(event.eventId)}>{event.participating ? "Đã tham gia" : "Tham gia"}</Button>}
          </div>
        </div>
      </article>
    )
  }
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
            <div><h3>Thành viên bị chặn ({mod.bans.length})</h3>
              {mod.bans.length === 0 && <p className="aside-empty">Danh sách trống.</p>}
              {mod.bans.map((m) => (
                <div className="mod-row" key={m.userId}><div><strong>{m.name}</strong><small>{m.reason || "Không có lý do được ghi lại."}</small></div><Button variant="secondary" onClick={() => unban(m)}>Gỡ chặn</Button></div>
              ))}
            </div>
            <div><h3>Báo cáo ({mod.reports.length})</h3>
              {mod.reports.length === 0 && <p className="aside-empty">Không có báo cáo mới.</p>}
              <div className="mod-review-list">
                {mod.reports.map((r) => {
                  const targetPost = findReportPost(r)
                  const targetComment = findReportComment(r)
                  return (
                    <article className="mod-review-card" key={r.id}>
                      <div className="mod-report-heading">
                        <strong>{r.targetType === "COMMENT" ? "Báo cáo bình luận" : `Báo cáo ${targetPost?.poll ? "bình chọn" : "bài viết"}`}</strong>
                        <small>{timeAgo(r.createdAt)}</small>
                      </div>
                      <p className="mod-review-snippet"><strong>{r.reporter}</strong> báo cáo · {r.reason}</p>
                      <p className="mod-review-snippet">{targetComment?.content || targetPost?.content || (r.targetExists === false ? "Nội dung không còn tồn tại." : "Chưa tải được nội dung báo cáo.")}</p>
                      <Button variant="secondary" disabled={loadingReportId === String(r.id)} onClick={() => openReport(r)}>{loadingReportId === String(r.id) ? "Đang tải nội dung..." : "Xem nội dung"}</Button>
                    </article>
                  )
                })}
              </div>
            </div>
            <div><h3>Nội dung chờ duyệt ({mod.posts.length})</h3>
              {mod.posts.length === 0 && <p className="aside-empty">Không có nội dung chờ duyệt.</p>}
              <div className="mod-review-list">
                {mod.posts.map((p) => (
                  <article className="mod-review-card" key={p.postId}>
                    <div className="mod-report-heading">
                      <strong>{p.poll ? "Bình chọn" : "Bài viết"} · {p.authorName}</strong>
                      {p.createdAt && <small>{timeAgo(p.createdAt)}</small>}
                    </div>
                    <p className="mod-review-snippet">{p.content || (p.mediaUrl ? "Bài viết có tệp đính kèm." : "Nội dung chưa có văn bản.")}</p>
                    <Button variant="secondary" onClick={() => setModerationTarget({ kind: "PENDING", item: p })}>Xem nội dung</Button>
                  </article>
                ))}
              </div>
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
          {isMember && (
            <section className="panel group-side-panel">
              <h3>Mời bạn bè</h3>
              <div className="group-friend-invite" ref={friendPickerRef}>
                <label className="inline-search group-friend-search">
                  <Icon name="search" size={16} />
                  <input value={friendSearch} onFocus={() => setFriendPickerOpen(true)} onChange={(event) => { setFriendSearch(event.target.value); setFriendPickerOpen(true) }} placeholder="Tìm bạn bè" aria-label="Tìm bạn bè để mời vào nhóm" aria-expanded={friendPickerOpen} />
                </label>
                {friendPickerOpen && (
                  <div className="group-friend-suggestions">
                    {matchingFriends.map((friend) => {
                      const invited = invitedFriendIds.has(String(friend.id))
                      const inviting = invitingFriendId === String(friend.id)
                      return (
                        <div className="group-friend-suggestion" key={friend.id}>
                          <Avatar name={friend.name} src={friend.avatar} size="sm" />
                          <div className="group-friend-suggestion-name"><strong>{friend.name}</strong><small>{friend.username ? `@${friend.username}` : "Bạn bè"}</small></div>
                          <button type="button" disabled={invited || Boolean(invitingFriendId)} onClick={() => inviteFriend(friend)}>{invited ? "Đã mời" : inviting ? "Đang gửi..." : "Mời"}</button>
                        </div>
                      )
                    })}
                    {matchingFriends.length === 0 && <p className="group-friend-empty">{friends.length ? "Không tìm thấy bạn bè phù hợp." : "Bạn chưa có bạn bè để mời."}</p>}
                  </div>
                )}
              </div>
            </section>
          )}
          {!privatePreview && (
            <section className="panel group-side-panel">
              <div className="section-heading group-events-sidebar-heading"><h3>Sự kiện nhóm</h3><button type="button" onClick={openAllEvents}>Xem tất cả</button></div>
              {!sidebarEvent && <p className="aside-empty">Chưa có sự kiện sắp diễn ra.</p>}
              {sidebarEvent && (
                <div className="group-event-item" key={sidebarEvent.eventId}>
                  {sidebarEvent.mediaUrl && <div className="group-event-item-media"><GroupPostMedia post={{ mediaUrl: sidebarEvent.mediaUrl, mediaType: sidebarEvent.mediaType }} /></div>}
                  <strong>{sidebarEvent.title}</strong>
                  <small>{fmt(sidebarEvent.startsAt)}{sidebarEvent.location ? ` · ${sidebarEvent.location}` : ""}</small>
                  <small>{sidebarEvent.participantCount} người tham gia · bởi {sidebarEvent.creatorName}</small>
                  <div className="group-event-actions">
                    <Button variant="secondary" onClick={() => setViewingEvent(sidebarEvent)}>Xem thông tin</Button>
                    {isMember && <Button variant={sidebarEvent.participating ? "primary" : "secondary"} onClick={() => participate(sidebarEvent.eventId)}>{sidebarEvent.participating ? "Đã tham gia" : "Tham gia"}</Button>}
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>

        <section className="group-main">
          {activeTab === "Thành viên" ? (
            <section className="panel group-members">
              <div className="section-heading"><h3>Thành viên</h3><span className="online-label">{members.length}</span></div>
              <div className="group-members-list">
              {orderedMembers.map((m) => (
                <div className="member-row" key={m.userId}>
                  <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${m.userId}`)}><Avatar name={m.name} src={m.avatar} /></span>
                  <div><strong>{m.name}</strong><small>{ROLE_LABEL[m.role] || "Thành viên"}</small></div>
                  {canModerate && String(m.userId) !== String(user?.userId) && m.role !== "OWNER" && (canManageRoles || m.role !== "ADMIN") && (
                    <>
                      <div className="menu-wrap" style={{ position: "relative", marginLeft: "auto" }}>
                        <button className="icon-button" aria-label={`Tùy chọn ${m.name}`} onClick={(event) => toggleMemberMenu(event, m)}><Icon name="more" /></button>
                      </div>
                      {menu === `m${m.userId}` && memberMenuPosition && createPortal(
                        <div className="pop-menu post-menu group-member-pop-menu" style={{ top: memberMenuPosition.top, left: memberMenuPosition.left }}>
                          {canManageRoles && <button onClick={() => manageMember(m, "role")}><Icon name="edit" size={15} />Đổi vai trò</button>}
                          <button className="danger" onClick={() => manageMember(m, "block")}><Icon name="lock" size={15} />Chặn thành viên</button>
                          <button className="danger" onClick={() => manageMember(m, "remove")}><Icon name="trash" size={15} />Xóa khỏi nhóm</button>
                        </div>,
                        document.body
                      )}
                    </>
                  )}
                </div>
              ))}
              </div>
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
          ) : activeTab === "Sự kiện" ? (
            <section className="panel group-events-page">
              <div className="group-events-page-heading">
                <h2>Sự kiện nhóm</h2>
                <p>Xem các sự kiện sắp diễn ra và những sự kiện đã kết thúc.</p>
              </div>
              <section className="group-event-featured">
                <div className="group-event-featured-heading">
                  <h3>Sự kiện hoạt động</h3>
                  <p>{featuredEventStatus === "ONGOING" ? "Sự kiện đang diễn ra trong nhóm." : featuredEvent ? "Sự kiện sắp tới gần nhất trong nhóm." : "Hiện không có sự kiện đang diễn ra hoặc sắp diễn ra."}</p>
                </div>
                {featuredEvent ? renderGroupEventCard(featuredEvent, true) : <p className="group-event-featured-empty">Sự kiện mới sẽ xuất hiện tại đây.</p>}
              </section>
              <div className="event-filters group-event-filter-tabs" role="tablist" aria-label="Lọc sự kiện nhóm">
                {EVENT_FILTERS.map(([value, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={eventFilter === value} className={eventFilter === value ? "active" : ""} onClick={() => setEventFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
              {filteredEvents.length === 0 ? (
                <EmptyState
                  title={eventFilter === "ALL" ? "Chưa có sự kiện nào" : eventFilter === "UPCOMING" ? "Không có sự kiện sắp diễn ra" : "Chưa có sự kiện kết thúc"}
                  copy={eventFilter === "ALL" ? "Sự kiện được tạo trong nhóm sẽ xuất hiện tại đây." : "Hãy chọn mục Tất cả để xem toàn bộ sự kiện trong nhóm."}
                  icon="calendar"
                />
              ) : (
                <div className="group-event-list">
                  {filteredEvents.map((event) => renderGroupEventCard(event))}
                </div>
              )}
            </section>
          ) : (
            <>
              {activeTab === "Bài viết" && isMember && (
                <form className="composer panel" onSubmit={composerMode === "POST" ? submitPost : composerMode === "POLL" ? submitPoll : createEvent}>
                  <div className="compose-modes">
                    <button type="button" className={composerMode === "POST" ? "selected" : ""} onClick={() => setComposerMode("POST")}>Bài viết</button>
                    <button type="button" className={composerMode === "POLL" ? "selected" : ""} onClick={() => setComposerMode("POLL")}>Bình chọn</button>
                    {isMember && <button type="button" className={composerMode === "EVENT" ? "selected" : ""} onClick={() => { setComposerMode("EVENT"); setEventForm((current) => current || { title: "", description: "", location: "", startsAt: "", endsAt: "" }) }}>Sự kiện</button>}
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
                  ) : composerMode === "POLL" ? (
                    <div className="form-grid group-poll-composer">
                      <label className="full">Câu hỏi<textarea rows={2} required maxLength={10000} value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} placeholder="Đặt câu hỏi..." /></label>
                      {poll.options.map((o, i) => (
                        <div className="full group-poll-choice" key={i}>
                          <label>Lựa chọn {i + 1}<input value={o} maxLength={120} onChange={(e) => setPoll((current) => ({ ...current, options: current.options.map((x, j) => (j === i ? e.target.value : x)) }))} /></label>
                          {poll.options.length > 2 && <button type="button" className="group-poll-choice-remove" aria-label={`Xóa lựa chọn ${i + 1}`} title="Xóa lựa chọn" onClick={() => setPoll((current) => ({ ...current, options: current.options.filter((_, j) => j !== i) }))}><Icon name="close" size={16} /></button>}
                        </div>
                      ))}
                      <div className="full group-poll-compose-controls">
                        {poll.options.length < 6 && <Button variant="secondary" onClick={() => setPoll((current) => ({ ...current, options: [...current.options, ""] }))}>Thêm lựa chọn</Button>}
                        <label className="group-poll-compose-end">
                          <span className="group-poll-deadline">
                            <span className="group-poll-deadline-label">Kết thúc</span>
                            <span className={`group-poll-deadline-value${pollEndAt ? " is-set" : ""}`}>{formatPollDeadline(pollEndAt)}</span>
                            <Icon name="calendar" size={16} />
                            <input className="group-poll-deadline-picker" aria-label="Thời gian kết thúc" type="datetime-local" lang="vi" value={pollEndAt} onChange={(e) => setPollEndAt(e.target.value)} onClick={showDateTimePicker} />
                          </span>
                        </label>
                        <Button type="submit" disabled={posting}>{posting ? "Đang tạo..." : "Tạo bình chọn"}</Button>
                      </div>
                    </div>
                  ) : eventForm && (
                    <div className="form-grid group-event-composer">
                      <label className="full">Tên sự kiện<input required maxLength={120} placeholder="Tên sự kiện" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></label>
                      <label className="full">Địa điểm<input maxLength={200} placeholder="Địa điểm" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></label>
                      <label>Bắt đầu<input required type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} /></label>
                      <label>Kết thúc<input type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} /></label>
                      <label className="full">Mô tả<textarea rows={3} maxLength={2000} placeholder="Mô tả sự kiện" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label>
                      <div className="full group-event-bottom-row">
                        <div className="group-event-media-field">
                          <input ref={eventMediaRef} type="file" accept="image/*,video/*" hidden onChange={(event) => setEventMediaFile(event.target.files?.[0] || null)} />
                          <button type="button" className="group-event-media-picker" onClick={() => eventMediaRef.current?.click()}><Icon name="image" size={18} /><span><strong>{eventMediaFile ? eventMediaFile.name : "Thêm ảnh hoặc video"}</strong><small>Ảnh hoặc video giúp mọi người dễ nhận biết sự kiện.</small></span><Icon name="plus" size={18} /></button>
                          {eventMediaPreview && (
                            <div className="group-event-media-preview">
                              {eventMediaFile.type.startsWith("video/") ? <video src={eventMediaPreview} controls /> : <img src={eventMediaPreview} alt="Xem trước ảnh sự kiện" />}
                              <button type="button" aria-label="Bỏ ảnh hoặc video sự kiện" onClick={() => { setEventMediaFile(null); setEventMediaPreview(""); if (eventMediaRef.current) eventMediaRef.current.value = "" }}><Icon name="close" size={16} /></button>
                            </div>
                          )}
                        </div>
                        <Button type="submit" disabled={posting || !eventForm.title.trim() || !eventForm.startsAt}>{posting ? "Đang tạo..." : "Tạo sự kiện"}</Button>
                      </div>
                    </div>
                  )}
                </form>
              )}
              <div className="group-post-toolbar">
                <h3>Bài viết</h3>
                {activeTab === "Bài viết" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <select className="toolbar-select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="NEWEST">Mới nhất</option><option value="OLDEST">Cũ nhất</option><option value="POPULAR">Nổi bật</option></select>
                  </div>
                )}
              </div>
              {posts.length === 0 && <EmptyState title="Chưa có bài viết" copy={isMember ? "Hãy bắt đầu cuộc trò chuyện đầu tiên trong nhóm." : "Tham gia nhóm để xem và đăng bài."} icon="forum" />}
              {orderedPosts.map((p) => {
                const picked = POST_REACTIONS.find((r) => r.type === p.viewerReaction)
                const comments = p.comments || []
                return (
                  <article className={`post panel${menu === `p${p.postId}` ? " group-post-menu-open" : ""}`} key={p.postId}>
                    {p.pinned && <div className="pinned-label"><Icon name="pin" size={14} /> {p.poll ? "Bình chọn đã ghim" : "Bài viết đã ghim"}</div>}
                    <header className="post-head">
                      <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${p.authorId}`)}><Avatar name={p.authorName} src={p.authorAvatar} /></span>
                      <div><strong>{p.authorName}</strong><span>{fmt(p.createdAt)}</span></div>
                      <div className="menu-wrap" style={{ marginLeft: "auto", position: "relative" }}>
                        <button className="icon-button" aria-label={`Tùy chọn ${p.poll ? "bình chọn" : "bài viết"}`} onClick={() => setMenu(menu === `p${p.postId}` ? null : `p${p.postId}`)}><Icon name="more" /></button>
                        {menu === `p${p.postId}` && (
                          <div className="pop-menu post-menu saved-item-menu">
                            <button onClick={() => toggleSave(p)}><Icon name="bookmark" size={16} />{saved[p.postId] ? (p.poll ? "Bỏ lưu bình chọn" : "Bỏ lưu bài viết") : (p.poll ? "Lưu bình chọn" : "Lưu bài viết")}</button>
                            {authored(p) && <button onClick={() => editPost(p)}><Icon name="edit" size={16} />{p.poll ? "Sửa bình chọn" : "Sửa bài viết"}</button>}
                            {canModerate && <button onClick={() => pin(p)}><Icon name="pin" size={16} />{p.pinned ? (p.poll ? "Bỏ ghim bình chọn" : "Bỏ ghim bài viết") : (p.poll ? "Ghim bình chọn" : "Ghim bài viết")}</button>}
                            {!authored(p) && isMember && <button onClick={() => reportPost(p)}><Icon name="flag" size={16} />{p.poll ? "Báo cáo bình chọn" : "Báo cáo bài viết"}</button>}
                            {(authored(p) || canModerate) && <button className="danger" onClick={() => { setMenu(null); setPostToDelete(p) }}><Icon name="trash" size={16} />{p.poll ? "Xóa bình chọn" : "Xóa bài viết"}</button>}
                          </div>
                        )}
                      </div>
                    </header>
                    {p.content && <div className="post-copy"><p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.content}</p></div>}
                    {p.poll && <PollCard post={p} canVote={isMember} onVote={votePoll} />}
                    {p.mediaUrl && <GroupPostMedia post={p} onOpenPost={() => setOpenComments((o) => ({ ...o, [p.postId]: true }))} />}
                    <div className="post-meta"><span><b>♥</b> {p.reactionCount} lượt thích</span><span>{comments.length} bình luận</span></div>
                    <div className="post-actions" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                      <button type="button" className={picked ? "liked" : ""} aria-pressed={Boolean(picked)} disabled={!isMember} onClick={() => react(p, picked?.type || "LIKE")}><Icon name="heart" />Thích</button>
                      <button type="button" onClick={() => setOpenComments((o) => ({ ...o, [p.postId]: true }))}><Icon name="comment" />Bình luận</button>
                    </div>
                    {openComments[p.postId] && (
                      <Modal title={`${p.poll ? "Bình chọn" : "Bài viết"} của ${p.authorName}`} close={() => closePostComments(p.postId)} wide className="post-comments-modal" backdropClassName="post-comments-backdrop" portal preservePage>
                        <div className="post-comments-dialog">
                          <div className="post-comments-scroll">
                            <div className="post-comments-author">
                              <Avatar name={p.authorName} src={p.authorAvatar} />
                              <div><strong>{p.authorName}</strong><span>{fmt(p.createdAt)} · {group.name}</span></div>
                              <div className="menu-wrap group-comments-post-menu">
                                <button type="button" className="icon-button" aria-label={`Tùy chọn ${p.poll ? "bình chọn" : "bài viết"}`} onClick={() => setMenu(menu === `cp${p.postId}` ? null : `cp${p.postId}`)}><Icon name="more" /></button>
                                {menu === `cp${p.postId}` && <div className="pop-menu post-menu">
                                  <button onClick={() => toggleSave(p)}><Icon name="bookmark" size={16} />{saved[p.postId] ? (p.poll ? "Bỏ lưu bình chọn" : "Bỏ lưu bài viết") : (p.poll ? "Lưu bình chọn" : "Lưu bài viết")}</button>
                                  {authored(p) && <button onClick={() => editPost(p)}><Icon name="edit" size={16} />{p.poll ? "Sửa bình chọn" : "Sửa bài viết"}</button>}
                                  {canModerate && <button onClick={() => pin(p)}><Icon name="pin" size={16} />{p.pinned ? (p.poll ? "Bỏ ghim bình chọn" : "Bỏ ghim bài viết") : (p.poll ? "Ghim bình chọn" : "Ghim bài viết")}</button>}
                                  {!authored(p) && isMember && <button onClick={() => reportPost(p)}><Icon name="flag" size={16} />{p.poll ? "Báo cáo bình chọn" : "Báo cáo bài viết"}</button>}
                                  {(authored(p) || canModerate) && <button className="danger" onClick={() => { setMenu(null); setPostToDelete(p) }}><Icon name="trash" size={16} />{p.poll ? "Xóa bình chọn" : "Xóa bài viết"}</button>}
                                </div>}
                              </div>
                            </div>
                            {p.content && <p className="post-comments-copy">{p.content}</p>}
                            {p.poll && <PollCard post={p} canVote={isMember} onVote={votePoll} />}
                            {p.mediaUrl && <div className="group-comments-media"><GroupPostMedia post={p} /></div>}
                            <div className="post-viewer-stats">♥ {p.reactionCount || 0} lượt thích <span>{comments.length} bình luận</span></div>
                            <div className="post-viewer-actions group-comments-actions">
                              <button type="button" className={picked ? "liked" : ""} aria-pressed={Boolean(picked)} disabled={!isMember} onClick={() => react(p, picked?.type || "LIKE")}><Icon name="heart" />Thích</button>
                              <button type="button" onClick={() => commentListRefs.current[p.postId]?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon name="comment" />Bình luận</button>
                            </div>
                            <div className="post-comments-list" ref={(element) => { commentListRefs.current[p.postId] = element }}>
                              {comments.map((c) => <div className={`post-viewer-comment ${c.parentCommentId ? "reply" : ""}`} key={c.commentId}>
                                <button type="button" className="post-viewer-comment-profile" aria-label={`Mở trang cá nhân của ${c.authorName}`} onClick={() => { closePostComments(p.postId); navigate(`/profile/${c.authorId}`) }}><Avatar name={c.authorName} src={c.authorAvatar} size="sm" /></button>
                                <div className="post-viewer-comment-body">
                                  <div className="post-viewer-comment-meta"><button type="button" onClick={() => { closePostComments(p.postId); navigate(`/profile/${c.authorId}`) }}>{c.authorName}</button><small>{timeAgo(c.createdAt)}</small></div>
                                  <p>{c.content}</p>
                                  <span className="group-comment-links">{isMember && !c.parentCommentId && <button className="link-btn" onClick={() => setReplyTo({ postId: p.postId, commentId: c.commentId, name: c.authorName })}>Trả lời</button>}{(String(c.authorId) === String(user?.userId) || canModerate) && <button className="link-btn" onClick={() => setCommentToDelete(c)}>Xóa</button>}</span>
                                </div>
                              </div>)}
                              {comments.length === 0 && <p className="post-viewer-empty">Chưa có bình luận nào.</p>}
                            </div>
                          </div>
                          {isMember && <form className="post-viewer-comment-form" onSubmit={(e) => comment(p, e)}>
                            <input value={commentDraft[p.postId] || ""} onChange={(e) => setCommentDraft((d) => ({ ...d, [p.postId]: e.target.value }))} placeholder={replyTo?.postId === p.postId ? `Trả lời ${replyTo.name}...` : "Viết bình luận..."} maxLength={2000} />
                            <button type="submit" disabled={!(commentDraft[p.postId] || "").trim()}>Gửi</button>
                          </form>}
                        </div>
                      </Modal>
                    )}
                  </article>
                )
              })}
            </>
          )}
        </section>
      </div>

      {(commentToDelete || postToDelete) && createPortal(
          <div className="group-comment-confirm-layer" onMouseDown={(event) => event.target === event.currentTarget && (setCommentToDelete(null), setPostToDelete(null))}>
            <div className="modal collection-delete-modal group-comment-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="group-comment-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
              <header>
                <h2 id="group-comment-confirm-title">{postToDelete ? (postToDelete.poll ? "Xóa bình chọn" : "Xóa bài viết") : "Xóa bình luận"}</h2>
                <button type="button" aria-label="Đóng" onClick={() => { setCommentToDelete(null); setPostToDelete(null) }}><Icon name="close" /></button>
              </header>
              <div className="collection-delete-content">
                <span className="collection-delete-icon"><Icon name="trash" size={20} /></span>
                <div>
                  <strong>Bạn có chắc muốn xóa {postToDelete ? (postToDelete.poll ? "bình chọn" : "bài viết") : "bình luận"} này?</strong>
                  <p>{postToDelete ? (postToDelete.poll ? "Bình chọn và các lượt chọn sẽ bị xóa khỏi nhóm, không thể khôi phục." : "Bài viết sẽ bị xóa khỏi nhóm và không thể khôi phục.") : "Bình luận sẽ bị xóa khỏi bài viết trong nhóm."}</p>
                </div>
              </div>
              <div className="modal-actions">
                <Button variant="secondary" disabled={deletingComment || deletingPost} onClick={() => { setCommentToDelete(null); setPostToDelete(null) }}>Hủy</Button>
                <Button variant="danger" disabled={deletingComment || deletingPost} onClick={postToDelete ? removePost : removeComment}>{deletingPost ? "Đang xóa..." : deletingComment ? "Đang xóa..." : postToDelete ? (postToDelete.poll ? "Xóa bình chọn" : "Xóa bài viết") : "Xóa bình luận"}</Button>
              </div>
            </div>
          </div>
        , document.body
      )}

      {reportingPost && (
        <Modal title={`Báo cáo ${reportingPost.poll ? "bình chọn" : "bài viết"}`} close={closeReport} portal preservePage>
          <form onSubmit={submitReport}>
            <div className="form-grid">
              <label className="full">Lý do báo cáo<textarea autoFocus rows={4} maxLength={500} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Hãy mô tả lý do bạn báo cáo nội dung này." /></label>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" disabled={sendingReport} onClick={closeReport}>Hủy</Button>
              <Button type="submit" disabled={sendingReport || !reportReason.trim()}>{sendingReport ? "Đang gửi..." : "Gửi báo cáo"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {editingPost && (
        <Modal title={editingPost.poll ? "Sửa bình chọn" : "Sửa bài viết"} portal preservePage close={() => { if (!savingEdit) { setEditingPost(null); setEditFile(null); setEditFilePreview(""); setRemoveCurrentMedia(false) } }}>
          <form onSubmit={saveEditedPost}>
            <div className="form-grid">
              <label className="full">{editingPost.poll ? "Câu hỏi" : "Nội dung"}<textarea rows={editingPost.poll ? 2 : 6} maxLength={10000} autoFocus value={editDraft} onChange={(event) => setEditDraft(event.target.value)} placeholder={editingPost.poll ? "Đặt câu hỏi..." : "Bạn muốn chia sẻ điều gì?"} /></label>
              {editingPost.poll ? (
                <>
                  {editPollOptions.map((option, index) => (
                    <div className="full group-poll-choice" key={index}>
                      <label>Lựa chọn {index + 1}<input value={option} maxLength={120} onChange={(event) => setEditPollOptions((current) => current.map((value, i) => i === index ? event.target.value : value))} /></label>
                      {editPollOptions.length > 2 && <button type="button" className="group-poll-choice-remove" aria-label={`Xóa lựa chọn ${index + 1}`} title="Xóa lựa chọn" onClick={() => setEditPollOptions((current) => current.filter((_, i) => i !== index))}><Icon name="close" size={16} /></button>}
                    </div>
                  ))}
                  <div className="full group-poll-edit-controls">
                    {editPollOptions.length < 10 && <Button type="button" variant="secondary" onClick={() => setEditPollOptions((current) => [...current, ""])}>Thêm lựa chọn</Button>}
                    <label className="group-poll-end-field">
                      <span className="group-poll-deadline">
                        <span className="group-poll-deadline-label">Kết thúc</span>
                        <span className={`group-poll-deadline-value${editPollEndAt ? " is-set" : ""}`}>{formatPollDeadline(editPollEndAt)}</span>
                        <Icon name="calendar" size={16} />
                        <input className="group-poll-deadline-picker" aria-label="Thời gian kết thúc" type="datetime-local" lang="vi" value={editPollEndAt} onChange={(event) => setEditPollEndAt(event.target.value)} onClick={showDateTimePicker} />
                      </span>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className="full">Thêm ảnh hoặc video<span className="group-file-picker"><span>{editFile ? editFile.name : "Chọn ảnh hoặc video"}</span><input ref={editFileRef} type="file" accept="image/*,video/*" onChange={(event) => { const nextFile = event.target.files?.[0] || null; setEditFile(nextFile); if (nextFile) setRemoveCurrentMedia(false) }} /></span></label>
                  {editFile && editFilePreview ? (
                    <div className="full group-edit-media-preview">
                      {editFile.type.startsWith("video/") ? <video src={editFilePreview} controls /> : <img src={editFilePreview} alt="Xem trước tệp mới" />}
                      <Button type="button" variant="secondary" disabled={savingEdit} onClick={() => { setEditFile(null); setEditFilePreview(""); if (editFileRef.current) editFileRef.current.value = "" }}>Bỏ tệp mới</Button>
                    </div>
                  ) : editingPost.mediaUrl ? (
                    <div className="full edit-current-media-options">
                      <p className="aside-empty">{removeCurrentMedia ? "Tệp đính kèm hiện tại sẽ bị xóa khi lưu." : "Tệp đính kèm hiện tại sẽ được giữ nguyên nếu không chọn tệp mới."}</p>
                      <label className="check-row"><input type="checkbox" checked={removeCurrentMedia} onChange={(event) => setRemoveCurrentMedia(event.target.checked)} />Xóa ảnh/video hiện tại</label>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" disabled={savingEdit} onClick={() => { setEditingPost(null); setEditFile(null); setEditFilePreview(""); setRemoveCurrentMedia(false) }}>Hủy</Button>
              <Button type="submit" disabled={savingEdit || (editingPost.poll ? (!editDraft.trim() || editPollOptions.filter((option) => option.trim()).length < 2) : (!editDraft.trim() && !(editingPost.mediaUrl && !removeCurrentMedia) && !editFile))}>{savingEdit ? "Đang lưu..." : editingPost.poll ? "Lưu bình chọn" : "Lưu thay đổi"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {settingsOpen && settings && (
        <Modal title="Cài đặt nhóm" close={() => setSettingsOpen(false)} wide>
          <form onSubmit={saveSettings}>
            <div className="form-grid">
              <label>Ảnh đại diện<span className="group-file-picker"><span>Chọn tệp</span><input type="file" accept="image/*" onChange={(e) => uploadImage("avatar", e)} /></span></label>
              <label>Ảnh bìa<span className="group-file-picker"><span>Chọn tệp</span><input type="file" accept="image/*" onChange={(e) => uploadImage("coverImage", e)} /></span></label>
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

      {roleTarget && (
        <Modal title={`Đổi vai trò của ${roleTarget.name}`} close={() => { if (!savingMemberRole) setRoleTarget(null) }}>
          <form onSubmit={saveMemberRole}>
            <p className="aside-empty">Chủ nhóm có thể đặt thành viên làm phó nhóm hoặc đưa về vai trò thành viên.</p>
            <div className="form-grid">
              <label className="full">Vai trò
                <select value={memberRoleValue} onChange={(event) => setMemberRoleValue(event.target.value)}>
                  <option value="ADMIN">Phó nhóm</option>
                  <option value="MEMBER">Thành viên</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" disabled={savingMemberRole} onClick={() => setRoleTarget(null)}>Hủy</Button>
              <Button type="submit" disabled={savingMemberRole}>{savingMemberRole ? "Đang lưu..." : "Lưu vai trò"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {memberActionTarget && (
        <Modal
          title={memberActionTarget.action === "block" ? "Chặn thành viên" : "Xóa thành viên khỏi nhóm"}
          close={() => { if (!savingMemberAction) { setMemberActionTarget(null); setMemberActionReason("") } }}
          className="group-member-action-modal"
        >
          <form onSubmit={submitMemberAction}>
            <div className={`group-member-action-summary ${memberActionTarget.action}`}>
              <span className="group-member-action-icon"><Icon name={memberActionTarget.action === "block" ? "lock" : "trash"} size={19} /></span>
              <div>
                <strong>{memberActionTarget.member.name}</strong>
                <p>{memberActionTarget.action === "block"
                  ? "Tài khoản này sẽ không tìm thấy hoặc truy cập được nhóm. Chủ nhóm và phó nhóm có thể gỡ chặn sau."
                  : "Thành viên sẽ rời khỏi nhóm và có thể tham gia lại nếu nhóm cho phép."}</p>
              </div>
            </div>
            {memberActionTarget.action === "block" && (
              <label className="group-member-action-reason">
                <span className="group-member-action-label"><strong>Lý do chặn</strong><small>(không bắt buộc)</small></span>
                <textarea rows={3} maxLength={500} value={memberActionReason} onChange={(event) => setMemberActionReason(event.target.value)} placeholder="Nhập lý do để lưu trong danh sách bị chặn..." />
              </label>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" disabled={savingMemberAction} onClick={() => { setMemberActionTarget(null); setMemberActionReason("") }}>Hủy</Button>
              <Button type="submit" variant="danger" disabled={savingMemberAction}>
                {savingMemberAction ? "Đang xử lý..." : memberActionTarget.action === "block" ? "Chặn thành viên" : "Xóa khỏi nhóm"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {moderationTarget && (
        <Modal
          title={moderationTarget.kind === "PENDING"
            ? `Xem ${moderationTarget.item.poll ? "bình chọn" : "bài viết"} chờ duyệt`
            : "Kiểm tra nội dung bị báo cáo"}
          close={() => setModerationTarget(null)}
          wide
          className="group-admin-review-modal"
          portal
          preservePage
        >
          <div className="group-admin-review-detail">
            {moderationTarget.kind === "PENDING" ? (
              <ModerationPostPreview post={moderationTarget.item} expanded />
            ) : (
              <>
                <section className="group-admin-report-context">
                  <div><strong>{moderationTarget.item.reporter} đã báo cáo nội dung</strong><small>{fmt(moderationTarget.item.createdAt)}</small></div>
                  <p><strong>Lý do báo cáo:</strong> {moderationTarget.item.reason || "Không có lý do."}</p>
                </section>
                {moderationTarget.item.targetPost && <ModerationPostPreview post={moderationTarget.item.targetPost} expanded />}
                {moderationTarget.item.targetComment && (
                  <div className="mod-target-comment">
                    <strong>Bình luận của {moderationTarget.item.targetComment.authorName || "Không rõ người bình luận"}</strong>
                    {moderationTarget.item.targetComment.createdAt && <small>{fmt(moderationTarget.item.targetComment.createdAt)}</small>}
                    <p>{moderationTarget.item.targetComment.content || "Bình luận không có nội dung."}</p>
                  </div>
                )}
                {moderationTarget.item.previewUnavailable && <p className="mod-target-missing">Không tải được bài viết gốc nên chưa thể xem đầy đủ nội dung. Hãy đóng hộp thoại và thử mở lại.</p>}
                {moderationTarget.item.targetExists === false && <p className="mod-target-missing">Nội dung đã bị xóa hoặc không còn tồn tại. Bạn vẫn có thể bỏ qua báo cáo này.</p>}
              </>
            )}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModerationTarget(null)}>Đóng</Button>
            {moderationTarget.kind === "PENDING" ? (
              <>
                <Button variant="danger" onClick={() => decide(
                  () => groupApi.reviewPost(groupId, moderationTarget.item.postId, false),
                  "Đã từ chối nội dung.", "Không thể từ chối nội dung.", () => setModerationTarget(null)
                )}>Từ chối {moderationTarget.item.poll ? "bình chọn" : "bài viết"}</Button>
                <Button onClick={() => decide(
                  () => groupApi.reviewPost(groupId, moderationTarget.item.postId, true),
                  "Đã duyệt nội dung.", "Không thể duyệt nội dung.", () => setModerationTarget(null)
                )}>Duyệt {moderationTarget.item.poll ? "bình chọn" : "bài viết"}</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => decide(
                  () => groupApi.decideReport(groupId, moderationTarget.item.id, false),
                  "Đã bỏ qua báo cáo.", "Không thể xử lý báo cáo.", () => setModerationTarget(null)
                )}>Bỏ qua báo cáo</Button>
                <Button variant="danger" disabled={moderationTarget.item.targetExists === false || moderationTarget.item.previewUnavailable} onClick={() => decide(
                  () => groupApi.decideReport(groupId, moderationTarget.item.id, true),
                  "Đã gỡ nội dung bị báo cáo.", "Không thể gỡ nội dung.", () => setModerationTarget(null)
                )}>Gỡ {moderationTarget.item.targetType === "COMMENT" ? "bình luận" : moderationTarget.item.targetPost?.poll ? "bình chọn" : "bài viết"}</Button>
              </>
            )}
          </div>
        </Modal>
      )}

      {groupActionConfirm && createPortal(
        <div
          className={`group-confirm-layer ${groupActionConfirm}`}
          onMouseDown={(event) => event.target === event.currentTarget && !savingGroupAction && setGroupActionConfirm(null)}
        >
          <section className="group-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="group-action-confirm-title">
            <header>
              <h2 id="group-action-confirm-title">{groupActionConfirm === "delete" ? "Xóa nhóm" : "Rời khỏi nhóm"}</h2>
              <button type="button" aria-label="Đóng" disabled={savingGroupAction} onClick={() => setGroupActionConfirm(null)}><Icon name="close" /></button>
            </header>
            <div className={`group-member-action-summary group-confirm-summary ${groupActionConfirm === "delete" ? "remove" : "leave"}`}>
              <span className="group-member-action-icon"><Icon name={groupActionConfirm === "delete" ? "trash" : "group"} size={19} /></span>
              <div>
                <strong>{group.name}</strong>
                <p>{groupActionConfirm === "delete"
                  ? "Toàn bộ bài viết, bình chọn, sự kiện và thành viên của nhóm sẽ bị xóa. Hành động này không thể hoàn tác."
                  : "Bạn sẽ rời khỏi nhóm. Bạn có thể tham gia lại sau nếu nhóm cho phép."}</p>
              </div>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" disabled={savingGroupAction} onClick={() => setGroupActionConfirm(null)}>Hủy</Button>
              <Button type="button" variant="danger" disabled={savingGroupAction} onClick={submitGroupAction}>
                {savingGroupAction ? "Đang xử lý..." : groupActionConfirm === "delete" ? "Xóa nhóm" : "Rời nhóm"}
              </Button>
            </div>
          </section>
        </div>,
        document.body
      )}

      {viewingEvent && (
        <Modal title="Thông tin sự kiện" close={() => setViewingEvent(null)} wide portal preservePage>
          <div className="group-event-info">
            {viewingEvent.mediaUrl && <div className={`group-event-info-media${viewingEvent.mediaType === "VIDEO" ? " video" : ""}`}><GroupPostMedia post={{ mediaUrl: viewingEvent.mediaUrl, mediaType: viewingEvent.mediaType }} /></div>}
            <div className="group-event-info-content">
              <div className="group-event-info-heading">
                <span>SỰ KIỆN NHÓM</span>
                <h2>{viewingEvent.title}</h2>
              </div>
              <section className="group-event-description">
                <h3>Mô tả</h3>
                <p className={viewingEvent.description ? "" : "empty"}>{viewingEvent.description || "Sự kiện chưa có mô tả."}</p>
              </section>
              <div className="group-event-info-grid">
                <div className="group-event-detail-card">
                  <span className="group-event-detail-icon"><Icon name="calendar" size={18} /></span>
                  <div><small>Thời gian bắt đầu</small><strong>{fmt(viewingEvent.startsAt)}</strong>{viewingEvent.endsAt && <span>Kết thúc {fmt(viewingEvent.endsAt)}</span>}</div>
                </div>
                <div className="group-event-detail-card">
                  <span className="group-event-detail-icon"><Icon name="location" size={18} /></span>
                  <div><small>Địa điểm</small><strong>{viewingEvent.location || "Chưa cập nhật"}</strong></div>
                </div>
                <div className="group-event-detail-card">
                  <span className="group-event-detail-icon"><Icon name="users" size={18} /></span>
                  <div><small>Người tham gia</small><strong>{viewingEvent.participantCount ?? 0} người</strong></div>
                </div>
                <div className="group-event-detail-card">
                  <span className="group-event-detail-icon"><Icon name="group" size={18} /></span>
                  <div><small>Người tạo</small><strong>{viewingEvent.creatorName || "Không rõ"}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
