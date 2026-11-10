import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { feedApi } from '../api/feedApi'
import { storyApi } from '../api/storyApi'
import { videoApi } from '../api/videoApi'
import { eventApi } from '../api/eventApi'
import { savedApi } from '../api/savedApi'
import Avatar from '../components/Avatar'
import PostMenu from '../components/PostMenu'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import PrimarySidebar from '../components/PrimarySidebar'
import PrivacyPicker from '../components/PrivacyPicker'
import MediaPicker from '../components/MediaPicker'
import ActiveFriendsCard from '../components/ActiveFriendsCard'
import { BookmarkIcon, CalendarIcon, CommentIcon, PencilIcon, ShareIcon } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import '../styles/home-update.css'

const STORY_IMAGE_DURATION_MS = 5000
const postReactions = [
  { type: 'LIKE', label: 'Thích', emoji: '👍' },
  { type: 'LOVE', label: 'Yêu thích', emoji: '❤️' },
  { type: 'HAHA', label: 'Haha', emoji: '😂' },
  { type: 'WOW', label: 'Wow', emoji: '😮' },
  { type: 'ANGRY', label: 'Phẫn nộ', emoji: '😡' },
]
const storyReactions = [
  { type: 'LIKE', label: 'Thích', emoji: '👍' },
  { type: 'LOVE', label: 'Yêu thích', emoji: '❤️' },
  { type: 'HAHA', label: 'Haha', emoji: '😂' },
  { type: 'WOW', label: 'Wow', emoji: '😮' },
  { type: 'SAD', label: 'Buồn', emoji: '😢' },
  { type: 'ANGRY', label: 'Phẫn nộ', emoji: '😡' },
]
const postEmojis = ['😀', '😄', '😍', '🥰', '😂', '😊', '😎', '🤔', '😢', '😡', '🎉', '❤️']

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

// Gom các tin theo người đăng: mỗi người chỉ xuất hiện 1 lần, các tin của họ xếp từ cũ -> mới
// (giống Facebook). Nhóm nào có tin mới nhất thì đứng trước.
function groupStories(list) {
  const map = new Map()
  for (const story of list) {
    const key = String(story.authorId)
    if (!map.has(key)) {
      map.set(key, { authorId: story.authorId, authorName: story.authorName, authorAvatar: story.authorAvatar, stories: [] })
    }
    map.get(key).stories.push(story)
  }
  const time = (story) => new Date(story.createdAt).getTime() || 0
  const groups = [...map.values()]
  groups.forEach((group) => {
    group.stories.sort((a, b) => time(a) - time(b) || Number(a.storyId) - Number(b.storyId))
    group.latest = group.stories[group.stories.length - 1]
  })
  groups.sort((a, b) => time(b.latest) - time(a.latest) || Number(b.latest.storyId) - Number(a.latest.storyId))
  return groups
}

function orderStories(list) {
  return groupStories(list).flatMap((group) => group.stories)
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
  const location = useLocation()
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [stories, setStories] = useState([])
  const [viewedStoryIds, setViewedStoryIds] = useState(() => new Set())
  const [content, setContent] = useState('')
  const [postPrivacy, setPostPrivacy] = useState('PUBLIC')
  const [postFile, setPostFile] = useState(null)
  const [postPreview, setPostPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedLoadError, setFeedLoadError] = useState('')
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [storyModalOpen, setStoryModalOpen] = useState(false)
  const [storyContent, setStoryContent] = useState('')
  const [storyFile, setStoryFile] = useState(null)
  const [storyPreview, setStoryPreview] = useState('')
  const [storyPosting, setStoryPosting] = useState(false)
  const [storyError, setStoryError] = useState('')
  const [storiesError, setStoriesError] = useState('')
  const [activeStory, setActiveStory] = useState(null)
  const [storyInteraction, setStoryInteraction] = useState(null)
  const [storyCommentDraft, setStoryCommentDraft] = useState('')
  const [storyCommentSending, setStoryCommentSending] = useState(false)
  const [storyDeleting, setStoryDeleting] = useState(false)
  const [storyViewerError, setStoryViewerError] = useState('')
  const [storyProgress, setStoryProgress] = useState(0)
  const [storyPaused, setStoryPaused] = useState(false)
  const [activePostImage, setActivePostImage] = useState(null)
  const [shareTarget, setShareTarget] = useState(null)
  const [shareCaption, setShareCaption] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [commentDrafts, setCommentDrafts] = useState({})
  const [error, setError] = useState('')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const postMediaInputRef = useRef(null)
  const postTextAreaRef = useRef(null)
  const storyTouchStartX = useRef(null)
  const lastNotificationTarget = useRef('')
  const storyProgressRef = useRef(0)
  const moveStoryRef = useRef(null)

  const storyGroups = useMemo(() => groupStories(stories), [stories])
  const orderedStories = useMemo(() => storyGroups.flatMap((group) => group.stories), [storyGroups])
  const activeGroup = activeStory ? storyGroups.find((group) => String(group.authorId) === String(activeStory.authorId)) : null
  const activeIndexInGroup = activeGroup ? activeGroup.stories.findIndex((story) => String(story.storyId) === String(activeStory.storyId)) : -1
  const activeOrderedIndex = activeStory ? orderedStories.findIndex((story) => String(story.storyId) === String(activeStory.storyId)) : -1

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
    const postId = new URLSearchParams(location.search).get('postId')
    if (!postId || loading || !posts.length || lastNotificationTarget.current === `${location.search}:${postId}`) return
    const target = document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`)
    if (target) {
      lastNotificationTarget.current = `${location.search}:${postId}`
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.classList.add('post-card--notification-target')
      window.setTimeout(() => target.classList.remove('post-card--notification-target'), 2400)
    }
  }, [location.search, loading, posts])

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
    if (!user?.userId) return
    try {
      const stored = JSON.parse(localStorage.getItem(`cmctalk-viewed-stories-${user.userId}`) || '[]')
      setViewedStoryIds(new Set(stored.map(String)))
    } catch {
      setViewedStoryIds(new Set())
    }
  }, [user?.userId])

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
  }, [activeStory, orderedStories])

  useEffect(() => {
    if (activeStory) return
    setStoryViewerError('')
  }, [activeStory])

  useEffect(() => {
    if (!notice) return undefined
    const timeoutId = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  useEffect(() => {
    storyProgressRef.current = 0
    setStoryProgress(0)
  }, [activeStory?.storyId])

  // Tin ảnh/chữ tự chuyển sau vài giây; tin video chạy theo thời lượng video (xem onTimeUpdate/onEnded).
  useEffect(() => {
    if (!activeStory || activeStory.mediaType === 'VIDEO' || storyPaused) return undefined
    const startedAt = Date.now() - storyProgressRef.current * STORY_IMAGE_DURATION_MS
    const timerId = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / STORY_IMAGE_DURATION_MS)
      storyProgressRef.current = progress
      setStoryProgress(progress)
      if (progress >= 1) {
        window.clearInterval(timerId)
        moveStoryRef.current?.(1)
      }
    }, 100)
    return () => window.clearInterval(timerId)
  }, [activeStory?.storyId, activeStory?.mediaType, storyPaused])

  useEffect(() => {
    if (!activeStory) setStoryPaused(false)
  }, [activeStory])

  const closeStoryComposer = () => {
    setStoryModalOpen(false)
    setStoryContent('')
    setStoryFile(null)
    setStoryError('')
  }

  const showStory = (story) => {
    const viewedId = String(story.storyId)
    setViewedStoryIds((current) => {
      if (current.has(viewedId)) return current
      const next = new Set(current)
      next.add(viewedId)
      if (user?.userId) {
        try { localStorage.setItem(`cmctalk-viewed-stories-${user.userId}`, JSON.stringify([...next])) } catch {}
      }
      return next
    })
    setActiveStory(story)
    setStoryViewerError('')
  }

  // Lướt qua từng tin: hết tin của người này thì sang người kế tiếp; hết tất cả thì đóng.
  const moveStory = (direction) => {
    if (!activeStory) return
    const currentIndex = orderedStories.findIndex((story) => String(story.storyId) === String(activeStory.storyId))
    if (currentIndex < 0) return
    const target = orderedStories[currentIndex + direction]
    if (!target) {
      if (direction > 0) setActiveStory(null)
      return
    }
    showStory(target)
  }
  moveStoryRef.current = moveStory

  // Cảm xúc + bình luận của tin đang xem
  useEffect(() => {
    setStoryInteraction(null)
    setStoryCommentDraft('')
    if (!activeStory) return undefined
    let cancelled = false
    storyApi.interactions(activeStory.storyId)
      .then((response) => { if (!cancelled) setStoryInteraction(response.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeStory?.storyId])

  const reactToStory = async (reactionType) => {
    if (!activeStory) return
    setStoryViewerError('')
    try {
      const response = await storyApi.react(activeStory.storyId, reactionType)
      setStoryInteraction(response.data)
    } catch (err) {
      setStoryViewerError(err.response?.data?.message || 'Không thể thả cảm xúc. Vui lòng thử lại.')
    }
  }

  const submitStoryComment = async (event) => {
    event.preventDefault()
    const text = storyCommentDraft.trim()
    if (!activeStory || !text || storyCommentSending) return
    setStoryCommentSending(true)
    setStoryViewerError('')
    try {
      const response = await storyApi.comment(activeStory.storyId, text)
      setStoryInteraction(response.data)
      setStoryCommentDraft('')
    } catch (err) {
      setStoryViewerError(err.response?.data?.message || 'Không gửi được bình luận. Vui lòng thử lại.')
    } finally {
      setStoryCommentSending(false)
    }
  }

  const removeStoryComment = async (commentId) => {
    if (!activeStory) return
    setStoryViewerError('')
    try {
      const response = await storyApi.deleteComment(activeStory.storyId, commentId)
      setStoryInteraction(response.data)
    } catch (err) {
      setStoryViewerError(err.response?.data?.message || 'Không xóa được bình luận.')
    }
  }

  const deleteActiveStory = async () => {
    if (!activeStory || String(activeStory.authorId) !== String(user?.userId) || storyDeleting) return
    if (!window.confirm('Bạn có chắc muốn xóa tin này?')) return
    setStoryDeleting(true)
    setStoryViewerError('')
    try {
      const currentIndex = orderedStories.findIndex((story) => String(story.storyId) === String(activeStory.storyId))
      await storyApi.delete(activeStory.storyId)
      const remainingStories = stories.filter((story) => String(story.storyId) !== String(activeStory.storyId))
      const remainingOrdered = orderStories(remainingStories)
      setStories(remainingStories)
      setActiveStory(remainingOrdered[currentIndex] || remainingOrdered[currentIndex - 1] || null)
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
      const response = await feedApi.create({ content: trimmedContent || null, imageUrl, mediaType, privacy: postPrivacy })
      setPosts((current) => [response.data, ...current])
      setContent('')
      setPostPrivacy('PUBLIC')
      setPostFile(null)
      setEmojiPickerOpen(false)
      if (postMediaInputRef.current) postMediaInputRef.current.value = ''
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đăng bài. Vui lòng thử lại.')
    } finally {
      setPosting(false)
    }
  }

  const pickPostMedia = (kind) => {
    const input = postMediaInputRef.current
    if (!input) return
    input.accept = kind === 'video' ? 'video/*' : 'image/*'
    input.click()
  }

  const insertPostEmoji = (emoji) => {
    const textarea = postTextAreaRef.current
    const selectionStart = textarea?.selectionStart ?? content.length
    const selectionEnd = textarea?.selectionEnd ?? selectionStart
    const nextContent = `${content.slice(0, selectionStart)}${emoji}${content.slice(selectionEnd)}`
    setContent(nextContent)
    setEmojiPickerOpen(false)
    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(selectionStart + emoji.length, selectionStart + emoji.length)
    })
  }

  const selectReaction = async (postId, reactionType) => {
    try {
      const response = await feedApi.react(postId, reactionType)
      setPosts((current) => current.map((post) => post.postId === postId ? response.data : post))
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể cập nhật cảm xúc. Vui lòng thử lại.')
    }
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
      setNotice('Bài viết đã được chia sẻ lên trang chủ của bạn.')
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
      <div className="feed-scroll-area">
      <div className="feed-layout">
      <main className="feed-main">
      <section className="story-panel">
        <div className="story-panel-heading"><strong>Tin của bạn bè</strong>{storiesLoading && <span>Đang tải...</span>}</div>
        <div className="story-list">
          <button className="story-card create-story" type="button" onClick={() => setStoryModalOpen(true)} aria-label="Tạo tin mới">
            <span className="story-create-visual">
              <Avatar
                className="story-create-avatar"
                src={user?.avatar}
                name={user?.displayName || user?.username || 'Bạn'}
                size={48}
              />
              <span className="story-create-icon" aria-hidden="true">+</span>
            </span>
            <span className="story-create-label">Tạo tin</span>
          </button>
          {storyGroups.map((group) => {
            const story = group.latest
            const unseenStoryCount = group.stories.filter((item) => !viewedStoryIds.has(String(item.storyId))).length
            return (
              <button
                className={`story-card ${story.mediaType === 'VIDEO' ? 'video-story-card' : ''}`}
                key={group.authorId}
                type="button"
                onClick={() => showStory(group.stories[0])}
                style={story.mediaType === 'IMAGE' && story.mediaUrl
                  ? { backgroundImage: `linear-gradient(180deg, transparent 28%, rgba(6,14,30,.94)), url(${story.mediaUrl})` }
                  : undefined}
                title={unseenStoryCount > 0 ? `${group.authorName} · ${unseenStoryCount} tin chưa xem` : (story.content || (story.mediaType === 'VIDEO' ? 'Tin video' : 'Tin văn bản'))}
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
                <Avatar className="story-avatar" src={group.authorAvatar} name={group.authorName} size={30} />
                {unseenStoryCount > 0 && <span className="story-count-badge" aria-label={`${unseenStoryCount} tin chưa xem`}>{unseenStoryCount}</span>}
                <span>{group.authorName}</span>
              </button>
            )
          })}
        </div>
        {storiesError && <div className="story-error">{storiesError}</div>}
      </section>

      {storyModalOpen && createPortal(
        <div className="story-modal-backdrop story-composer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeStoryComposer() }}>
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
        </div>,
        document.body,
      )}

      {activeStory && createPortal(
        <div className="story-modal-backdrop story-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveStory(null) }}>
          <aside className="story-viewer-sidebar" aria-label="Danh sách tin">
            <header className="story-sidebar-heading">
              <button type="button" className="story-dialog-close" onClick={() => setActiveStory(null)} aria-label="Đóng">×</button>
              <h2>Tin</h2>
            </header>
            <section className="story-sidebar-section">
              <h3>Tin của bạn</h3>
              <button
                type="button"
                className="story-sidebar-create"
                onClick={() => { setActiveStory(null); setStoryModalOpen(true) }}
              >
                <Avatar src={user?.avatar} name={user?.displayName || user?.username || 'Bạn'} size={42} />
                <span><strong>Tạo tin</strong><small>Chia sẻ ảnh, video hoặc viết gì đó</small></span>
                <span className="story-sidebar-plus" aria-hidden="true">+</span>
              </button>
            </section>
            <section className="story-sidebar-section story-sidebar-all">
              <h3>Tất cả tin</h3>
              <div className="story-sidebar-list">
                {storyGroups.map((group) => {
                  const isActive = String(group.authorId) === String(activeStory.authorId)
                  return (
                    <button
                      key={group.authorId}
                      type="button"
                      className={`story-sidebar-item ${isActive ? 'active' : ''}`}
                      onClick={() => showStory(group.stories[0])}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <Avatar src={group.authorAvatar} name={group.authorName} size={42} />
                      <span>
                        <strong>{group.authorName}</strong>
                        <small>{group.stories.length > 1 ? `${group.stories.length} tin · ` : ''}{formatPostTime(group.latest.createdAt)}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </aside>
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
            {activeGroup && (
              <div className="story-progress" aria-label="Các tin của người này">
                {activeGroup.stories.map((story, index) => (
                  <button
                    key={story.storyId}
                    type="button"
                    className="story-progress-segment"
                    onClick={() => showStory(story)}
                    aria-label={`Xem tin ${index + 1}/${activeGroup.stories.length}`}
                    aria-current={index === activeIndexInGroup ? 'true' : undefined}
                  >
                    <span style={{ width: index < activeIndexInGroup ? '100%' : index === activeIndexInGroup ? `${Math.round(storyProgress * 100)}%` : '0%' }} />
                  </button>
                ))}
              </div>
            )}
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
              {activeStory.mediaType === 'VIDEO' && (
                <video
                  key={activeStory.storyId}
                  className="story-viewer-media"
                  src={activeStory.mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  onTimeUpdate={(event) => {
                    const { currentTime, duration } = event.currentTarget
                    if (duration > 0) {
                      storyProgressRef.current = currentTime / duration
                      setStoryProgress(currentTime / duration)
                    }
                  }}
                  onEnded={() => moveStory(1)}
                />
              )}
            </div>
            {activeStory.content && <p className="story-viewer-caption">{activeStory.content}</p>}
            <div className="story-interact">
              <div className="story-reaction-bar" role="group" aria-label="Thả cảm xúc cho tin">
                {storyReactions.map((reaction) => (
                  <button
                    key={reaction.type}
                    type="button"
                    className={storyInteraction?.viewerReaction === reaction.type ? 'selected' : ''}
                    title={reaction.label}
                    aria-label={reaction.label}
                    aria-pressed={storyInteraction?.viewerReaction === reaction.type}
                    onClick={() => reactToStory(reaction.type)}
                  >{reaction.emoji}</button>
                ))}
              </div>
              {storyInteraction?.reactionCount > 0 && (
                <div className="story-reaction-summary">
                  {storyReactions.filter((reaction) => storyInteraction.reactionCounts?.[reaction.type] > 0).map((reaction) => <span key={reaction.type}>{reaction.emoji}</span>)}
                  <b>{storyInteraction.reactionCount}</b>
                </div>
              )}
              <div className="story-comments" aria-label="Bình luận về tin">
                {storyInteraction && storyInteraction.comments.length === 0 && <p className="story-comments-empty">Chưa có bình luận nào. Hãy là người đầu tiên!</p>}
                {storyInteraction?.comments.map((comment) => (
                  <div className="story-comment" key={comment.commentId}>
                    <Avatar src={comment.authorAvatar} name={comment.authorName} size={28} />
                    <div className="story-comment-body">
                      <strong>{comment.authorName}</strong>
                      <p>{comment.content}</p>
                    </div>
                    {(String(comment.authorId) === String(user?.userId) || String(activeStory.authorId) === String(user?.userId)) && (
                      <button type="button" className="story-comment-remove" onClick={() => removeStoryComment(comment.commentId)} aria-label="Xóa bình luận" title="Xóa bình luận">×</button>
                    )}
                  </div>
                ))}
              </div>
              {storyViewerError && <div className="story-viewer-error">{storyViewerError}</div>}
              <form className="story-reply-form" onSubmit={submitStoryComment}>
                <input
                  value={storyCommentDraft}
                  onChange={(event) => setStoryCommentDraft(event.target.value)}
                  onFocus={() => setStoryPaused(true)}
                  onBlur={() => setStoryPaused(false)}
                  placeholder="Viết bình luận…"
                  maxLength={1000}
                />
                <button type="submit" disabled={storyCommentSending || !storyCommentDraft.trim()}>{storyCommentSending ? 'Đang gửi…' : 'Gửi'}</button>
              </form>
            </div>
          </section>
          {activeOrderedIndex > 0 && <button type="button" className="story-nav-outer previous" onClick={() => moveStory(-1)} aria-label="Tin trước">‹</button>}
          {activeOrderedIndex >= 0 && activeOrderedIndex < orderedStories.length - 1 && <button type="button" className="story-nav-outer next" onClick={() => moveStory(1)} aria-label="Tin tiếp theo">›</button>}
        </div>,
        document.body,
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
            ref={postTextAreaRef}
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
          <div className="composer-actions post-composer-actions">
            <div className="composer-tools">
              <button
                type="button"
                className={`composer-icon-btn ${emojiPickerOpen ? 'selected' : ''}`}
                onClick={() => setEmojiPickerOpen((open) => !open)}
                aria-label="Chọn cảm xúc"
                aria-expanded={emojiPickerOpen}
                aria-haspopup="true"
                title="Chọn cảm xúc"
              ><span aria-hidden="true">😊</span><span className="composer-action-label">Cảm xúc</span></button>
              {emojiPickerOpen && (
                <div className="post-emoji-picker" role="group" aria-label="Chèn biểu tượng cảm xúc">
                  {postEmojis.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => insertPostEmoji(emoji)} aria-label={`Chèn ${emoji}`}>{emoji}</button>
                  ))}
                </div>
              )}
            </div>
            <MediaPicker onPick={pickPostMedia} disabled={posting} />
            <PrivacyPicker value={postPrivacy} onChange={setPostPrivacy} disabled={posting} />
            <button className="publish-button" type="submit" disabled={posting || (!content.trim() && !postFile)}>{posting ? 'Đang đăng...' : 'Đăng bài'}</button>
          </div>
        </div>
      </form>

      {error && <div className="feed-error">{error}</div>}
      {feedLoadError && !loading && <ErrorState title="Không tải được trang chủ" message={feedLoadError} onRetry={loadPosts} />}
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
              <div><strong>{user?.displayName || user?.username || 'Bạn'}</strong><small>Chia sẻ lên trang chủ</small></div>
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
      {loading && <LoadingState variant="skeleton" lines={3} skeletonHeight={150} label="Đang tải trang chủ..." />}
      {!loading && !feedLoadError && posts.length === 0 && <EmptyState icon={<PencilIcon size={28} />} title="Chưa có bài viết nào" description="Hãy là người đầu tiên chia sẻ điều gì đó với mọi người." />}

      <div className="feed-list">
        {posts.map((post) => (
          <article className="post-card" data-post-id={post.postId} key={post.postId}>
            <div className="post-heading">
              <button type="button" className="feed-user-profile-link" onClick={() => navigate(`/feed/profile/${post.authorId}`)} aria-label={`Xem trang cá nhân ${post.authorName}`}><Avatar src={post.authorAvatar} name={post.authorName} size={42} /></button>
              <div className="post-author">
                <button type="button" className="feed-author-profile-link" onClick={() => navigate(`/feed/profile/${post.authorId}`)}>{post.authorName}</button>
                <span>{post.sharedPost && 'Đã chia sẻ · '}{formatPostTime(post.createdAt)} · <span className="post-privacy-indicator" title={`Quyền riêng tư: ${post.privacy === 'FRIENDS' ? 'Bạn bè' : post.privacy === 'PRIVATE' ? 'Chỉ mình tôi' : 'Công khai'}`}>{post.privacy === 'FRIENDS' ? '👥 Bạn bè' : post.privacy === 'PRIVATE' ? '🔒 Chỉ mình tôi' : '🌐 Công khai'}</span></span>
              </div>
              <PostMenu
                post={post}
                currentUserId={user?.userId}
                onPostUpdated={(updated) => { setPosts((current) => current.map((item) => item.postId === updated.postId ? updated : item)); setNotice('Đã cập nhật quyền riêng tư.') }}
                onPostDeleted={(deleted) => {
                  const originalPostId = deleted?.sharedPost?.postId
                  setPosts((current) => current.filter((item) => item.postId !== deleted.postId && (originalPostId || item.sharedPost?.postId !== deleted.postId)).map((item) => originalPostId && (item.postId === originalPostId || item.sharedPost?.postId === originalPostId) ? { ...item, shareCount: Math.max(0, (item.shareCount || 0) - 1) } : item))
                }}
                onError={setError}
              />
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
                  ? <video className="shared-post-media" src={videoApi.resolveMediaUrl(post.sharedPost.imageUrl)} controls playsInline preload="metadata" />
                  : <button className="post-image-open" type="button" onClick={() => setActivePostImage({ src: post.sharedPost.imageUrl, alt: post.sharedPost.content || 'Ảnh trong bài viết' })} aria-label="Mở ảnh bài viết gốc"><img className="shared-post-media" src={post.sharedPost.imageUrl} alt="Nội dung bài viết gốc" /></button>)}
              </article>
            ) : post.imageUrl && (post.mediaType === 'VIDEO'
              ? <video className="post-image" src={videoApi.resolveMediaUrl(post.imageUrl)} controls playsInline preload="metadata" />
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
              <button type="button" className={post.savedByViewer ? 'saved-action-active' : ''} onClick={() => togglePostSaved(post)}><BookmarkIcon size="1.05em" filled={!!post.savedByViewer} /> {post.savedByViewer ? 'Đã lưu' : 'Lưu'}</button>
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
        <PrimarySidebar />
      </aside>
      <aside className="feed-right-rail">
        <section className="aside-card preview-events-card">
          <div className="aside-heading"><strong>Sự kiện sắp tới</strong><span className="preview-label">Xem trước</span></div>
          {upcomingEvents.length ? upcomingEvents.map((item) => <div className="preview-event" key={item.eventId}><span className="preview-event-icon"><CalendarIcon size="1em" /></span><div><strong>{item.title}</strong><small>{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.startsAt))}<br />{item.location}</small></div><button type="button" onClick={() => navigate(`/events/${item.eventId}`)}>Chi tiết</button></div>) : <EmptyState compact description="Chưa có sự kiện sắp tới." action={<button type="button" className="ui-state__action" onClick={() => navigate('/events')}>Xem sự kiện</button>} />}
        </section>
        <ActiveFriendsCard />
      </aside>
      </div>
      </div>
    </div>
  )
}
