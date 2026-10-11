import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { friendApi } from '../api/friendApi'
import { groupApi } from '../api/groupApi'
import { savedApi } from '../api/savedApi'
import Avatar from '../components/Avatar'

const tabs = ['Bài viết', 'Thành viên', 'Media', 'Giới thiệu']
const reactions = [
  { type: 'LIKE', label: 'Thích', emoji: '👍' },
  { type: 'LOVE', label: 'Yêu thích', emoji: '❤️' },
  { type: 'HAHA', label: 'Haha', emoji: '😂' },
  { type: 'WOW', label: 'Wow', emoji: '😮' },
  { type: 'ANGRY', label: 'Phẫn nộ', emoji: '😡' },
]

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

function PollCard({ post, canVote, onVote }) {
  const options = post.poll?.options || []
  const totalVotes = options.reduce((total, option) => total + option.votes, 0)
  const ended = post.poll?.endsAt && new Date(post.poll.endsAt) <= new Date()
  return <section className="group-poll-card" aria-label="Bình chọn">
    {options.map((option) => <button type="button" key={option.optionId} disabled={!canVote || ended} className={`group-poll-option ${option.selected ? 'selected' : ''}`} onClick={() => onVote(post, option.optionId)}>
      <span className="group-poll-option-label">{option.label}</span><span className="group-poll-option-result"><i style={{ width: `${totalVotes ? Math.round(option.votes * 100 / totalVotes) : 0}%` }} /><b>{option.votes}</b></span>
    </button>)}
    <p>{totalVotes} lượt chọn{post.poll?.endsAt ? ` · ${ended ? 'Đã kết thúc' : `Kết thúc ${formatDate(post.poll.endsAt)}`}` : ''}</p>
  </section>
}

export default function GroupDetailPage() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [posts, setPosts] = useState([])
  const [savedGroupPosts, setSavedGroupPosts] = useState({})
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [friends, setFriends] = useState([])
  const [tab, setTab] = useState('Bài viết')
  const [sort, setSort] = useState('NEWEST')
  const [search, setSearch] = useState('')
  const [content, setContent] = useState('')
  const [composerMode, setComposerMode] = useState('POST')
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollEndsAt, setPollEndsAt] = useState('')
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [eventDraft, setEventDraft] = useState({ title: '', description: '', location: '', startsAt: '', endsAt: '' })
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState('')
  const postFileInputRef = useRef(null)
  const [comments, setComments] = useState({})
  const [replyTo, setReplyTo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingRequests, setPendingRequests] = useState([])
  const [pendingPosts, setPendingPosts] = useState([])
  const [reports, setReports] = useState([])
  const [bans, setBans] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(null)

  const role = group?.role
  const isMember = Boolean(group?.joined)
  const canModerate = ['OWNER', 'ADMIN', 'MODERATOR'].includes(role)

  const loadGroup = async () => {
    setLoading(true)
    try {
      const { data } = await groupApi.get(groupId)
      setGroup(data)
      setSettings({ name: data.name, description: data.description || '', category: data.category || '', visibility: data.visibility, avatar: data.avatar || '', coverImage: data.coverImage || '', postApprovalRequired: data.postApprovalRequired, spamKeywords: data.spamKeywords || '' })
      setError('')
      const canViewPublic = data.visibility === 'PUBLIC'
      const [postResponse, memberResponse, eventResponse] = await Promise.all([
        data.joined || canViewPublic ? groupApi.posts(groupId, { search, sort, mediaOnly: tab === 'Media' }) : Promise.resolve({ data: [] }),
        data.joined || canViewPublic ? groupApi.members(groupId) : Promise.resolve({ data: [] }),
        groupApi.events(groupId),
      ])
      setPosts(postResponse.data || [])
      setMembers(memberResponse.data || [])
      setEvents(eventResponse.data || [])
    } catch (err) {
      setError(err.response?.status === 403 ? 'Đây là nhóm riêng tư. Bạn cần gửi yêu cầu tham gia để xem nội dung.' : err.response?.data?.message || 'Không thể tải nhóm.')
      setGroup(null)
    } finally { setLoading(false) }
  }

  const loadModeration = async () => {
    if (!canModerate) return
    const [requests, awaitingPosts, reported, banned] = await Promise.all([
      groupApi.joinRequests(groupId).catch(() => ({ data: [] })),
      groupApi.pendingPosts(groupId).catch(() => ({ data: [] })),
      groupApi.reports(groupId).catch(() => ({ data: [] })),
      groupApi.bans(groupId).catch(() => ({ data: [] })),
    ])
    setPendingRequests(requests.data || [])
    setPendingPosts(awaitingPosts.data || [])
    setReports(reported.data || [])
    setBans(banned.data || [])
  }

  useEffect(() => { loadGroup() }, [groupId, search, sort, tab])
  useEffect(() => {
    let active = true
    Promise.all(posts.map(async (post) => {
      try {
        const { data } = await savedApi.status('GROUP_POST', post.postId)
        return [post.postId, data.saved]
      } catch { return [post.postId, false] }
    })).then((entries) => { if (active) setSavedGroupPosts(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [posts])
  useEffect(() => { friendApi.accepted().then(({ data }) => setFriends(data || [])).catch(() => setFriends([])) }, [])
  useEffect(() => { loadModeration() }, [groupId, canModerate])
  useEffect(() => {
    if (!file) {
      setFilePreview('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(file)
    setFilePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [file])

  const announce = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3500) }

  const toggleSavedGroupPost = async (post) => {
    try {
      const { data } = await savedApi.toggle('GROUP_POST', post.postId)
      setSavedGroupPosts((current) => ({ ...current, [post.postId]: data.saved }))
      announce(data.saved ? 'Đã lưu bài viết nhóm.' : 'Đã bỏ lưu bài viết nhóm.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật nội dung đã lưu.') }
  }

  const openComments = (postId) => {
    const commentSection = document.getElementById(`group-comments-${postId}`)
    if (!commentSection) return
    commentSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => commentSection.querySelector('input')?.focus({ preventScroll: true }), 250)
  }

  const joinOrLeave = async () => {
    try {
      if (isMember) {
        if (!window.confirm('Bạn muốn rời nhóm này?')) return
        await groupApi.leave(groupId)
        announce('Bạn đã rời nhóm.')
      } else {
        const { data } = await groupApi.join(groupId)
        announce(data.status === 'PENDING' ? 'Yêu cầu tham gia đã được gửi.' : 'Bạn đã tham gia nhóm.')
      }
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật thành viên.') }
  }

  const submitPost = async (event) => {
    event.preventDefault()
    setPosting(true)
    try {
      let mediaUrl = null
      let mediaType = null
      if (file) {
        const upload = await groupApi.upload(groupId, file)
        mediaUrl = upload.data.url
        mediaType = upload.data.mediaType
      }
      await groupApi.createPost(groupId, { content, mediaUrl, mediaType })
      setContent('')
      setFile(null)
      if (postFileInputRef.current) postFileInputRef.current.value = ''
      announce(group.postApprovalRequired ? 'Bài viết đã gửi để kiểm duyệt.' : 'Bài viết đã được đăng.')
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể đăng bài.') }
    finally { setPosting(false) }
  }

  const clearSelectedFile = () => {
    setFile(null)
    if (postFileInputRef.current) postFileInputRef.current.value = ''
  }

  const submitPoll = async (event) => {
    event.preventDefault()
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)
    setPosting(true)
    try {
      await groupApi.createPoll(groupId, { question: pollQuestion, options, endsAt: pollEndsAt || null })
      setPollQuestion('')
      setPollOptions(['', ''])
      setPollEndsAt('')
      setComposerMode('POST')
      announce(group.postApprovalRequired ? 'Bình chọn đã gửi để kiểm duyệt.' : 'Đã tạo bình chọn.')
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể tạo bình chọn.') }
    finally { setPosting(false) }
  }

  const votePoll = async (post, optionId) => {
    try {
      const { data } = await groupApi.votePoll(groupId, post.postId, optionId)
      setPosts((current) => current.map((item) => item.postId === post.postId ? data : item))
    } catch (err) { announce(err.response?.data?.message || 'Không thể ghi nhận lựa chọn.') }
  }

  const createEvent = async (event) => {
    event.preventDefault()
    try {
      await groupApi.createEvent(groupId, { ...eventDraft, endsAt: eventDraft.endsAt || null })
      setEventDraft({ title: '', description: '', location: '', startsAt: '', endsAt: '' })
      setEventFormOpen(false)
      announce('Đã tạo sự kiện nhóm.')
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể tạo sự kiện.') }
  }

  const participateEvent = async (eventId) => {
    try { await groupApi.participateEvent(groupId, eventId); await loadGroup() }
    catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật tham gia sự kiện.') }
  }

  const react = async (post, type) => {
    try {
      const { data } = await groupApi.react(groupId, post.postId, type)
      setPosts((current) => current.map((item) => item.postId === post.postId ? data : item))
    } catch (err) { announce(err.response?.data?.message || 'Không thể bày tỏ cảm xúc.') }
  }

  const submitComment = async (postId, event) => {
    event.preventDefault()
    const text = comments[postId]?.trim()
    if (!text) return
    try {
      await groupApi.comment(groupId, postId, { content: text, parentCommentId: replyTo?.postId === postId ? replyTo.commentId : null })
      setComments((current) => ({ ...current, [postId]: '' }))
      setReplyTo(null)
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể bình luận.') }
  }

  const reportPost = async (post) => {
    const reason = window.prompt('Lý do báo cáo bài viết:')
    if (!reason?.trim()) return
    try { await groupApi.report(groupId, { targetType: 'POST', targetId: post.postId, reason: reason.trim() }); announce('Đã gửi báo cáo.') }
    catch (err) { announce(err.response?.data?.message || 'Không thể gửi báo cáo.') }
  }

  const manageMember = async (member, action) => {
    if (action === 'warn') {
      const reason = window.prompt(`Nội dung cảnh cáo ${member.name}:`)
      if (!reason?.trim()) return
      try { await groupApi.warnMember(groupId, member.userId, reason.trim()); announce('Đã gửi cảnh cáo đến thành viên.') }
      catch (err) { announce(err.response?.data?.message || 'Không thể gửi cảnh cáo.') }
      return
    }
    if (action === 'role') {
      const nextRole = window.prompt('Chọn vai trò: ADMIN, MODERATOR hoặc MEMBER', member.role)
      if (!nextRole) return
      try { await groupApi.changeRole(groupId, member.userId, nextRole); announce('Đã cập nhật vai trò.'); await loadGroup() }
      catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật vai trò.') }
      return
    }
    const reason = action === 'ban' ? window.prompt(`Lý do cấm ${member.name}:`) : ''
    if (action === 'ban' && reason == null) return
    if (!window.confirm(action === 'ban' ? `Cấm ${member.name} khỏi nhóm?` : `Xóa ${member.name} khỏi nhóm?`)) return
    try {
      if (action === 'ban') await groupApi.banMember(groupId, member.userId, reason)
      else await groupApi.removeMember(groupId, member.userId)
      announce(action === 'ban' ? 'Đã cấm thành viên.' : 'Đã xóa thành viên.')
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể thực hiện thao tác.') }
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    try {
      await groupApi.update(groupId, settings)
      setSettingsOpen(false)
      announce('Đã cập nhật thông tin nhóm.')
      await loadGroup()
    } catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật nhóm.') }
  }

  const uploadGroupImage = async (field, event) => {
    const image = event.target.files?.[0]
    if (!image) return
    try {
      const { data } = await groupApi.upload(groupId, image, 'GROUP_IMAGE')
      if (data.mediaType !== 'IMAGE') throw new Error('Chọn ảnh hợp lệ.')
      setSettings((current) => ({ ...current, [field]: data.url }))
    } catch (err) { announce(err.response?.data?.message || err.message || 'Không thể tải ảnh lên.') }
    event.target.value = ''
  }

  const unbanMember = async (member) => {
    if (!window.confirm(`Bỏ cấm ${member.name}?`)) return
    try { await groupApi.unbanMember(groupId, member.userId); await loadModeration(); announce('Đã bỏ cấm thành viên.') }
    catch (err) { announce(err.response?.data?.message || 'Không thể bỏ cấm thành viên.') }
  }

  const deleteGroup = async () => {
    if (!window.confirm('Xóa nhóm và toàn bộ bài viết, thành viên? Thao tác này không thể hoàn tác.')) return
    try { await groupApi.remove(groupId); window.location.assign('/groups') }
    catch (err) { announce(err.response?.data?.message || 'Không thể xóa nhóm.') }
  }

  const decideJoin = async (requestId, approved) => {
    try { await groupApi.decideJoin(groupId, requestId, approved); await loadModeration(); await loadGroup(); announce(approved ? 'Đã duyệt thành viên.' : 'Đã từ chối yêu cầu.') }
    catch (err) { announce(err.response?.data?.message || 'Không thể xử lý yêu cầu.') }
  }

  const decidePost = async (postId, approved) => {
    try { await groupApi.reviewPost(groupId, postId, approved); await loadModeration(); await loadGroup(); announce(approved ? 'Đã duyệt bài viết.' : 'Đã từ chối bài viết.') }
    catch (err) { announce(err.response?.data?.message || 'Không thể xử lý bài viết.') }
  }

  const decideReport = async (report, removeContent) => {
    try { await groupApi.decideReport(groupId, report.id, removeContent); await loadModeration(); await loadGroup(); announce(removeContent ? 'Đã gỡ nội dung.' : 'Đã đóng báo cáo.') }
    catch (err) { announce(err.response?.data?.message || 'Không thể xử lý báo cáo.') }
  }

  const inviteFriend = async (event) => {
    const userId = Number(event.target.value)
    if (!userId) return
    try { await groupApi.invite(groupId, userId); announce('Đã gửi lời mời.'); event.target.value = '' }
    catch (err) { announce(err.response?.data?.message || 'Không thể mời bạn bè.') }
  }

  if (loading) return <main className="groups-page group-detail-page"><div className="groups-loading"><span className="group-spinner" />Đang tải nhóm...</div></main>
  if (!group) return <main className="groups-page group-detail-page"><Link className="group-back-link" to="/groups">← Tất cả nhóm</Link><div className="groups-state group-private-state"><span className="group-empty-mark">◌</span><strong>Không thể mở nhóm</strong><span>{error}</span><button type="button" className="group-primary-button" onClick={joinOrLeave}>Gửi yêu cầu tham gia</button></div></main>

  return (
    <main className="groups-page group-detail-page">
      <Link className="group-back-link" to="/groups">← Tất cả nhóm</Link>
      <header className="group-cover" style={group.coverImage ? { backgroundImage: `linear-gradient(0deg, rgba(8, 15, 22, .76), rgba(8, 15, 22, .05)), url("${group.coverImage}")` } : undefined}>
        {!group.coverImage && <div className="group-cover-pattern" aria-hidden="true" />}
        <div className="group-cover-title"><div className="group-avatar-large">{group.avatar ? <img src={group.avatar} alt="" /> : group.name.slice(0, 1).toUpperCase()}</div><div><span className="groups-kicker">{group.visibility === 'PRIVATE' ? 'NHÓM RIÊNG TƯ' : 'NHÓM CÔNG KHAI'}</span><h1>{group.name}</h1><p>{group.memberCount} thành viên <span>·</span> {group.category || 'Cộng đồng'}</p></div></div>
      </header>
      <section className="group-info-bar"><p>{group.description || 'Chưa có mô tả cho nhóm này.'}</p><div className="group-actions">
        {isMember ? <button className="group-secondary-button" type="button" onClick={joinOrLeave}>Rời nhóm</button> : <button className="group-primary-button" type="button" onClick={joinOrLeave}>{group.visibility === 'PRIVATE' ? 'Yêu cầu tham gia' : 'Tham gia nhóm'}</button>}
        {canModerate && <button className="group-secondary-button" type="button" onClick={() => setShowAdmin((open) => !open)}>{showAdmin ? 'Đóng quản trị' : 'Quản trị'}</button>}
      </div></section>
      <nav className="group-detail-tabs" aria-label="Nội dung nhóm">{tabs.map((item) => <button type="button" key={item} onClick={() => setTab(item)} className={tab === item ? 'selected' : ''}>{item}{item === 'Thành viên' && <span>{members.length}</span>}</button>)}</nav>
      {notice && <div className="group-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}

      {showAdmin && canModerate && <section className="group-admin-panel"><div className="group-admin-heading"><div><span className="groups-kicker">KHÔNG GIAN QUẢN TRỊ</span><h2>Kiểm duyệt nhóm</h2></div><button type="button" className="group-secondary-button" onClick={() => setSettingsOpen(true)}>Cài đặt nhóm</button></div>
        <div className="group-admin-grid">
          <section><h3>Yêu cầu tham gia <span>{pendingRequests.length}</span></h3>{pendingRequests.length === 0 ? <p className="group-muted">Không có yêu cầu đang chờ.</p> : pendingRequests.map((request) => <div className="group-moderation-row" key={request.id}><Avatar src={request.avatar} name={request.name} size={34} /><strong>{request.name}</strong><button type="button" className="group-primary-button compact" onClick={() => decideJoin(request.id, true)}>Duyệt</button><button type="button" className="group-quiet-button" onClick={() => decideJoin(request.id, false)}>Từ chối</button></div>)}</section>
          <section><h3>Bài viết chờ duyệt <span>{pendingPosts.length}</span></h3>{pendingPosts.length === 0 ? <p className="group-muted">Không có bài viết chờ duyệt.</p> : pendingPosts.map((post) => <div className="group-review-row" key={post.postId}><strong>{post.authorName}</strong><p>{post.content || 'Tệp đính kèm'}</p><div><button type="button" className="group-primary-button compact" onClick={() => decidePost(post.postId, true)}>Duyệt</button><button type="button" className="group-quiet-button" onClick={() => decidePost(post.postId, false)}>Từ chối</button></div></div>)}</section>
          <section><h3>Báo cáo <span>{reports.length}</span></h3>{reports.length === 0 ? <p className="group-muted">Không có báo cáo mới.</p> : reports.map((report) => <div className="group-review-row" key={report.id}><strong>{report.targetType} · {report.reason}</strong><p>Báo cáo bởi {report.reporter}</p><div><button type="button" className="group-danger-button" onClick={() => decideReport(report, true)}>Gỡ nội dung</button><button type="button" className="group-quiet-button" onClick={() => decideReport(report, false)}>Bỏ qua</button></div></div>)}</section>
          <section><h3>Thành viên bị cấm <span>{bans.length}</span></h3>{bans.length === 0 ? <p className="group-muted">Danh sách trống.</p> : bans.map((member) => <div className="group-review-row" key={member.userId}><strong>{member.name}</strong><p>{member.reason || 'Không ghi lý do'}</p><button type="button" className="group-secondary-button compact" onClick={() => unbanMember(member)}>Bỏ cấm</button></div>)}</section>
        </div>
      </section>}

      <div className="group-content-grid">
        <aside className="group-side-column"><section className="group-side-panel"><span className="groups-kicker">VỀ NHÓM</span><p>{group.description || 'Chưa có mô tả.'}</p><div className="group-side-stat"><span>Quyền riêng tư</span><strong>{group.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</strong></div><div className="group-side-stat"><span>Quản lý bởi</span><strong>{group.ownerName}</strong></div><div className="group-side-stat"><span>Thành viên</span><strong>{group.memberCount}</strong></div></section>
          {isMember && <section className="group-side-panel"><span className="groups-kicker">MỜI BẠN BÈ</span><label className="group-invite-select"><span>Chọn bạn bè</span><select defaultValue="" onChange={inviteFriend}><option value="">Mời vào nhóm...</option>{friends.map((friend) => <option key={friend.userId} value={friend.userId}>{friend.displayName || friend.username}</option>)}</select></label></section>}
          <section className="group-side-panel group-events-panel"><div className="group-event-heading"><div><span className="groups-kicker">LỊCH NHÓM</span><strong>Sự kiện</strong></div>{isMember && <button type="button" className="group-quiet-button" onClick={() => setEventFormOpen((open) => !open)}>{eventFormOpen ? 'Đóng' : '＋ Tạo'}</button>}</div>
            {eventFormOpen && <form className="group-event-form" onSubmit={createEvent}><label>Tên sự kiện<input required maxLength={120} value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} /></label><label>Địa điểm<input maxLength={200} value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} /></label><label>Bắt đầu<input type="datetime-local" required value={eventDraft.startsAt} onChange={(event) => setEventDraft({ ...eventDraft, startsAt: event.target.value })} /></label><label>Kết thúc<input type="datetime-local" value={eventDraft.endsAt} onChange={(event) => setEventDraft({ ...eventDraft, endsAt: event.target.value })} /></label><label>Mô tả<textarea rows="2" maxLength={2000} value={eventDraft.description} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} /></label><button className="group-primary-button compact">Tạo sự kiện</button></form>}
            {events.length === 0 ? <p className="group-muted">Chưa có sự kiện nào.</p> : events.map((event) => <div className="group-event-item" key={event.eventId}><span className="group-event-date">{new Date(event.startsAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' })}</span><div><strong>{event.title}</strong><span>{formatDate(event.startsAt)}{event.location ? ` · ${event.location}` : ''}</span><small>{event.participantCount} người tham gia</small></div>{isMember && <button type="button" className={event.participating ? 'group-event-joined' : ''} onClick={() => participateEvent(event.eventId)}>{event.participating ? 'Đã tham gia' : 'Tham gia'}</button>}</div>)}
          </section></aside>

        <section className="group-main-column">
          {tab === 'Thành viên' ? <section className="group-members-panel"><div className="group-section-heading"><div><span className="groups-kicker">CỘNG ĐỒNG</span><h2>Thành viên</h2></div><span className="group-result-count">{members.length}</span></div>{members.map((member) => <div className="group-member-row" key={member.userId}><Avatar src={member.avatar} name={member.name} size={42} /><div className="group-member-copy"><strong>{member.name}</strong><span>{member.role === 'OWNER' ? 'Chủ nhóm' : member.role === 'ADMIN' ? 'Admin' : member.role === 'MODERATOR' ? 'Moderator' : 'Thành viên'}</span></div>{canModerate && member.userId !== user?.userId && member.role !== 'OWNER' && <details className="group-member-menu"><summary aria-label={`Tùy chọn ${member.name}`}>•••</summary><div><button type="button" onClick={() => manageMember(member, 'role')}>Đổi vai trò</button><button type="button" onClick={() => manageMember(member, 'warn')}>Cảnh cáo</button><button type="button" onClick={() => manageMember(member, 'remove')}>Xóa thành viên</button><button type="button" onClick={() => manageMember(member, 'ban')}>Cấm thành viên</button></div></details>}</div>)}</section>
            : tab === 'Giới thiệu' ? <section className="group-about-panel"><span className="groups-kicker">GIỚI THIỆU</span><h2>{group.name}</h2><p>{group.description || 'Nhóm chưa có mô tả.'}</p><dl><div><dt>Danh mục</dt><dd>{group.category || 'Chưa phân loại'}</dd></div><div><dt>Quyền riêng tư</dt><dd>{group.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</dd></div><div><dt>Ngày tạo</dt><dd>{formatDate(group.createdAt)}</dd></div><div><dt>Chủ nhóm</dt><dd>{group.ownerName}</dd></div></dl></section>
              : <>
                {tab === 'Bài viết' && isMember && <form className="group-composer" onSubmit={composerMode === 'POST' ? submitPost : submitPoll}>
                  <div className="group-compose-modes" role="tablist" aria-label="Loại nội dung"><button type="button" className={composerMode === 'POST' ? 'selected' : ''} onClick={() => setComposerMode('POST')}>Bài viết</button><button type="button" className={composerMode === 'POLL' ? 'selected' : ''} onClick={() => setComposerMode('POLL')}>Bình chọn</button></div>
                  {composerMode === 'POST' ? <>
                    <div className="group-composer-top"><Avatar src={user?.avatar} name={user?.displayName || user?.username} size={42} /><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={10000} placeholder={`Chia sẻ điều gì đó với ${group.name}...`} aria-label="Nội dung bài viết" /></div>
                    {file && filePreview && <div className="group-attachment-preview">
                      {file.type.startsWith('video/') ? <video src={filePreview} controls /> : file.type.startsWith('image/') ? <img src={filePreview} alt="Xem trước ảnh bài viết" /> : <span className="group-attachment-name">▤ {file.name}</span>}
                      <button type="button" onClick={clearSelectedFile} aria-label="Bỏ tệp đã chọn">×</button>
                    </div>}
                    <div className="group-composer-bottom">
                      <input ref={postFileInputRef} className="group-file-input" type="file" accept="image/*,video/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                      <button type="button" className="group-attach-button" onClick={() => postFileInputRef.current?.click()}>＋ Ảnh, video hoặc tệp</button>
                      <button className="group-primary-button compact" disabled={posting || (!content.trim() && !file)}>{posting ? 'Đang đăng...' : group.postApprovalRequired ? 'Gửi duyệt' : 'Đăng bài'}</button>
                    </div>
                  </>
                    : <div className="group-poll-builder"><textarea required maxLength={10000} value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Đặt câu hỏi..." aria-label="Câu hỏi bình chọn" />{pollOptions.map((option, index) => <div className="group-poll-input-row" key={index}><input required maxLength={120} value={option} onChange={(event) => setPollOptions((current) => current.map((item, currentIndex) => currentIndex === index ? event.target.value : item))} placeholder={`Lựa chọn ${index + 1}`} /><button type="button" aria-label="Xóa lựa chọn" disabled={pollOptions.length <= 2} onClick={() => setPollOptions((current) => current.filter((_, currentIndex) => currentIndex !== index))}>×</button></div>)}{pollOptions.length < 10 && <button type="button" className="group-add-option" onClick={() => setPollOptions((current) => [...current, ''])}>＋ Thêm lựa chọn</button>}<div className="group-poll-submit"><label>Kết thúc lúc<input type="datetime-local" value={pollEndsAt} onChange={(event) => setPollEndsAt(event.target.value)} /></label><button className="group-primary-button compact" disabled={posting || !pollQuestion.trim() || pollOptions.filter((item) => item.trim()).length < 2}>{posting ? 'Đang tạo...' : group.postApprovalRequired ? 'Gửi duyệt' : 'Tạo bình chọn'}</button></div></div>}
                </form>}
                <div className="group-post-toolbar"><div><span className="groups-kicker">{tab === 'Media' ? 'THƯ VIỆN NHÓM' : 'THẢO LUẬN'}</span><h2>{tab === 'Media' ? 'Ảnh và tệp' : 'Bài viết'}</h2></div>{tab === 'Bài viết' && <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp bài viết"><option value="NEWEST">Mới nhất</option><option value="OLDEST">Cũ nhất</option></select>}</div>
                {tab === 'Bài viết' && <label className="group-post-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm trong bài viết" /></label>}
                {posts.length === 0 ? <div className="groups-state group-post-empty"><span className="group-empty-mark">◌</span><strong>{tab === 'Media' ? 'Chưa có tệp được chia sẻ' : 'Chưa có bài viết'}</strong><span>{isMember ? 'Hãy bắt đầu cuộc trò chuyện đầu tiên trong nhóm.' : 'Tham gia nhóm để xem và đăng bài.'}</span></div> : <div className="group-post-list">{posts.map((post) => <article className="group-post" key={post.postId}>
                  {post.pinned && <div className="group-pinned-label">⌖ BÀI VIẾT ĐÃ GHIM</div>}
                  <header className="group-post-head"><Avatar className="group-post-author-avatar" src={post.authorAvatar} name={post.authorName} size={42} /><div className="group-post-author"><strong>{post.authorName}</strong><span>{formatDate(post.createdAt)}{post.status === 'PENDING' ? ' · Chờ duyệt' : ''}</span></div><details className="group-post-menu"><summary aria-label="Tùy chọn bài viết">•••</summary><div>{post.authorId === user?.userId && <button type="button" onClick={async () => { const text = window.prompt('Chỉnh sửa bài viết', post.content); if (text == null) return; try { await groupApi.updatePost(groupId, post.postId, { content: text, mediaUrl: post.mediaUrl, mediaType: post.mediaType }); await loadGroup() } catch (err) { announce(err.response?.data?.message || 'Không thể sửa bài viết.') } }}>Chỉnh sửa</button>}{(post.authorId === user?.userId || canModerate) && <button type="button" onClick={async () => { if (!window.confirm('Xóa bài viết này?')) return; try { await groupApi.removePost(groupId, post.postId); await loadGroup() } catch (err) { announce(err.response?.data?.message || 'Không thể xóa bài viết.') } }}>Xóa bài viết</button>}{canModerate && <button type="button" onClick={async () => { try { await groupApi.pin(groupId, post.postId); await loadGroup() } catch (err) { announce(err.response?.data?.message || 'Không thể ghim bài viết.') } }}>{post.pinned ? 'Bỏ ghim' : 'Ghim bài viết'}</button>}<button type="button" onClick={() => reportPost(post)}>Báo cáo</button></div></details></header>
                  {post.content && <p className="group-post-content">{post.content}</p>}
                  {post.poll && <PollCard post={post} canVote={isMember} onVote={votePoll} />}
                  {post.mediaType === 'IMAGE' && <img className="group-post-image" src={post.mediaUrl} alt="Tệp đính kèm bài viết" />}
                  {post.mediaType === 'VIDEO' && <video className="group-post-video" src={post.mediaUrl} controls />}
                  {post.mediaType === 'FILE' && <a className="group-post-file" href={post.mediaUrl} target="_blank" rel="noreferrer">↗ Mở tệp đính kèm</a>}
                  <div className="group-post-stats"><span>{post.reactionCount} cảm xúc</span><span>{post.comments?.length || 0} bình luận</span></div>
                  <div className="group-post-actions"><GroupPostReactionControl post={post} onSelect={(postId, type) => react(post, type)} /><button type="button" className="group-comment-action" onClick={() => openComments(post.postId)}>Bình luận</button><button type="button" className="group-comment-action" onClick={() => toggleSavedGroupPost(post)}>{savedGroupPosts[post.postId] ? '▣ Đã lưu' : '▣ Lưu'}</button></div>
                  <div className="group-comment-area" id={`group-comments-${post.postId}`}>
                  {post.comments?.length > 0 && <div className="group-comments">{post.comments.map((comment) => <div className={`group-comment ${comment.parentCommentId ? 'reply' : ''}`} key={comment.commentId}><Avatar src={comment.authorAvatar} name={comment.authorName} size={30} /><div className="group-comment-body"><strong>{comment.authorName}</strong><p>{comment.content}</p><div><time>{formatDate(comment.createdAt)}</time><button type="button" onClick={() => setReplyTo({ postId: post.postId, commentId: comment.parentCommentId || comment.commentId, name: comment.authorName })}>Trả lời</button>{(comment.authorId === user?.userId || canModerate) && <button type="button" onClick={async () => { if (window.confirm('Xóa bình luận này?')) { try { await groupApi.removeComment(groupId, comment.commentId); await loadGroup() } catch (err) { announce(err.response?.data?.message || 'Không thể xóa bình luận.') } } }}>Xóa</button>}</div></div></div>)}</div>}
                  {isMember && <form className="group-comment-form" onSubmit={(event) => submitComment(post.postId, event)}><Avatar src={user?.avatar} name={user?.displayName || user?.username} size={30} /><div>{replyTo?.postId === post.postId && <span className="group-replying">Trả lời {replyTo.name}<button type="button" onClick={() => setReplyTo(null)}>×</button></span>}<input id={`group-comment-${post.postId}`} value={comments[post.postId] || ''} onChange={(event) => setComments((current) => ({ ...current, [post.postId]: event.target.value }))} placeholder="Viết bình luận..." maxLength={2000} aria-label="Viết bình luận" /><button disabled={!comments[post.postId]?.trim()} aria-label="Gửi bình luận">↗</button></div></form>}
                  </div>
                </article>)}</div>}
              </>}
        </section>
      </div>

      {settingsOpen && settings && <div className="group-modal-backdrop" role="presentation"><form className="group-create-modal" onSubmit={saveSettings}><div className="group-modal-heading"><div><span className="groups-kicker">QUẢN TRỊ</span><h2>Cài đặt nhóm</h2></div><button type="button" className="group-close-button" onClick={() => setSettingsOpen(false)} aria-label="Đóng">×</button></div>
        <label className="group-image-upload">Tải ảnh đại diện<input type="file" accept="image/*" onChange={(event) => uploadGroupImage('avatar', event)} />{settings.avatar && <img src={settings.avatar} alt="Ảnh đại diện nhóm" />}</label>
        <label className="group-image-upload">Tải ảnh bìa<input type="file" accept="image/*" onChange={(event) => uploadGroupImage('coverImage', event)} />{settings.coverImage && <img src={settings.coverImage} alt="Ảnh bìa nhóm" />}</label>
        <label>Tên nhóm<input required maxLength={100} value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></label><label>Mô tả<textarea rows="3" maxLength={2000} value={settings.description} onChange={(event) => setSettings({ ...settings, description: event.target.value })} /></label><label>Danh mục<input maxLength={80} value={settings.category} onChange={(event) => setSettings({ ...settings, category: event.target.value })} /></label><label>Ảnh đại diện URL<input value={settings.avatar} onChange={(event) => setSettings({ ...settings, avatar: event.target.value })} /></label><label>Ảnh bìa URL<input value={settings.coverImage} onChange={(event) => setSettings({ ...settings, coverImage: event.target.value })} /></label><label>Quyền riêng tư<select value={settings.visibility} onChange={(event) => setSettings({ ...settings, visibility: event.target.value })}><option value="PUBLIC">Công khai</option><option value="PRIVATE">Riêng tư</option></select></label><label className="group-check-setting"><input type="checkbox" checked={settings.postApprovalRequired} onChange={(event) => setSettings({ ...settings, postApprovalRequired: event.target.checked })} />Duyệt bài viết trước khi đăng</label><label>Từ khóa lọc spam<input value={settings.spamKeywords} onChange={(event) => setSettings({ ...settings, spamKeywords: event.target.value })} placeholder="từ khóa 1, từ khóa 2" /></label>
        <div className="group-modal-actions"><button type="button" className="group-danger-button" onClick={deleteGroup}>Xóa nhóm</button><span /><button type="button" className="group-quiet-button" onClick={() => setSettingsOpen(false)}>Hủy</button><button className="group-primary-button">Lưu thay đổi</button></div>
      </form></div>}
    </main>
  )
}

function LikeOutlineIcon() {
  return <svg className="like-outline-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm0 0 4-7c1.5 0 2.2 1.1 1.8 2.5L12 10h6.2a2 2 0 0 1 2 2.4l-1.5 7a2 2 0 0 1-2 1.6H7" /></svg>
}

function GroupPostReactionControl({ post, onSelect }) {
  const selectedReaction = reactions.find((reaction) => reaction.type === post.viewerReaction)
  const buttonReaction = selectedReaction || reactions[0]
  return <div className="reaction-control group-reaction-control">
    <button type="button" className={`reaction-trigger ${selectedReaction ? 'liked' : ''}`} onClick={() => onSelect(post.postId, selectedReaction?.type || 'LIKE')} aria-label={selectedReaction ? `Cảm xúc đã chọn: ${buttonReaction.label}` : 'Thích bài viết'}>
      {selectedReaction ? buttonReaction.emoji : <LikeOutlineIcon />}{post.reactionCount > 0 && <span className="reaction-count">{post.reactionCount}</span>}<span>{selectedReaction ? buttonReaction.label : 'Thích'}</span>
    </button>
    <div className="reaction-picker" role="group" aria-label="Chọn cảm xúc">
      {reactions.map((reaction) => <button key={reaction.type} type="button" title={reaction.label} aria-label={reaction.label} onClick={() => onSelect(post.postId, reaction.type)}>{reaction.emoji}</button>)}
    </div>
  </div>
}