import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { feedApi } from '../api/feedApi'
import { videoApi } from '../api/videoApi'
import { useAuth } from '../context/AuthContext'
import { CommentIcon, ShareIcon } from '../components/Icons'

const PAGE_SIZE = 5
const reactions = [
  ['LIKE', '👍', 'Thích'], ['LOVE', '❤️', 'Yêu thích'], ['HAHA', '😂', 'Haha'],
  ['WOW', '😮', 'Wow'], ['ANGRY', '😡', 'Phẫn nộ'],
]

function LikeOutlineIcon() {
  return (
    <svg className="like-outline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm0 0 4-7c1.5 0 2.2 1.1 1.8 2.5L12 10h6.2a2 2 0 0 1 2 2.4l-1.5 7a2 2 0 0 1-2 1.6H7" />
    </svg>
  )
}

export default function VideosPage() {
  const { user } = useAuth()
  const scrollerRef = useRef(null)
  const sentinelRef = useRef(null)
  const viewedRef = useRef(new Set())
  const [videos, setVideos] = useState([])
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const sort = 'POPULAR'
  const [filter, setFilter] = useState('ALL')
  const [page, setPage] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [replyTargets, setReplyTargets] = useState({})
  const [notice, setNotice] = useState('')
  const [shareTarget, setShareTarget] = useState(null)
  const [shareCaption, setShareCaption] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    if (!shareTarget) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !sharing) closeShareDialog()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [shareTarget, sharing])

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(queryInput.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [queryInput])

  useEffect(() => {
    let active = true
    setLoading(true)
    setVideos([])
    setPage(0)
    setHasMore(true)
    videoApi.list({ q: query, sort, filter, page: 0, size: PAGE_SIZE })
      .then(({ data }) => {
        if (!active) return
        setVideos(data.content || [])
        setHasMore(!data.last)
        setError('')
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Không thể tải video.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filter, query, retryKey, sort])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollerRef.current
    if (!sentinel || !root || loading || loadingMore || !hasMore || moreError) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    }, { root, rootMargin: '420px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, moreError, page, filter, query, sort])

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return
    setLoadingMore(true)
    setMoreError('')
    try {
      const nextPage = page + 1
      const { data } = await videoApi.list({ q: query, sort, filter, page: nextPage, size: PAGE_SIZE })
      setVideos((current) => [...current, ...(data.content || [])])
      setPage(nextPage)
      setHasMore(!data.last)
    } catch (err) {
      setMoreError(err.response?.data?.message || 'Không thể tải thêm video.')
    } finally {
      setLoadingMore(false)
    }
  }

  const updateCard = (postId, update) => setVideos((current) => current.map((card) => card.video.postId === postId ? update(card) : card))

  const recordView = async (postId) => {
    if (viewedRef.current.has(postId)) return
    viewedRef.current.add(postId)
    try {
      const { data } = await videoApi.view(postId)
      updateCard(postId, (card) => ({ ...card, video: { ...card.video, viewCount: data.viewCount } }))
    } catch { viewedRef.current.delete(postId) }
  }

  const reactToVideo = async (postId, reactionType) => {
    try {
      const { data } = await feedApi.react(postId, reactionType)
      updateCard(postId, (card) => ({ ...card, video: data }))
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể cập nhật cảm xúc.') }
  }

  const toggleFollow = async (card) => {
    try {
      const { data } = await videoApi.toggleFollow(card.video.postId)
      updateCard(card.video.postId, (current) => ({ ...current, followingCreator: data.following }))
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể theo dõi người đăng.') }
  }

  const submitComment = async (event, card, parentCommentId = null) => {
    event.preventDefault()
    const key = `${card.video.postId}:${parentCommentId || 'root'}`
    const content = (commentDrafts[key] || '').trim()
    if (!content) return
    try {
      const { data } = await feedApi.comment(card.video.postId, content, parentCommentId)
      updateCard(card.video.postId, (current) => ({ ...current, video: data }))
      setCommentDrafts((current) => ({ ...current, [key]: '' }))
      if (parentCommentId) setReplyTargets((current) => ({ ...current, [card.video.postId]: null }))
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể gửi bình luận.') }
  }

  const deleteVideo = async (card) => {
    if (!window.confirm('Bạn có chắc muốn xóa video này?')) return
    try {
      await videoApi.remove(card.video.postId)
      setVideos((current) => current.filter((item) => item.video.postId !== card.video.postId))
      setNotice('Đã xóa video.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể xóa video.') }
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (!reportTarget || !reportReason.trim()) return
    setReporting(true)
    try {
      await videoApi.report(reportTarget.video.postId, reportReason.trim())
      setNotice('Đã gửi báo cáo video.')
      setReportTarget(null)
      setReportReason('')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể gửi báo cáo.') }
    finally { setReporting(false) }
  }

  const closeShareDialog = () => {
    setShareTarget(null)
    setShareCaption('')
    setShareError('')
  }

  const shareVideo = async (event) => {
    event.preventDefault()
    if (!shareTarget || sharing) return
    setSharing(true)
    setShareError('')
    try {
      await feedApi.share(shareTarget.postId, shareCaption)
      updateCard(shareTarget.postId, (current) => ({
        ...current,
        video: { ...current.video, shareCount: (current.video.shareCount || 0) + 1 },
      }))
      closeShareDialog()
      setNotice('Đã chia sẻ video lên bảng tin.')
    } catch (err) {
      setShareError(err.response?.data?.message || 'Không thể chia sẻ video. Vui lòng thử lại.')
    } finally {
      setSharing(false)
    }
  }

  const handleVideoError = (event) => {
    const errorCode = event.currentTarget.error?.code
    if (errorCode === 2) {
      setNotice('Không tải được video từ máy chủ. Hãy kiểm tra kết nối hoặc tải lại trang.')
    } else if (errorCode === 3 || errorCode === 4) {
      setNotice('Trình duyệt không giải mã được tệp này. Hãy dùng video MP4 mã hóa H.264/AAC, WebM hoặc Ogg.')
    } else {
      setNotice('Video gặp lỗi khi phát. Hãy tải lại trang hoặc thử tệp khác.')
    }
  }

  return (
    <main className="video-page" ref={scrollerRef}>
      <div className="video-layout">
        <aside className="video-sidebar">
          <span className="video-eyebrow">KAPATALK VIDEO</span>
          <h1>Video</h1>
          <label className="video-search"><span aria-hidden="true">⌕</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Tìm video, hashtag..." aria-label="Tìm video" />{queryInput && <button type="button" onClick={() => setQueryInput('')} aria-label="Xóa tìm kiếm">×</button>}</label>
          <nav className="video-nav" aria-label="Bảng tin video">
            <button type="button" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}><span>✦</span>Dành cho bạn</button>
            <button type="button" className={filter === 'FOLLOWING' ? 'active' : ''} onClick={() => setFilter('FOLLOWING')}><span>◎</span>Đang theo dõi</button>
          </nav>
        </aside>

        <section className="video-feed" aria-label="Bảng tin video">
          <div className="video-feed-heading"><div><span className="video-eyebrow">{filter === 'FOLLOWING' ? 'NHÀ SÁNG TẠO BẠN THEO DÕI' : 'GỢI Ý DÀNH RIÊNG CHO BẠN'}</span><h2>{filter === 'FOLLOWING' ? 'Đang theo dõi' : 'Dành cho bạn'}</h2></div></div>
          {loading && <div className="video-state"><span className="video-spinner" />Đang tải video...</div>}
          {!loading && error && videos.length === 0 && <div className="video-state video-state-error"><strong>Không tải được video</strong><span>{error}</span><button type="button" onClick={() => { setError(''); setRetryKey((current) => current + 1) }}>Thử lại</button></div>}
          {!loading && !error && videos.length === 0 && <div className="video-state"><span className="video-empty-mark">▶</span><strong>Chưa có video phù hợp</strong><span>{filter === 'FOLLOWING' ? 'Video từ những nhà sáng tạo bạn theo dõi sẽ xuất hiện ở đây.' : 'Thử tìm kiếm với từ khóa khác nhé.'}</span></div>}

          <div className="video-list">{videos.map((card) => {
            const post = card.video
            const isOwner = post.authorId === user?.userId
            const comments = post.comments || []
            const roots = comments.filter((comment) => !comment.parentCommentId)
            return <article className="video-card" key={post.postId}>
              <header className="video-card-author"><Link to={`/feed/profile/${post.authorId}`}><Avatar src={post.authorAvatar} name={post.authorName} size={42} /></Link><div className="video-author-copy"><Link to={`/feed/profile/${post.authorId}`}>{post.authorName}</Link><time>{post.createdAt ? new Date(post.createdAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Mới đây'}</time></div>{!isOwner && <button className="video-follow-button" type="button" onClick={() => toggleFollow(card)}>{card.followingCreator ? 'Đang theo dõi' : 'Theo dõi'}</button>}<div className="video-more-actions">{isOwner ? <button type="button" onClick={() => deleteVideo(card)}>Xóa</button> : <button type="button" onClick={() => { setReportTarget(card); setReportReason('') }}>Báo cáo</button>}</div></header>
              {post.content && <p className="video-description">{post.content}</p>}
                <video className="video-player" src={videoApi.resolveMediaUrl(card.playbackUrl || post.imageUrl)} controls playsInline preload="metadata" onPlay={() => recordView(post.postId)} onError={handleVideoError} />
              <div className="video-metrics">
                <span>{post.viewCount || 0} lượt xem</span><span>{post.likeCount || 0} lượt thích</span>
                <span>{comments.length} bình luận</span><span>{post.shareCount || 0} lượt chia sẻ</span>
              </div>
              <div className="post-actions video-actions">
                <div className="reaction-control">
                  <button type="button" className={`reaction-trigger ${post.likedByViewer ? 'liked' : ''}`} onClick={() => reactToVideo(post.postId, post.likedByViewer ? post.viewerReaction || 'LIKE' : 'LIKE')} aria-label={post.likedByViewer ? `Cảm xúc đã chọn: ${reactions.find(([type]) => type === post.viewerReaction)?.[2] || 'Thích'}` : 'Thích video'}>
                    {post.likedByViewer ? reactions.find(([type]) => type === post.viewerReaction)?.[1] || '👍' : <LikeOutlineIcon />}
                    {post.likeCount > 0 && <span className="reaction-count">{post.likeCount}</span>}
                    <span>{post.likedByViewer ? reactions.find(([type]) => type === post.viewerReaction)?.[2] || 'Thích' : 'Thích'}</span>
                  </button>
                  <div className="reaction-picker" role="group" aria-label="Chọn cảm xúc">
                    {reactions.map(([type, emoji, label]) => <button key={type} type="button" title={label} aria-label={label} onClick={() => reactToVideo(post.postId, type)}>{emoji}</button>)}
                  </div>
                </div>
                <button type="button" onClick={() => document.getElementById(`video-comment-${post.postId}`)?.focus()}><CommentIcon size={17} /> {comments.length > 0 && <span className="action-count">{comments.length}</span>} Bình luận</button>
                <button type="button" onClick={() => { setShareTarget(post); setShareCaption(''); setShareError('') }}><ShareIcon size={17} /> {post.shareCount > 0 && <span className="action-count">{post.shareCount}</span>} Chia sẻ</button>
              </div>
              <section className="video-comments">
                <div className="video-comment-list">
                  {roots.map((comment) => <div className="video-comment-thread" key={comment.commentId}>
                    <div className="video-comment"><Avatar src={comment.authorAvatar} name={comment.authorName} size={30} /><div><strong>{comment.authorName}</strong><p>{comment.content}</p></div></div>
                    {comments.filter((reply) => reply.parentCommentId === comment.commentId).map((reply) => <div className="video-comment video-reply" key={reply.commentId}><Avatar src={reply.authorAvatar} name={reply.authorName} size={26} /><div><strong>{reply.authorName}</strong><p>{reply.content}</p></div></div>)}
                    <button type="button" className="video-reply-trigger" onClick={() => setReplyTargets((current) => ({ ...current, [post.postId]: current[post.postId] === comment.commentId ? null : comment.commentId }))}>Trả lời</button>
                    {replyTargets[post.postId] === comment.commentId && <form className="video-comment-compose video-reply-compose" onSubmit={(event) => submitComment(event, card, comment.commentId)}>
                      <input value={commentDrafts[`${post.postId}:${comment.commentId}`] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [`${post.postId}:${comment.commentId}`]: event.target.value }))} placeholder={`Trả lời ${comment.authorName}...`} maxLength={1000} />
                      <button type="submit" disabled={!(commentDrafts[`${post.postId}:${comment.commentId}`] || '').trim()}>Gửi</button>
                    </form>}
                  </div>)}
                </div>
                <form className="video-comment-compose" onSubmit={(event) => submitComment(event, card)}>
                  <input id={`video-comment-${post.postId}`} value={commentDrafts[`${post.postId}:root`] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [`${post.postId}:root`]: event.target.value }))} placeholder="Viết bình luận..." maxLength={1000} />
                  <button type="submit" disabled={!(commentDrafts[`${post.postId}:root`] || '').trim()}>Gửi</button>
                </form>
              </section>
            </article>
          })}</div>
          <div className="video-load-sentinel" ref={sentinelRef} />
          {loadingMore && <div className="video-state video-loading-more"><span className="video-spinner" />Đang tải video tiếp theo...</div>}
          {moreError && <div className="video-state video-state-error"><span>{moreError}</span><button type="button" onClick={() => setMoreError('')}>Tải lại</button></div>}
          {!loading && !hasMore && videos.length > 0 && <p className="video-end-note">Bạn đã xem hết video phù hợp.</p>}
        </section>
      </div>

      {shareTarget && <div className="share-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !sharing) closeShareDialog() }}>
        <form className="share-dialog" onSubmit={shareVideo}>
          <header className="share-dialog-header">
            <h2>Chia sẻ video</h2>
            <button type="button" onClick={closeShareDialog} disabled={sharing} aria-label="Đóng">×</button>
          </header>
          <div className="share-dialog-author">
            <Avatar src={user?.avatar} name={user?.displayName || user?.username || 'Bạn'} size={38} />
            <div><strong>{user?.displayName || user?.username || 'Bạn'}</strong><small>Chia sẻ lên bảng tin</small></div>
          </div>
          <textarea className="share-caption-input" value={shareCaption} onChange={(event) => setShareCaption(event.target.value)} placeholder="Viết điều gì đó về video này..." maxLength={10000} rows={3} />
          <div className="share-source-preview">
            <div className="shared-post-heading"><Avatar src={shareTarget.authorAvatar} name={shareTarget.authorName} size={32} /><div><strong>{shareTarget.authorName}</strong><small>{shareTarget.createdAt ? new Date(shareTarget.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''}</small></div></div>
            {shareTarget.content && <p>{shareTarget.content}</p>}
            {shareTarget.imageUrl && <video className="shared-post-media" src={videoApi.resolveMediaUrl(shareTarget.imageUrl)} controls playsInline preload="metadata" />}
          </div>
          {shareError && <div className="share-dialog-error">{shareError}</div>}
          <button className="share-submit-button" type="submit" disabled={sharing}>{sharing ? 'Đang chia sẻ...' : 'Chia sẻ ngay'}</button>
        </form>
      </div>}

      {reportTarget && <div className="video-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !reporting) setReportTarget(null) }}><form className="video-editor-modal video-report-modal" onSubmit={submitReport}><header><div><span className="video-eyebrow">BÁO CÁO NỘI DUNG</span><h2>Báo cáo video</h2></div><button type="button" onClick={() => setReportTarget(null)} aria-label="Đóng">×</button></header><label className="video-form-field">Lý do<textarea required autoFocus value={reportReason} onChange={(event) => setReportReason(event.target.value)} rows="4" maxLength={500} placeholder="Mô tả vấn đề bạn muốn báo cáo..." /></label><footer><button type="button" className="video-cancel-button" onClick={() => setReportTarget(null)}>Hủy</button><button type="submit" className="video-submit-button" disabled={reporting || !reportReason.trim()}>{reporting ? 'Đang gửi...' : 'Gửi báo cáo'}</button></footer></form></div>}
      {notice && <div className="video-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}
    </main>
  )
}
