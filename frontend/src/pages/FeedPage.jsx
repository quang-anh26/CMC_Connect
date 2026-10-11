import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { feedApi } from '../api/feedApi'
import { conversationApi } from '../api/conversationApi'
import { friendApi } from '../api/friendApi'
import { storyApi } from '../api/storyApi'
import { videoApi } from '../api/videoApi'
import { userApi } from '../api/userApi'
import { messageApi } from '../api/messageApi'
import { eventApi } from '../api/eventApi'
import { savedApi } from '../api/savedApi'
import Avatar from '../components/Avatar'
import { MessengerLogo, FriendsIcon, FeedVideoIcon, BellIcon, ChatIcon, CommentIcon, ShareIcon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const storyImage = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=80'
const postReactions = [
  { type: 'LIKE', label: 'Thích', emoji: '👍' },
  { type: 'LOVE', label: 'Yêu thích', emoji: '❤️' },
  { type: 'HAHA', label: 'Haha', emoji: '😂' },
  { type: 'WOW', label: 'Wow', emoji: '😮' },
  { type: 'ANGRY', label: 'Phẫn nộ', emoji: '😡' },
]
const storyReactions = ['👍', '❤️', '😂', '😮', '😢', '😡']

function PostReactionControl({ post, onSelect }) {
  const selectedReaction = postReactions.find((reaction) => reaction.type === post.viewerReaction)
  const buttonReaction = selectedReaction || postReactions[0]

  return (
    <div className="reaction-control">
      <button
        type="button"
        className={`reaction-trigger ${selectedReaction ? 'liked' : ''}`}
        onClick={() => onSelect(post.postId, selectedReaction?.type || 'LIKE')}
        aria-label={selectedReaction ? `Cảm xúc đã chọn: ${buttonReaction.label}` : 'Thích bài viết'}
      >{selectedReaction ? buttonReaction.emoji : <LikeOutlineIcon />}{post.likeCount > 0 && <span className="reaction-count">{post.likeCount}</span>} <span>{selectedReaction ? buttonReaction.label : 'Thích'}</span></button>
      <div className="reaction-picker" role="group" aria-label="Chọn cảm xúc">
        {postReactions.map((reaction) => (
          <button
            key={reaction.type}
            type="button"
            title={reaction.label}
            aria-label={reaction.label}
            onClick={() => onSelect(post.postId, reaction.type)}
          >{reaction.emoji}</button>
        ))}
      </div>
    </div>
  )
}

function formatPostTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}


function LikeOutlineIcon() {
  return (
    <svg className="like-outline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm0 0 4-7c1.5 0 2.2 1.1 1.8 2.5L12 10h6.2a2 2 0 0 1 2 2.4l-1.5 7a2 2 0 0 1-2 1.6H7" />
    </svg>
  )
}

export default function FeedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { subscribe, connected } = useSocket()
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [joinedGroupCount, setJoinedGroupCount] = useState(0)
  const [posts, setPosts] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [stories, setStories] = useState([])
  const [suggestedUsers, setSuggestedUsers] = useState([])
  const [acceptedFriends, setAcceptedFriends] = useState([])
  const [acceptedFriendsLoading, setAcceptedFriendsLoading] = useState(true)
  const [friendPresence, setFriendPresence] = useState({})
  const [content, setContent] = useState('')
  const [postFile, setPostFile] = useState(null)
  const [postPreview, setPostPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedLoadError, setFeedLoadError] = useState('')
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [addingFriendIds, setAddingFriendIds] = useState([])
  const [storyModalOpen, setStoryModalOpen] = useState(false)
  const [storyContent, setStoryContent] = useState('')
  const [storyFile, setStoryFile] = useState(null)
  const [storyPreview, setStoryPreview] = useState('')
  const [storyPosting, setStoryPosting] = useState(false)
  const [storyError, setStoryError] = useState('')
  const [storiesError, setStoriesError] = useState('')
  const [activeStory, setActiveStory] = useState(null)
  const [storyReply, setStoryReply] = useState('')
  const [storyReplySending, setStoryReplySending] = useState(false)
  const [storyDeleting, setStoryDeleting] = useState(false)
  const [storyViewerError, setStoryViewerError] = useState('')
  const [storyViewerNotice, setStoryViewerNotice] = useState('')
  const [activePostImage, setActivePostImage] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)
  const [shareCaption, setShareCaption] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [commentDrafts, setCommentDrafts] = useState({})
  const [error, setError] = useState('')
  const [composerMode, setComposerMode] = useState('text')
  const [notice, setNotice] = useState('')
  const postMediaInputRef = useRef(null)
  const storyTouchStartX = useRef(null)
  const ownPostCount = posts.filter((post) => String(post.authorId) === String(user?.userId)).length

  useEffect(() => {
    let isActive = true
    const refreshNavigationCounts = () => {
      friendApi.received()
        .then((response) => {
          if (isActive) setPendingRequestCount((response.data || []).length)
        })
        .catch(() => {})

      conversationApi.list()
        .then((response) => {
          if (!isActive) return
          const unreadTotal = (response.data || []).reduce(
            (total, conversation) => total + (Number(conversation.unreadCount) || 0),
            0,
          )
          setUnreadMessageCount(unreadTotal)
          setJoinedGroupCount((response.data || []).filter((conversation) => conversation.type === 'GROUP').length)
        })
        .catch(() => {})
    }

    refreshNavigationCounts()
    const intervalId = window.setInterval(refreshNavigationCounts, 15000)
    window.addEventListener('focus', refreshNavigationCounts)
    return () => {
      isActive = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshNavigationCounts)
    }
  }, [])

  const loadPosts = () => {
    setLoading(true)
    feedApi.list()
      .then((response) => {
        setPosts(response.data || [])
        setFeedLoadError('')
      })
      .catch(() => {
        setPosts([])
        setFeedLoadError('Không thể tải bài viết từ máy chủ. Vui lòng thử lại.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPosts()
  }, [])

  useEffect(() => {
    eventApi.list('UPCOMING')
      .then((response) => setUpcomingEvents((response.data || []).slice(0, 2)))
      .catch(() => setUpcomingEvents([]))
  }, [])

  useEffect(() => {
    storyApi.list()
      .then((response) => setStories(response.data || []))
      .catch(() => setStoriesError('Không thể tải tin. Vui lòng thử tải lại trang.'))
      .finally(() => setStoriesLoading(false))
  }, [])

  useEffect(() => {
    let isActive = true
    const loadUsers = () => {
      userApi.search('')
        .then((response) => {
          if (!isActive) return
          const users = response.data || []
          setFriendPresence(Object.fromEntries(users.map((candidate) => [String(candidate.userId), candidate.online === true])))
          setSuggestedUsers(users
            .filter((candidate) => !candidate.friendshipStatus)
            .slice(0, 4))
        })
        .catch(() => {
          if (isActive) setSuggestedUsers([])
        })
        .finally(() => {
          if (isActive) setSuggestionsLoading(false)
        })
    }

    loadUsers()
    const intervalId = window.setInterval(loadUsers, 10000)
    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!connected) return undefined
    return subscribe('/topic/presence', ({ userId, online }) => {
      if (userId == null) return
      setFriendPresence((current) => ({ ...current, [String(userId)]: online === true }))
    })
  }, [connected, subscribe])

  useEffect(() => {
    let isActive = true
    const loadAcceptedFriends = () => {
      friendApi.accepted()
        .then((response) => {
          if (isActive) setAcceptedFriends(response.data || [])
        })
        .catch(() => {})
        .finally(() => {
          if (isActive) setAcceptedFriendsLoading(false)
        })
    }

    loadAcceptedFriends()
    const intervalId = window.setInterval(loadAcceptedFriends, 30000)
    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!storyFile) {
      setStoryPreview('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(storyFile)
    setStoryPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [storyFile])

  useEffect(() => {
    if (!postFile) {
      setPostPreview('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(postFile)
    setPostPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [postFile])

  useEffect(() => {
    if (!activePostImage) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActivePostImage(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [activePostImage])

  useEffect(() => {
    if (!shareTarget) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !sharing) {
        setShareTarget(null)
        setShareCaption('')
        setShareError('')
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [shareTarget, sharing])

  useEffect(() => {
    if (!activeStory) return undefined
    const handleStoryKeys = (event) => {
      if (event.key === 'Escape') setActiveStory(null)
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowRight') moveStory(1)
      if (event.key === 'ArrowLeft') moveStory(-1)
    }
    window.addEventListener('keydown', handleStoryKeys)
    return () => window.removeEventListener('keydown', handleStoryKeys)
  }, [activeStory, stories])

  useEffect(() => {
    if (activeStory) return
    setStoryReply('')
    setStoryViewerError('')
    setStoryViewerNotice('')
  }, [activeStory])

  useEffect(() => {
    if (!notice) return undefined
    const timeoutId = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const closeStoryComposer = () => {
    setStoryModalOpen(false)
    setStoryContent('')
    setStoryFile(null)
    setStoryError('')
  }

  const moveStory = (direction) => {
    if (!activeStory || stories.length < 2) return
    const currentIndex = stories.findIndex((story) => String(story.storyId) === String(activeStory.storyId))
    if (currentIndex < 0) return
    const nextIndex = (currentIndex + direction + stories.length) % stories.length
    setActiveStory(stories[nextIndex])
    setStoryReply('')
    setStoryViewerError('')
    setStoryViewerNotice('')
  }

  const sendStoryReply = async (content, keepViewerOpen = false) => {
    if (!activeStory || !content.trim() || storyReplySending) return
    if (String(activeStory.authorId) === String(user?.userId)) return
    setStoryReplySending(true)
    setStoryViewerError('')
    try {
      const conversationResponse = await conversationApi.getOrCreatePrivate(activeStory.authorId)
      const conversationId = conversationResponse.data.conversationId
      const storyContext = activeStory.content?.trim() || (activeStory.mediaType === 'VIDEO' ? 'video' : activeStory.mediaType === 'IMAGE' ? 'ảnh' : 'tin')
      await messageApi.send({
        conversationId,
        content: `↪ Trả lời tin của ${activeStory.authorName} (${storyContext}):\n${content.trim()}`,
        messageType: 'TEXT',
      })
      setStoryReply('')
      if (keepViewerOpen) {
        setStoryViewerNotice('Đã gửi cảm xúc vào tin nhắn.')
      } else {
        setActiveStory(null)
        navigate(`/chat/${conversationId}`)
      }
    } catch (err) {
      setStoryViewerError(err.response?.data?.message || 'Không gửi được phản hồi. Vui lòng thử lại.')
    } finally {
      setStoryReplySending(false)
    }
  }

  const deleteActiveStory = async () => {
    if (!activeStory || String(activeStory.authorId) !== String(user?.userId) || storyDeleting) return
    if (!window.confirm('Bạn có chắc muốn xóa tin này?')) return
    setStoryDeleting(true)
    setStoryViewerError('')
    setStoryViewerNotice('')
    try {
      const currentIndex = stories.findIndex((story) => String(story.storyId) === String(activeStory.storyId))
      await storyApi.delete(activeStory.storyId)
      const remainingStories = stories.filter((story) => String(story.storyId) !== String(activeStory.storyId))
      setStories(remainingStories)
      setActiveStory(remainingStories[currentIndex] || remainingStories[currentIndex - 1] || null)
      setStoryViewerError('')
    } catch (err) {
      setStoryViewerError(err.response?.data?.message || 'Không xóa được tin. Vui lòng thử lại.')
    } finally {
      setStoryDeleting(false)
    }
  }

  const publishStory = async (event) => {
    event.preventDefault()
    const trimmedContent = storyContent.trim()
    if (!trimmedContent && !storyFile) {
      setStoryError('Hãy nhập nội dung hoặc chọn ảnh/video.')
      return
    }

    setStoryPosting(true)
    setStoryError('')
    try {
      let mediaUrl = null
      let mediaType = null
      if (storyFile) {
        const uploadResponse = await storyApi.upload(storyFile)
        mediaUrl = uploadResponse.data.url
        mediaType = uploadResponse.data.mediaType
      }
      const response = await storyApi.create({ content: trimmedContent || null, mediaUrl, mediaType })
      setStories((current) => [response.data, ...current])
      closeStoryComposer()
      setActiveStory(response.data)
    } catch (err) {
      setStoryError(err.response?.data?.message || 'Không thể đăng tin. Vui lòng thử lại.')
    } finally {
      setStoryPosting(false)
    }
  }

  const publishPost = async (event) => {
    event.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent && !postFile) return
    if (videoApi.isVideoFile(postFile) && !videoApi.isBrowserPlayableVideo(postFile)) {
      setError('Video cần có định dạng MP4, WebM hoặc Ogg để phát được trên trình duyệt.')
      return
    }
    setPosting(true)
    setError('')
    try {
      let imageUrl = null
      let mediaType = null
      if (postFile) {
        if (videoApi.isVideoFile(postFile)) {
          const uploadResponse = await videoApi.upload(postFile)
          imageUrl = uploadResponse.data.url
          mediaType = 'VIDEO'
        } else {
          const uploadResponse = await storyApi.upload(postFile)
          imageUrl = uploadResponse.data.url
          mediaType = uploadResponse.data.mediaType
        }
      }
      const response = await feedApi.create({ content: trimmedContent || null, imageUrl, mediaType })
      setPosts((current) => [response.data, ...current])
      setContent('')
      setPostFile(null)
      setComposerMode('text')
      if (postMediaInputRef.current) postMediaInputRef.current.value = ''
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đăng bài. Vui lòng thử lại.')
    } finally {
      setPosting(false)
    }
  }

  const sendFriendRequest = async (receiverId) => {
    setAddingFriendIds((current) => [...current, receiverId])
    try {
      await friendApi.send(receiverId)
      setSuggestedUsers((current) => current.filter((candidate) => candidate.userId !== receiverId))
      setNotice('Đã gửi lời mời kết bạn')
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi lời mời kết bạn.')
    } finally {
      setAddingFriendIds((current) => current.filter((id) => id !== receiverId))
    }
  }

  const selectReaction = async (postId, reactionType) => {
    try {
      const response = await feedApi.react(postId, reactionType)
      setPosts((current) => current.map((post) => post.postId === postId ? response.data : post))
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể cập nhật cảm xúc. Vui lòng thử lại.')
    }

    const togglePostSaved = async (post) => {
      const contentType = post.mediaType === 'VIDEO' ? 'VIDEO'
        : /https?:\/\/[^\s<>()]+/i.test(post.content || '') ? 'LINK' : 'POST'
      try {
        const { data } = await savedApi.toggle(contentType, post.postId)
        setPosts((current) => current.map((entry) => entry.postId === post.postId
          ? { ...entry, savedByViewer: data.saved } : entry))
        setNotice(data.saved ? 'Đã lưu nội dung.' : 'Đã bỏ lưu nội dung.')
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể cập nhật nội dung đã lưu.')
      }
    }
  }

  const addComment = async (postId) => {
    const draft = commentDrafts[postId]?.trim()
    if (!draft) return
    try {
      const response = await feedApi.comment(postId, draft)
      setPosts((current) => current.map((post) => post.postId === postId ? response.data : post))
    } catch {
      setPosts((current) => current.map((post) => post.postId === postId ? {
        ...post, comments: [...post.comments, { commentId: Date.now(), authorName: user?.displayName || 'Bạn', authorAvatar: user?.avatar, content: draft }],
      } : post))
    }
    setCommentDrafts((current) => ({ ...current, [postId]: '' }))
  }

  const closeShareDialog = () => {
    setShareTarget(null)
    setShareCaption('')
    setShareError('')
  }

  const sharePost = async (event) => {
    event.preventDefault()
    if (!shareTarget || sharing) return
    setSharing(true)
    setShareError('')
    try {
      const response = await feedApi.share(shareTarget.postId, shareCaption)
      const sharedPost = response.data
      const originalPostId = shareTarget.sharedPost?.postId || shareTarget.postId
      setPosts((current) => [
        { ...sharedPost },
        ...current.map((post) => (
          post.postId === originalPostId || post.sharedPost?.postId === originalPostId
            ? { ...post, shareCount: sharedPost.shareCount }
            : post
        )).filter((post) => post.postId !== sharedPost.postId),
      ])
      closeShareDialog()
      setNotice('Bài viết đã được chia sẻ lên bảng tin của bạn.')
    } catch (err) {
      setShareError(err.response?.data?.message || 'Không thể chia sẻ bài viết. Vui lòng thử lại.')
    } finally {
      setSharing(false)
    }
  }

  const deletePost = async (postId) => {
    if (!window.confirm('Xóa bài viết này?')) return
    const postToDelete = posts.find((post) => post.postId === postId)
    await feedApi.remove(postId)
    const originalPostId = postToDelete?.sharedPost?.postId
    setPosts((current) => current
      .filter((post) => post.postId !== postId && (originalPostId || post.sharedPost?.postId !== postId))
      .map((post) => originalPostId && (post.postId === originalPostId || post.sharedPost?.postId === originalPostId)
        ? { ...post, shareCount: Math.max(0, (post.shareCount || 0) - 1) }
        : post))
  }

  return (
    <div className="feed-page">
      <header className="feed-topbar">
        <button className="feed-header-brand" type="button" aria-label="KapaTalk - Trang chủ" onClick={() => navigate('/feed')}><MessengerLogo size={36} /><span>KapaTalk</span></button>
        <div className="feed-search"><span>⌕</span><input placeholder="Tìm kiếm bạn bè, bài viết, nhóm..." /></div>
        <div className="feed-top-actions">
          <button type="button" className="feed-top-active" aria-label="Trang chủ" onClick={() => navigate('/feed')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg></button>
          <button type="button" aria-label="Bạn bè" onClick={() => navigate('/friends')}><FriendsIcon size={19} /></button>
          <button type="button" className="feed-top-video" aria-label="Video" onClick={() => setNotice('Video đang ở bản xem trước')}><FeedVideoIcon size={19} /></button>
          <button type="button" className={pendingRequestCount > 0 ? 'has-alert' : ''} aria-label={`Lời mời kết bạn: ${pendingRequestCount}`} onClick={() => navigate('/friends')}><BellIcon size={19} />{pendingRequestCount > 0 && <b>{pendingRequestCount > 99 ? '99+' : pendingRequestCount}</b>}</button>
          <button type="button" className={unreadMessageCount > 0 ? 'has-alert' : ''} aria-label={`Tin nhắn chưa đọc: ${unreadMessageCount}`} onClick={() => navigate('/')}><ChatIcon size={19} />{unreadMessageCount > 0 && <b>{unreadMessageCount > 99 ? '99+' : unreadMessageCount}</b>}</button>
          <button className="feed-top-profile-button" type="button" aria-label="Mở trang cá nhân" onClick={() => navigate('/feed/profile')}>
            <Avatar src={user?.avatar} name={user?.displayName || 'Bạn'} size={30} />
          </button>
        </div>
      </header>
      <div className="feed-scroll-area">
      <div className="feed-layout">
      <main className="feed-main">
      <div className="feed-header">
        <div>
          <span className="feed-kicker">KAPATALK / HÔM NAY</span>
          <h1>Bảng tin</h1>
        </div>
        <span className="feed-count">{ownPostCount} bài viết</span>
      </div>

      <section className="story-panel">
        <div className="story-panel-heading"><strong>Tin của bạn bè</strong>{storiesLoading && <span>Đang tải...</span>}</div>
        <div className="story-list">
          <button className="story-card create-story" type="button" onClick={() => setStoryModalOpen(true)} aria-label="Tạo tin mới">
            <span className="story-create-icon" aria-hidden="true">+</span>
            <span className="story-create-label">Tạo tin</span>
          </button>
          {stories.map((story) => (
            <button
              className={`story-card ${story.mediaType === 'VIDEO' ? 'video-story-card' : ''}`}
              key={story.storyId}
              type="button"
              onClick={() => setActiveStory(story)}
              style={story.mediaType === 'IMAGE' && story.mediaUrl
                ? { backgroundImage: `linear-gradient(180deg, transparent 28%, rgba(6,14,30,.94)), url(${story.mediaUrl})` }
                : undefined}
              title={story.content || (story.mediaType === 'VIDEO' ? 'Tin video' : 'Tin văn bản')}
            >
              {story.mediaType === 'VIDEO' && story.mediaUrl && (
                <video
                  className="story-card-video"
                  src={story.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedData={(event) => event.currentTarget.pause()}
                  aria-hidden="true"
                />
              )}
              <Avatar className="story-avatar" src={story.authorAvatar} name={story.authorName} size={26} />
              <span>{story.authorName}</span>
            </button>
          ))}
        </div>
        {storiesError && <div className="story-error">{storiesError}</div>}
      </section>

      {storyModalOpen && (
        <div className="story-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeStoryComposer() }}>
          <form className="story-create-dialog" onSubmit={publishStory}>
            <header className="story-dialog-header">
              <h2>Tạo tin</h2>
              <button type="button" className="story-dialog-close" onClick={closeStoryComposer} aria-label="Đóng">×</button>
            </header>
            <div className="story-dialog-author">
              <Avatar src={user?.avatar} name={user?.displayName || user?.username} size={38} />
              <strong>{user?.displayName || user?.username || 'Bạn'}</strong>
            </div>
            <textarea
              className="story-text-input"
              value={storyContent}
              onChange={(event) => setStoryContent(event.target.value)}
              placeholder="Chia sẻ điều gì đó..."
              maxLength={500}
              rows={4}
            />
            {storyPreview && (
              <div className="story-upload-preview">
                {storyFile?.type.startsWith('video/')
                  ? <video src={storyPreview} controls />
                  : <img src={storyPreview} alt="Xem trước tin" />}
                <button type="button" onClick={() => setStoryFile(null)} aria-label="Xóa tệp đã chọn">×</button>
              </div>
            )}
            <label className="story-file-picker">
              <span>Ảnh hoặc video</span>
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg"
                onChange={(event) => {
                  setStoryFile(event.target.files?.[0] || null)
                  setStoryError('')
                }}
              />
            </label>
            <p className="story-expiry-note">Tin sẽ tự ẩn sau 24 giờ. Tệp tối đa 10 MB.</p>
            {storyError && <div className="story-error">{storyError}</div>}
            <button className="story-submit-button" type="submit" disabled={storyPosting || (!storyContent.trim() && !storyFile)}>
              {storyPosting ? 'Đang đăng...' : 'Chia sẻ lên tin'}
            </button>
          </form>
        </div>
      )}

      {activeStory && (
        <div className="story-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveStory(null) }}>
          <section
            className={`story-viewer ${activeStory.mediaType === 'TEXT' || !activeStory.mediaType ? 'text-story-viewer' : ''}`}
            aria-label="Tin"
            onTouchStart={(event) => { storyTouchStartX.current = event.touches[0]?.clientX ?? null }}
            onTouchEnd={(event) => {
              const startX = storyTouchStartX.current
              const endX = event.changedTouches[0]?.clientX
              if (startX != null && endX != null && Math.abs(endX - startX) > 45) moveStory(endX < startX ? 1 : -1)
              storyTouchStartX.current = null
            }}
          >
            <header className="story-viewer-header">
              <div className="story-viewer-author">
                <Avatar src={activeStory.authorAvatar} name={activeStory.authorName} size={34} />
                <div><strong>{activeStory.authorName}</strong><small>{formatPostTime(activeStory.createdAt)}</small></div>
              </div>
              {String(activeStory.authorId) === String(user?.userId) && (
                <button type="button" className="story-delete-button" onClick={deleteActiveStory} disabled={storyDeleting}>
                  {storyDeleting ? 'Đang xóa…' : 'Xóa tin'}
                </button>
              )}
              <button type="button" className="story-dialog-close" onClick={() => setActiveStory(null)} aria-label="Đóng">×</button>
            </header>
            <div className="story-viewer-stage">
              {activeStory.mediaType === 'IMAGE' && <img className="story-viewer-media" src={activeStory.mediaUrl} alt="Ảnh trong tin" />}
              {activeStory.mediaType === 'VIDEO' && <video className="story-viewer-media" src={activeStory.mediaUrl} controls autoPlay />}
              {stories.length > 1 && <>
                <button type="button" className="story-nav-button previous" onClick={() => moveStory(-1)} aria-label="Tin trước">‹</button>
                <button type="button" className="story-nav-button next" onClick={() => moveStory(1)} aria-label="Tin tiếp theo">›</button>
              </>}
            </div>
            {activeStory.content && <p className="story-viewer-caption">{activeStory.content}</p>}
            {String(activeStory.authorId) !== String(user?.userId) && (
              <div className="story-reply-panel">
                {storyViewerError && <div className="story-viewer-error">{storyViewerError}</div>}
                <div className="story-reactions" aria-label="Thả cảm xúc cho tin">
                  {storyReactions.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => sendStoryReply(emoji, true)} disabled={storyReplySending} aria-label={`Gửi ${emoji} phản hồi`}>
                      {emoji}
                    </button>
                  ))}
                </div>
                {storyViewerNotice && <div className="story-viewer-notice">{storyViewerNotice}</div>}
                <form className="story-reply-form" onSubmit={(event) => { event.preventDefault(); sendStoryReply(storyReply) }}>
                  <input value={storyReply} onChange={(event) => setStoryReply(event.target.value)} placeholder="Trả lời tin…" maxLength={2000} />
                  <button type="submit" disabled={storyReplySending || !storyReply.trim()}>{storyReplySending ? 'Đang gửi…' : 'Gửi'}</button>
                </form>
              </div>
            )}
            {String(activeStory.authorId) === String(user?.userId) && storyViewerError && <div className="story-viewer-error">{storyViewerError}</div>}
          </section>
        </div>
      )}

      {activePostImage && (
        <div className="post-image-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivePostImage(null) }}>
          <button className="post-image-viewer-close" type="button" onClick={() => setActivePostImage(null)} aria-label="Đóng ảnh">×</button>
          <img className="post-image-viewer" src={activePostImage.src} alt={activePostImage.alt} />
        </div>
      )}

      <form className="create-post-card" onSubmit={publishPost}>
        <Avatar src={user?.avatar} name={user?.displayName || user?.username} size={42} />
        <div className="create-post-main">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Bạn đang nghĩ gì?"
            rows={1}
            maxLength={10000}
          />
          {postPreview && (
            <div className="post-composer-preview">
              {videoApi.isVideoFile(postFile)
                ? <video src={postPreview} controls />
                : <img src={postPreview} alt="Xem trước bài đăng" />}
              <button
                type="button"
                onClick={() => {
                  setPostFile(null)
                  if (postMediaInputRef.current) postMediaInputRef.current.value = ''
                }}
                aria-label="Bỏ tệp đã chọn"
              >×</button>
            </div>
          )}
          <input
            ref={postMediaInputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(event) => setPostFile(event.target.files?.[0] || null)}
          />
          <div className="composer-actions">
            <div className="composer-tools">
              <button type="button" className={composerMode === 'text' ? 'selected' : ''} onClick={() => setComposerMode('text')}>✎ <span>Đăng bài</span></button>
              <button type="button" className={composerMode === 'media' ? 'selected' : ''} onClick={() => { setComposerMode('media'); postMediaInputRef.current?.click() }}>▣ <span>Ảnh / Video</span></button>
            </div>
            <button className="publish-button" type="submit" disabled={posting || (!content.trim() && !postFile)}>{posting ? 'Đang đăng...' : 'Đăng bài'}</button>
          </div>
        </div>
      </form>

      {error && <div className="feed-error">{error}</div>}
      {feedLoadError && <div className="feed-error">{feedLoadError}</div>}
      {notice && <button className="feed-notice" type="button" onClick={() => setNotice('')}>{notice} ×</button>}
      {shareTarget && (
        <div className="share-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShareDialog() }}>
          <form className="share-dialog" onSubmit={sharePost}>
            <header className="share-dialog-header">
              <h2>Chia sẻ bài viết</h2>
              <button type="button" onClick={closeShareDialog} aria-label="Đóng">×</button>
            </header>
            <div className="share-dialog-author">
              <Avatar src={user?.avatar} name={user?.displayName || user?.username || 'Bạn'} size={38} />
              <div><strong>{user?.displayName || user?.username || 'Bạn'}</strong><small>Chia sẻ lên bảng tin</small></div>
            </div>
            <textarea className="share-caption-input" value={shareCaption} onChange={(event) => setShareCaption(event.target.value)} placeholder="Viết điều gì đó về bài viết này..." maxLength={10000} rows={3} />
            {(() => {
              const source = shareTarget.sharedPost || shareTarget
              return (
                <div className="share-source-preview">
                  <div className="shared-post-heading"><Avatar src={source.authorAvatar} name={source.authorName} size={32} /><div><strong>{source.authorName}</strong><small>{formatPostTime(source.createdAt)}</small></div></div>
                  {source.content && <p>{source.content}</p>}
                  {source.imageUrl && (source.mediaType === 'VIDEO' ? <video className="shared-post-media" src={source.imageUrl} controls preload="metadata" /> : <img className="shared-post-media" src={source.imageUrl} alt="Nội dung bài viết được chia sẻ" />)}
                </div>
              )
            })()}
            {shareError && <div className="share-dialog-error">{shareError}</div>}
            <button className="share-submit-button" type="submit" disabled={sharing}>{sharing ? 'Đang chia sẻ...' : 'Chia sẻ ngay'}</button>
          </form>
        </div>
      )}
      {loading && <div className="feed-empty">Đang tải bảng tin...</div>}
      {!loading && !feedLoadError && posts.length === 0 && <div className="feed-empty">Chưa có bài viết nào.</div>}

      <div className="feed-list">
        {posts.map((post) => (
          <article className="post-card" key={post.postId}>
            <div className="post-heading">
              <button type="button" className="feed-user-profile-link" onClick={() => navigate(`/feed/profile/${post.authorId}`)} aria-label={`Xem trang cá nhân ${post.authorName}`}><Avatar src={post.authorAvatar} name={post.authorName} size={42} /></button>
              <div className="post-author">
                <button type="button" className="feed-author-profile-link" onClick={() => navigate(`/feed/profile/${post.authorId}`)}>{post.authorName}</button>
                <span>{post.sharedPost && 'Đã chia sẻ · '}{formatPostTime(post.createdAt)}</span>
              </div>
              {String(post.authorId) === String(user?.userId) && (
                <button className="post-delete" type="button" onClick={() => deletePost(post.postId)} title="Xóa bài viết">Xóa</button>
              )}
            </div>
            {post.content && <p className="post-content">{post.content}</p>}
            {post.sharedPost ? (
              <article className="shared-post-preview">
                <header className="shared-post-heading">
                  <Avatar src={post.sharedPost.authorAvatar} name={post.sharedPost.authorName} size={32} />
                  <div><strong>{post.sharedPost.authorName}</strong><small>{formatPostTime(post.sharedPost.createdAt)}</small></div>
                </header>
                {post.sharedPost.content && <p>{post.sharedPost.content}</p>}
                {post.sharedPost.imageUrl && (post.sharedPost.mediaType === 'VIDEO'
                  ? <video className="shared-post-media" src={videoApi.resolveMediaUrl(post.sharedPost.imageUrl)} controls playsInline preload="metadata" onError={() => setError('Không phát được video đã chia sẻ. Kiểm tra định dạng video hoặc kết nối máy chủ.')} />
                  : <button className="post-image-open" type="button" onClick={() => setActivePostImage({ src: post.sharedPost.imageUrl, alt: post.sharedPost.content || 'Ảnh trong bài viết' })} aria-label="Mở ảnh bài viết gốc"><img className="shared-post-media" src={post.sharedPost.imageUrl} alt="Nội dung bài viết gốc" /></button>)}
              </article>
            ) : post.imageUrl && (post.mediaType === 'VIDEO'
              ? <video className="post-image" src={videoApi.resolveMediaUrl(post.imageUrl)} controls playsInline preload="metadata" onError={() => setError('Không phát được video trong bài viết. Kiểm tra định dạng video hoặc kết nối máy chủ.')} />
              : <button
                className="post-image-open"
                type="button"
                onClick={() => setActivePostImage({ src: post.imageUrl, alt: post.content || 'Ảnh trong bài viết' })}
                aria-label="Mở ảnh bài viết"
              ><img className="post-image" src={post.imageUrl} alt="Nội dung bài viết" /></button>)}
            <div className="post-actions">
              <PostReactionControl post={post} onSelect={selectReaction} />
              <button type="button" onClick={() => document.getElementById(`comment-${post.postId}`)?.focus()}><CommentIcon size={17} /> {post.comments.length > 0 && <span className="action-count">{post.comments.length}</span>} Bình luận </button>
              <button type="button" onClick={() => { setShareTarget(post); setShareCaption('') }}><ShareIcon size={17} /> {post.shareCount > 0 && <span className="action-count">{post.shareCount}</span>} Chia sẻ </button>
              <button type="button" className={post.savedByViewer ? 'saved-action-active' : ''} onClick={() => togglePostSaved(post)}>{post.savedByViewer ? '▣ Đã lưu' : '▣ Lưu'}</button>
            </div>
            <div className="post-comments">
              {post.comments.map((comment) => (
                <div className="post-comment" key={comment.commentId}>
                  <Avatar src={comment.authorAvatar} name={comment.authorName} size={28} />
                  <div><strong>{comment.authorName}</strong><p>{comment.content}</p></div>
                </div>
              ))}
              <div className="comment-compose">
                <input
                  id={`comment-${post.postId}`}
                  value={commentDrafts[post.postId] || ''}
                  onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.postId]: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === 'Enter') addComment(post.postId) }}
                  placeholder="Viết bình luận..."
                  maxLength={1000}
                />
                <button type="button" onClick={() => addComment(post.postId)}>Gửi</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      </main>
      <aside className="feed-aside">
        <section className="aside-card feed-profile-card">
          <div className="feed-profile-cover" style={user?.coverImage ? { backgroundImage: `linear-gradient(130deg, rgba(23, 44, 83, .2), rgba(165, 101, 98, .25)), url(${user.coverImage})` } : undefined} />
          <button className="feed-profile-avatar-button" type="button" aria-label="Mở trang cá nhân" onClick={() => navigate('/feed/profile')}>
            <Avatar className="feed-profile-avatar" src={user?.avatar} name={user?.displayName || user?.username} size={72} />
          </button>
          <button className="feed-profile-name-button" type="button" onClick={() => navigate('/feed/profile')}>
            {user?.displayName || user?.username || 'KapaTalk'}
          </button>
          <span className="feed-profile-status"><i /> Đang hoạt động</span>
          {user?.bio && <p>{user.bio}</p>}
          <div className="feed-profile-stats"><span><b>{ownPostCount}</b>{"B\u00e0i vi\u1ebft"}</span><span><b>{acceptedFriends.length}</b>{"B\u1ea1n b\u00e8"}</span><span><b>{joinedGroupCount}</b>{"Nh\u00f3m"}</span></div>
        </section>
        <section className="aside-card online-preview-card">
          <div className="aside-heading"><strong>Bạn bè của bạn ({acceptedFriends.length})</strong></div>
          {acceptedFriendsLoading && <small>Đang tải danh sách bạn bè...</small>}
          {!acceptedFriendsLoading && acceptedFriends.length === 0 && <small>Bạn chưa có bạn bè đã kết bạn.</small>}
          {acceptedFriends.slice(0, 8).map((friend, index) => {
            const isSender = String(friend.senderId) === String(user?.userId)
            const friendId = isSender ? friend.receiverId : friend.senderId
            const friendName = (isSender ? friend.receiverDisplayName : friend.senderDisplayName)
              || (isSender ? friend.receiverUsername : friend.senderUsername)
            const friendAvatar = isSender ? friend.receiverAvatar : friend.senderAvatar
            const isOnline = friendPresence[String(friendId)] === true
            return (
              <div className="online-preview-person" key={friend.id}>
                <button type="button" className="feed-friend-profile-link" onClick={() => navigate(`/feed/profile/${friendId}`)} aria-label={`Xem trang cá nhân ${friendName}`}><Avatar className={`online-preview-avatar online-preview-avatar-${index % 4} ${isOnline ? '' : 'offline'}`} src={friendAvatar} name={friendName} size={34} /><span><strong>{friendName}</strong><small><i /> {isOnline ? 'Đang online' : 'Đang offline'}</small></span></button>
              </div>
            )
          })}
          {acceptedFriends.length > 0 && <button type="button" className="preview-more-friends" onClick={() => navigate('/friends')}>› <span>Xem tất cả bạn bè</span></button>}
        </section>

        
        <section className="aside-card">
          <div className="aside-heading"><strong>Gợi ý kết bạn</strong></div>
          {suggestionsLoading && <small>Đang tải...</small>}
          {!suggestionsLoading && suggestedUsers.length === 0 && <small>Chưa có gợi ý mới.</small>}
          {suggestedUsers.map((candidate) => (
            <div className="suggested-person" key={candidate.userId}>
              <button type="button" className="suggested-profile-link" onClick={() => navigate(`/feed/profile/${candidate.userId}`)} aria-label={`Xem trang cá nhân ${candidate.displayName || candidate.username}`}><Avatar className="suggested-avatar" src={candidate.avatar} name={candidate.displayName || candidate.username} size={38} /><span><strong>{candidate.displayName || candidate.username}</strong><small>{candidate.online ? 'Đang hoạt động' : 'Người dùng KapaTalk'}</small></span></button>
              <button disabled={addingFriendIds.includes(candidate.userId)} onClick={() => sendFriendRequest(candidate.userId)}>
                {addingFriendIds.includes(candidate.userId) ? 'Đang gửi...' : 'Thêm bạn'}
              </button>
            </div>
          ))}
        </section>
        <section className="aside-card promo-card"><div className="promo-image" style={{ backgroundImage: `url(${storyImage})` }}><strong>Những điều tốt đẹp<br />sẽ luôn đến</strong><span>♥</span></div></section>
        <section className="aside-card preview-events-card">
          <div className="aside-heading"><strong>Sự kiện sắp tới</strong><span className="preview-label">Xem trước</span></div>
          {upcomingEvents.length ? upcomingEvents.map((item) => <div className="preview-event" key={item.eventId}><span className="preview-event-icon">▦</span><div><strong>{item.title}</strong><small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.startsAt))}<br />{item.location}</small></div><button type="button" onClick={() => navigate(`/events/${item.eventId}`)}>Chi tiết</button></div>) : <div className="preview-events-empty">Chưa có sự kiện sắp tới.<button type="button" onClick={() => navigate('/events')}>Khám phá</button></div>}
        </section>
        <section className="aside-card preview-video-card">
          <div className="aside-heading"><strong>Video gợi ý</strong><span className="preview-label">Xem trước</span></div>
          <div className="preview-video-thumb" style={{ backgroundImage: `linear-gradient(0deg, rgba(8, 18, 38, .5), transparent), url(${storyImage})` }}><span>▶</span><small>3:45</small></div>
          <strong className="preview-video-title">Hà Nội · Những khoảnh khắc bình yên</strong><small className="preview-video-meta">Du lịch Việt Nam · 12K lượt xem</small>
        </section>
        <section className="aside-card preview-topics-card">
          <div className="aside-heading"><strong>Chủ đề đang hot</strong><span className="preview-label">Xem trước</span></div>
          <div className="preview-topic-list">{['#CNTT', '#LậpTrình', '#DuLịch', '#ÂmNhạc', '#Anime', '#CuộcSống'].map((topic) => <span key={topic}>{topic}</span>)}</div>
        </section>
      </aside>
      <aside className="feed-right-rail">
        <section className="aside-card preview-events-card">
          <div className="aside-heading"><strong>Sự kiện sắp tới</strong><span className="preview-label">Xem trước</span></div>
          {upcomingEvents.length ? upcomingEvents.map((item) => <div className="preview-event" key={item.eventId}><span className="preview-event-icon">▦</span><div><strong>{item.title}</strong><small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.startsAt))}<br />{item.location}</small></div><button type="button" onClick={() => navigate(`/events/${item.eventId}`)}>Chi tiết</button></div>) : <div className="preview-events-empty">Chưa có sự kiện sắp tới.<button type="button" onClick={() => navigate('/events')}>Khám phá</button></div>}
        </section>
        <section className="aside-card preview-video-card">
          <div className="aside-heading"><strong>Video gợi ý</strong><span className="preview-label">Xem trước</span></div>
          <div className="preview-video-thumb" style={{ backgroundImage: `linear-gradient(0deg, rgba(8, 18, 38, .5), transparent), url(${storyImage})` }}><span>▶</span><small>3:45</small></div>
          <strong className="preview-video-title">Hà Nội · Những khoảnh khắc bình yên</strong>
          <small className="preview-video-meta">Du lịch Việt Nam · 12K lượt xem</small>
        </section>
        <section className="aside-card preview-topics-card">
          <div className="aside-heading"><strong>Chủ đề đang hot</strong><span className="preview-label">Xem trước</span></div>
          <div className="preview-topic-list">{['#CNTT', '#LậpTrình', '#DuLịch', '#ÂmNhạc', '#Anime', '#CuộcSống'].map((topic) => <span key={topic}>{topic}</span>)}</div>
        </section>
      </aside>
      </div>
      </div>
      <nav className="mobile-feed-nav"><button className="active">⌂<span>Trang chủ</span></button><button>♧<span>Bạn bè</span></button><button className="plus-button" onClick={() => document.querySelector('.create-post-main textarea')?.focus()}>+</button><button>▢<span>Chat</span></button><button>♧<span>Thông báo</span></button></nav>
    </div>
  )
}
