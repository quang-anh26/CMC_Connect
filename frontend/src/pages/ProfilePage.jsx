import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import { conversationApi } from '../api/conversationApi'
import { feedApi } from '../api/feedApi'
import { friendApi } from '../api/friendApi'
import { storyApi } from '../api/storyApi'
import { userApi } from '../api/userApi'
import { useAuth } from '../context/AuthContext'

const profileTabs = ['Bài viết', 'Giới thiệu', 'Bạn bè', 'Ảnh', 'Video', 'Nhóm', 'Sự kiện']

function formatProfileTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatJoinedDate(value) {
  if (!value) return 'Chưa rõ thời gian tham gia'
  return new Date(value).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

function formatBirthDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function getFriendInfo(friend, userId) {
  const isSender = String(friend.senderId) === String(userId)
  return {
    id: isSender ? friend.receiverId : friend.senderId,
    name: (isSender ? friend.receiverDisplayName : friend.senderDisplayName)
      || (isSender ? friend.receiverUsername : friend.senderUsername)
      || 'Bạn bè',
    avatar: isSender ? friend.receiverAvatar : friend.senderAvatar,
  }
}

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const { profileUserId } = useParams()
  const navigate = useNavigate()
  const isOwnProfile = !profileUserId || String(profileUserId) === String(user?.userId)
  const mediaInputRef = useRef(null)
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState('')
  const [education, setEducation] = useState('')
  const [location, setLocation] = useState('')
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [createdAt, setCreatedAt] = useState(user?.createdAt || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [coverImage, setCoverImage] = useState(user?.coverImage || '')
  const [profileUsername, setProfileUsername] = useState(user?.username || '')
  const [profileOnline, setProfileOnline] = useState(false)
  const [posts, setPosts] = useState([])
  const [friends, setFriends] = useState([])
  const [groups, setGroups] = useState([])
  const [activeTab, setActiveTab] = useState('Bài viết')
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [composerText, setComposerText] = useState('')
  const [composerFile, setComposerFile] = useState(null)
  const [posting, setPosting] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setActiveTab('Bài viết')
    setDisplayName('')
    setBio('')
    setEducation('')
    setLocation('')
    setRelationshipStatus('')
    setBirthDate('')
    setCreatedAt('')
    setAvatar('')
    setCoverImage('')
    setProfileUsername('')
    setProfileOnline(false)
    setPosts([])
    setFriends([])
    setGroups([])
    const profileRequest = isOwnProfile ? userApi.me() : userApi.getById(profileUserId)
    const friendsRequest = isOwnProfile ? friendApi.accepted() : Promise.resolve({ data: [] })
    const groupsRequest = isOwnProfile ? conversationApi.list() : Promise.resolve({ data: [] })
    Promise.allSettled([profileRequest, feedApi.list(), friendsRequest, groupsRequest]).then((results) => {
      if (!active) return
      const [profileResult, postsResult, friendsResult, groupsResult] = results
      if (profileResult.status === 'fulfilled') {
        const profile = profileResult.value.data
        setProfileUsername(profile.username || '')
        setProfileOnline(profile.online === true)
        setDisplayName(profile.displayName || '')
        setBio(profile.bio || '')
        setEducation(profile.education || '')
        setLocation(profile.location || '')
        setRelationshipStatus(profile.relationshipStatus || '')
        setBirthDate(profile.birthDate || '')
        setCreatedAt(profile.createdAt || '')
        setAvatar(profile.avatar || '')
        setCoverImage(profile.coverImage || '')
        if (isOwnProfile) setUser((current) => ({ ...current, ...profile }))
      } else {
        setError('Không thể tải thông tin trang cá nhân này.')
      }
      if (postsResult.status === 'fulfilled') {
        setPosts((postsResult.value.data || [])
          .filter((post) => String(post.authorId) === String(profileUserId || user?.userId))
          .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)))
      }
      if (friendsResult.status === 'fulfilled') setFriends(friendsResult.value.data || [])
      if (groupsResult.status === 'fulfilled') {
        setGroups((groupsResult.value.data || []).filter((conversation) => conversation.type === 'GROUP'))
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [isOwnProfile, profileUserId, setUser, user?.userId])

  const imagePosts = useMemo(() => posts.filter((post) => post.imageUrl && post.mediaType !== 'VIDEO'), [posts])
  const videoPosts = useMemo(() => posts.filter((post) => post.mediaType === 'VIDEO'), [posts])
  const composerPreview = useMemo(() => composerFile ? URL.createObjectURL(composerFile) : '', [composerFile])
  useEffect(() => () => { if (composerPreview) URL.revokeObjectURL(composerPreview) }, [composerPreview])
  useEffect(() => {
    if (!error) return undefined
    const timeoutId = window.setTimeout(() => setError(''), 4500)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const savedEducation = education.trim()
      const savedLocation = location.trim()
      const savedRelationshipStatus = relationshipStatus.trim()
      const { data } = await userApi.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar,
        coverImage,
        education: savedEducation,
        location: savedLocation,
        relationshipStatus: savedRelationshipStatus,
        birthDate: birthDate || null,
      })
      if ((data.education || '') !== savedEducation
        || (data.location || '') !== savedLocation
        || (data.relationshipStatus || '') !== savedRelationshipStatus
        || (data.birthDate || '') !== (birthDate || '')) {
        setError('Hệ thống gặp lỗi nên chưa thể cập nhật thông tin. Vui lòng thử lại.')
        return
      }
      setUser((current) => ({ ...current, ...data }))
      setDisplayName(data.displayName || '')
      setBio(data.bio || '')
      setEducation(data.education ?? savedEducation)
      setLocation(data.location ?? savedLocation)
      setRelationshipStatus(data.relationshipStatus ?? savedRelationshipStatus)
      setBirthDate(data.birthDate ?? birthDate)
      setCreatedAt(data.createdAt || createdAt)
      setAvatar(data.avatar || '')
      setCoverImage(data.coverImage || '')
      setEditOpen(false)
      setNotice('Đã lưu thay đổi trang cá nhân.')
      window.setTimeout(() => setNotice(''), 2500)
    } catch (err) {
      setError('Hệ thống gặp lỗi nên chưa thể cập nhật thông tin. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const uploadProfileImage = async (event, kind) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const upload = kind === 'avatar' ? userApi.uploadAvatar : userApi.uploadCover
      const { data } = await upload(file)
      if (kind === 'avatar') {
        setAvatar(data.url)
        setUser((current) => ({ ...current, avatar: data.url }))
      } else {
        setCoverImage(data.url)
        setUser((current) => ({ ...current, coverImage: data.url }))
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải ảnh lên.')
    }
    event.target.value = ''
  }

  const publishProfilePost = async (event) => {
    event.preventDefault()
    if (!composerText.trim() && !composerFile) return
    setPosting(true)
    setError('')
    try {
      let imageUrl = null
      let mediaType = null
      if (composerFile) {
        const upload = await storyApi.upload(composerFile)
        imageUrl = upload.data.url
        mediaType = upload.data.mediaType
      }
      const { data } = await feedApi.create({ content: composerText.trim() || null, imageUrl, mediaType })
      setPosts((current) => [data, ...current])
      setComposerText('')
      setComposerFile(null)
      if (mediaInputRef.current) mediaInputRef.current.value = ''
      setNotice('Bài viết đã được đăng.')
      window.setTimeout(() => setNotice(''), 2500)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đăng bài viết.')
    } finally {
      setPosting(false)
    }
  }

  const reactToPost = async (postId) => {
    try {
      const { data } = await feedApi.react(postId, 'LIKE')
      setPosts((current) => current.map((post) => post.postId === postId ? data : post))
    } catch {
      setError('Không thể cập nhật cảm xúc.')
    }
  }

  const shareToFeed = async (post) => {
    try {
      const { data } = await feedApi.share(post.postId, '')
      const originalPostId = post.sharedPost?.postId || post.postId
      setPosts((current) => {
        const updated = current.map((item) => (
          item.postId === originalPostId || item.sharedPost?.postId === originalPostId
            ? { ...item, shareCount: data.shareCount }
            : item
        ))
        return isOwnProfile ? [data, ...updated.filter((item) => item.postId !== data.postId)] : updated
      })
      setNotice('Bài viết đã được chia sẻ lên bảng tin của bạn.')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể chia sẻ bài viết.')
    }
  }

  const addComment = async (postId) => {
    const content = commentDrafts[postId]?.trim()
    if (!content) return
    try {
      const { data } = await feedApi.comment(postId, content)
      setPosts((current) => current.map((post) => post.postId === postId ? data : post))
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
    } catch {
      setError('Không thể gửi bình luận.')
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    try {
      await userApi.changePassword({ oldPassword, newPassword })
      setPasswordMessage('Đã đổi mật khẩu.')
      setOldPassword('')
      setNewPassword('')
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Đổi mật khẩu thất bại.')
    }
  }

  const tabPosts = activeTab === 'Ảnh' ? imagePosts : activeTab === 'Video' ? videoPosts : posts
  const profileName = displayName || (isOwnProfile ? user?.displayName : '') || profileUsername || 'Trang cá nhân'
  const visibleProfileTabs = profileTabs.filter((tab) => isOwnProfile || !['Bạn bè', 'Nhóm', 'Sự kiện'].includes(tab))

  return (
    <div className="chat-area profile-page">
      <div className="chat-header"><strong>Trang cá nhân</strong></div>
      <div className="profile-page-content">
        <section className="profile-hero">
          <div className="profile-hero-cover" style={coverImage ? { backgroundImage: `linear-gradient(180deg, rgba(12, 24, 48, .02), rgba(12, 24, 48, .58)), url(${coverImage})` } : undefined}>
            {isOwnProfile && <button className="profile-cover-edit" type="button" onClick={() => setEditOpen(true)}>▧ <span>Chỉnh sửa ảnh bìa</span></button>}
          </div>
          <div className="profile-hero-details">
            <Avatar className="profile-hero-avatar" src={avatar} name={profileName} size={152} />
            <div className="profile-hero-copy">
              <h1>{profileName} <span className="profile-verified" title="Tài khoản của bạn">✓</span></h1>
              <p>{bio || `@${profileUsername || ''}`}</p>
              <small>{isOwnProfile ? `${groups.length} nhóm · ${friends.length} bạn bè` : `@${profileUsername}`}</small>
            </div>
            {isOwnProfile && <div className="profile-hero-actions">
              <button className="profile-edit-button" type="button" onClick={() => { setError(''); setEditOpen(true) }}>✎ <span>Chỉnh sửa trang cá nhân</span></button>
              <button className="profile-more-button" type="button" aria-label="Tùy chọn khác">···</button>
            </div>}
          </div>
          <nav className="profile-tabs" aria-label="Mục trang cá nhân">
            {visibleProfileTabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} type="button" onClick={() => setActiveTab(tab)}>{tab}</button>)}
          </nav>
        </section>

        {notice && <div className="profile-notice">{notice}</div>}
        {error && <div className="profile-system-error" role="alert">{error}</div>}

        <div className={`profile-columns ${isOwnProfile ? '' : 'profile-viewing-other'}`}>
          <aside className="profile-left-column">
            <section className="profile-panel profile-intro-panel">
              <h2>Giới thiệu</h2>
              <div className="profile-info-row"><span className="profile-school-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M8 10h2m4 0h2m-8 3h2m4 0h2" /></svg></span><span>{education || 'Chưa cập nhật trường học'}</span></div>
              <div className="profile-info-row"><span className="profile-home-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.6 12 3l9 7.6v9.1a1.3 1.3 0 0 1-1.3 1.3h-5.1v-6.2H9.4V21H4.3A1.3 1.3 0 0 1 3 19.7z" /></svg></span><span>{location || 'Chưa cập nhật nơi ở'}</span></div>
              <div className="profile-info-row"><span className="profile-relationship-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 20.3 4.1 16.2a3.1 3.1 0 0 1 4.4-4.4l1.2 1.2 1.2-1.2a3.1 3.1 0 0 1 4.4 4.4l-4.1 4.1a2.1 2.1 0 0 1-3 0ZM15.1 12.1l-1.4-1.4a4.4 4.4 0 0 1 6.2-6.2 4.4 4.4 0 0 1 0 6.2l-5 5" /></svg></span><span>{relationshipStatus || 'Chưa cập nhật'}</span></div>
              <div className="profile-info-row"><span className="profile-birthday-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V4m5 4V3m5 5V5M6 10h12a2 2 0 0 1 2 2v7H4v-7a2 2 0 0 1 2-2Zm-2 4c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1M3 21h18" /></svg></span><span>Ngày sinh: {formatBirthDate(birthDate) || 'Chưa cập nhật'}</span></div>
              {isOwnProfile && <button type="button" className="profile-secondary-button" onClick={() => setEditOpen(true)}>Chỉnh sửa phần giới thiệu</button>}
            </section>
            <section className="profile-panel">
              <div className="profile-panel-heading"><h2>Bộ sưu tập ảnh</h2><button type="button" onClick={() => setActiveTab('Ảnh')}>Xem tất cả</button></div>
              {imagePosts.length ? (
                <div className="profile-photo-grid">
                  {imagePosts.slice(0, 6).map((post) => <button type="button" key={post.postId} onClick={() => setActiveTab('Ảnh')}><img src={post.imageUrl} alt="Ảnh trong bài viết" /></button>)}
                </div>
              ) : <p className="profile-muted">Ảnh bạn chia sẻ sẽ xuất hiện ở đây.</p>}
            </section>
            {isOwnProfile && <details className="profile-panel profile-security-panel">
              <summary>Bảo mật tài khoản</summary>
              <form onSubmit={changePassword}>
                <label>Mật khẩu cũ<input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required /></label>
                <label>Mật khẩu mới<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} /></label>
                <button type="submit" className="profile-secondary-button">Đổi mật khẩu</button>
                {passwordMessage && <small className="profile-success">{passwordMessage}</small>}
                {passwordError && <small className="profile-error">{passwordError}</small>}
              </form>
            </details>}
          </aside>

          <main className="profile-center-column">
            {(activeTab === 'Bài viết' || activeTab === 'Ảnh' || activeTab === 'Video') && (
              <>
                {activeTab === 'Bài viết' && isOwnProfile && (
                  <form className="profile-composer" onSubmit={publishProfilePost}>
                    <div className="profile-composer-top"><Avatar src={avatar} name={profileName} size={40} /><textarea value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder={`${profileName} ơi, bạn đang nghĩ gì?`} rows={2} /></div>
                    {composerPreview && <div className="profile-composer-preview">{composerFile?.type.startsWith('video/') ? <video src={composerPreview} controls /> : <img src={composerPreview} alt="Ảnh xem trước" />}<button type="button" onClick={() => setComposerFile(null)}>×</button></div>}
                    <div className="profile-composer-actions"><label>▧ Ảnh/Video<input ref={mediaInputRef} type="file" accept="image/*,video/*" onChange={(event) => setComposerFile(event.target.files?.[0] || null)} /></label><button type="submit" disabled={posting || (!composerText.trim() && !composerFile)}>{posting ? 'Đang đăng...' : 'Đăng bài'}</button></div>
                  </form>
                )}
                {loading && <LoadingState variant="skeleton" lines={2} skeletonHeight={110} label="Đang tải bài viết..." />}
                {!loading && tabPosts.length === 0 && <EmptyState title={activeTab === 'Ảnh' ? 'Chưa có ảnh' : activeTab === 'Video' ? 'Chưa có video' : 'Chưa có bài viết'} description={isOwnProfile ? 'Bài viết của bạn sẽ hiển thị tại đây.' : 'Bài viết của người dùng sẽ hiển thị tại đây.'} />}
                {tabPosts.map((post) => (
                  <article className="profile-post-card" key={post.postId}>
                    <header><Avatar src={post.authorAvatar || avatar} name={post.authorName || profileName} size={42} /><div><strong>{post.authorName || profileName}</strong><small>{formatProfileTime(post.createdAt)}</small></div><button type="button" aria-label="Tùy chọn bài viết">···</button></header>
                    {post.content && <p className="profile-post-content">{post.content}</p>}
                    {post.sharedPost && <div className="shared-post-preview"><div className="shared-post-heading"><Avatar src={post.sharedPost.authorAvatar} name={post.sharedPost.authorName} size={32} /><div><strong>{post.sharedPost.authorName}</strong><small>{formatProfileTime(post.sharedPost.createdAt)}</small></div></div>{post.sharedPost.content && <p>{post.sharedPost.content}</p>}{post.sharedPost.mediaType === 'VIDEO' ? <video className="shared-post-media" src={post.sharedPost.imageUrl} controls /> : post.sharedPost.imageUrl && <img className="shared-post-media" src={post.sharedPost.imageUrl} alt="Shared post" />}</div>}
                    {post.mediaType === 'VIDEO' ? <video className="profile-post-media" src={post.imageUrl} controls /> : post.imageUrl && <img className="profile-post-media" src={post.imageUrl} alt="Ảnh trong bài viết" />}
                    <div className="profile-post-summary"><span>👍 {post.likeCount || 0}</span><span>{post.comments?.length || 0} bình luận</span></div>
                    <div className="profile-post-actions"><button type="button" className={post.likedByViewer ? 'liked' : ''} onClick={() => reactToPost(post.postId)}>👍 Thích</button><button type="button" onClick={() => document.getElementById(`profile-comment-${post.postId}`)?.focus()}>▢ Bình luận</button><button type="button" onClick={() => shareToFeed(post)}>↗ {post.shareCount > 0 && <span className="action-count">{post.shareCount}</span>} Chia sẻ</button></div>
                    {post.comments?.slice(-2).map((comment) => <div className="profile-post-comment" key={comment.commentId}><strong>{comment.authorName}</strong><span>{comment.content}</span></div>)}
                    <form className="profile-comment-form" onSubmit={(event) => { event.preventDefault(); addComment(post.postId) }}><Avatar src={avatar} name={profileName} size={30} /><input id={`profile-comment-${post.postId}`} value={commentDrafts[post.postId] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.postId]: event.target.value }))} placeholder="Viết bình luận..." /><button type="submit">Gửi</button></form>
                  </article>
                ))}
              </>
            )}
            {activeTab === 'Giới thiệu' && <section className="profile-panel profile-tab-panel"><h2>Giới thiệu</h2><p>{bio || 'Chưa có phần giới thiệu.'}</p><p>{education || 'Chưa cập nhật trường học'}</p><p>{location || 'Chưa cập nhật nơi ở'}</p><p>Tình trạng mối quan hệ: {relationshipStatus || 'Chưa cập nhật'}</p><p>Ngày sinh: {formatBirthDate(birthDate) || 'Chưa cập nhật'}</p><p>Tên người dùng: @{profileUsername}</p></section>}
            {isOwnProfile && activeTab === 'Bạn bè' && <section className="profile-panel profile-tab-panel"><h2>Bạn bè ({friends.length})</h2><div className="profile-friend-grid">{friends.map((friend) => { const item = getFriendInfo(friend, user?.userId); return <button type="button" className="profile-friend-card profile-user-link" key={friend.id} onClick={() => navigate(`/feed/profile/${item.id}`)}><Avatar src={item.avatar} name={item.name} size={54} /><strong>{item.name}</strong></button> })}</div></section>}
            {isOwnProfile && activeTab === 'Nhóm' && <section className="profile-panel profile-tab-panel"><h2>Nhóm ({groups.length})</h2>{groups.length ? groups.map((group) => <div className="profile-group-row" key={group.conversationId}><span className="profile-group-icon">♧</span><div><strong>{group.name || 'Nhóm chat'}</strong><small>Nhóm trò chuyện</small></div></div>) : <p className="profile-muted">Bạn chưa tham gia nhóm nào.</p>}</section>}
            {activeTab === 'Sự kiện' && <EmptyState title="Chưa có hoạt động sự kiện" description="Các sự kiện bạn tham gia sẽ xuất hiện tại đây." />}
          </main>

          {isOwnProfile && <aside className="profile-right-column">
            <section className="profile-panel profile-right-friends">
              <div className="profile-panel-heading"><div><h2>Bạn bè</h2><small>{friends.length} người bạn</small></div><button type="button" onClick={() => setActiveTab('Bạn bè')}>Xem tất cả</button></div>
              <div className="profile-friend-strip">{friends.slice(0, 4).map((friend) => { const item = getFriendInfo(friend, user?.userId); return <button type="button" className="profile-user-link" key={friend.id} onClick={() => navigate(`/feed/profile/${item.id}`)}><Avatar src={item.avatar} name={item.name} size={42} /><span>{item.name}</span></button> })}</div>
              {friends.length === 0 && <p className="profile-muted">Danh sách bạn bè sẽ hiển thị tại đây.</p>}
            </section>
            <section className="profile-panel">
              <div className="profile-panel-heading"><h2>Nhóm tham gia</h2><button type="button" onClick={() => setActiveTab('Nhóm')}>Xem tất cả</button></div>
              {groups.slice(0, 3).map((group) => <div className="profile-group-row" key={group.conversationId}><span className="profile-group-icon">♧</span><div><strong>{group.name || 'Nhóm chat'}</strong><small>Nhóm trò chuyện</small></div></div>)}
              {groups.length === 0 && <p className="profile-muted">Nhóm bạn tham gia sẽ hiển thị tại đây.</p>}
            </section>
            <section className="profile-panel profile-account-panel"><h2>Thông tin liên hệ</h2><div className="profile-info-row"><span>@</span><span>{profileUsername || '—'}</span></div><div className="profile-info-row"><span>◉</span><span>{profileOnline ? 'Đang hoạt động' : 'KapaTalk'}</span></div></section>
          </aside>}
        </div>
      </div>

      {isOwnProfile && editOpen && (
        <div className="profile-edit-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false) }}>
          <form className="profile-edit-dialog" onSubmit={saveProfile}>
            <div className="profile-edit-header"><h2>Chỉnh sửa trang cá nhân</h2><button type="button" aria-label="Đóng" onClick={() => setEditOpen(false)}>×</button></div>
            <label className="profile-cover-picker"><span className="profile-cover-preview" style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined} /><span>Đổi ảnh bìa</span><input type="file" accept="image/*" onChange={(event) => uploadProfileImage(event, 'cover')} /></label>
            <label className="profile-avatar-picker"><Avatar src={avatar} name={profileName} size={68} /><span>Đổi ảnh đại diện</span><input type="file" accept="image/*" onChange={(event) => uploadProfileImage(event, 'avatar')} /></label>
            <div className="field"><label>Tên hiển thị</label><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} required /></div>
            <div className="field"><label>Giới thiệu</label><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={255} rows={3} /></div>
            <div className="field"><label>Trường học</label><input value={education} onChange={(event) => setEducation(event.target.value)} maxLength={120} placeholder="Ví dụ: Đại học Công nghệ" /></div>
            <div className="field"><label>Nơi ở</label><input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} placeholder="Ví dụ: Hà Nội" /></div>
            <div className="field"><label>Tình trạng mối quan hệ</label><select value={relationshipStatus} onChange={(event) => setRelationshipStatus(event.target.value)}><option value="">Chưa cập nhật</option><option value="Độc thân">Độc thân</option><option value="Đang hẹn hò">Đang hẹn hò</option><option value="Đã kết hôn">Đã kết hôn</option><option value="Không muốn công khai">Không muốn công khai</option></select></div>
            <div className="field"><label>Ngày sinh</label><input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>
            <button className="primary profile-save-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
