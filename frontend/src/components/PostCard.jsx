import React, { useState } from 'react'
import Avatar from './Avatar'
import { BookmarkIcon, CommentIcon, ShareIcon, ThumbUpIcon } from './Icons'
import { videoApi } from '../api/videoApi'

function postTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/** Shared post presentation used by the feed and profile pages. Business actions stay in the parent. */
export default function PostCard({
  post, currentUserId, commentDraft = '', onCommentDraftChange, onComment,
  onReact, onShare, onSave, onDelete, onOpenImage, onOpenAuthor,
  showSave = true, commentAvatar, className = '',
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const comments = Array.isArray(post.comments) ? post.comments : []
  const isOwner = String(post.authorId) === String(currentUserId)
  const contentPost = post.sharedPost || post
  const mediaUrl = contentPost.imageUrl
  const isVideo = contentPost.mediaType === 'VIDEO'

  return (
    <article className={`post-card post-card-shared ${className}`.trim()}>
      <header className="post-heading post-shared-header">
        <button type="button" className="feed-user-profile-link post-avatar-link" onClick={() => onOpenAuthor?.(post.authorId)} aria-label={`Xem trang cá nhân ${post.authorName}`}>
          <Avatar src={post.authorAvatar} name={post.authorName} size={42} />
        </button>
        <div className="post-author">
          <button type="button" className="feed-author-profile-link" onClick={() => onOpenAuthor?.(post.authorId)}>{post.authorName || 'Người dùng'}</button>
          <span>{post.sharedPost ? 'Đã chia sẻ · ' : ''}{postTime(post.createdAt)}{post.privacy ? ` · ${post.privacy === 'PUBLIC' ? '🌐 Công khai' : post.privacy === 'FRIENDS' ? '👥 Bạn bè' : '🔒 Chỉ mình tôi'}` : ''}</span>
        </div>
        <div className="post-menu-wrap">
          <button type="button" className="post-menu-trigger" aria-label="Tùy chọn bài viết" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>···</button>
          {menuOpen && <div className="post-menu-popover" role="menu">
            {showSave && <button type="button" role="menuitem" onClick={() => { onSave?.(post); setMenuOpen(false) }}><BookmarkIcon size="1.05em" /> {post.savedByViewer ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}</button>}
            {isOwner && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete?.(post.postId) }}>Xóa bài viết</button>}
            {!isOwner && <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>Báo cáo bài viết</button>}
          </div>}
        </div>
      </header>
      {post.content && <p className="post-content">{post.content}</p>}
      {post.sharedPost && <article className="shared-post-preview">
        <header className="shared-post-heading"><Avatar src={post.sharedPost.authorAvatar} name={post.sharedPost.authorName} size={32} /><div><strong>{post.sharedPost.authorName}</strong><small>{postTime(post.sharedPost.createdAt)}</small></div></header>
        {post.sharedPost.content && <p>{post.sharedPost.content}</p>}
        {mediaUrl && (isVideo
          ? <video className="shared-post-media" src={videoApi.resolveMediaUrl(mediaUrl)} controls playsInline preload="metadata" />
          : <button className="post-image-open" type="button" onClick={() => onOpenImage?.({ src: mediaUrl, alt: post.sharedPost.content || 'Ảnh trong bài viết' })}><img className="shared-post-media" src={mediaUrl} alt="Nội dung bài viết được chia sẻ" /></button>)}
      </article>}
      {!post.sharedPost && post.imageUrl && (post.mediaType === 'VIDEO'
        ? <video className="post-image" src={videoApi.resolveMediaUrl(post.imageUrl)} controls playsInline preload="metadata" />
        : <button className="post-image-open" type="button" onClick={() => onOpenImage?.({ src: post.imageUrl, alt: post.content || 'Ảnh trong bài viết' })}><img className="post-image" src={post.imageUrl} alt="Nội dung bài viết" /></button>)}
      <div className="post-stats-shared"><span><ThumbUpIcon size="1em" /> {post.likeCount || 0}</span><button type="button" onClick={() => document.getElementById(`comment-${post.postId}`)?.focus()}>{comments.length} bình luận</button><span>{post.shareCount || 0} lượt chia sẻ</span></div>
      <div className="post-actions post-actions-shared">
        <button type="button" className={post.likedByViewer || post.viewerReaction ? 'liked' : ''} onClick={() => onReact?.(post)}><ThumbUpIcon size="1.05em" /> Thích</button>
        <button type="button" onClick={() => document.getElementById(`comment-${post.postId}`)?.focus()}><CommentIcon size="1.05em" /> Bình luận</button>
        <button type="button" onClick={() => onShare?.(post)}><ShareIcon size="1.05em" /> Chia sẻ</button>
        {showSave && <button type="button" className={post.savedByViewer ? 'saved-action-active' : ''} onClick={() => onSave?.(post)}><BookmarkIcon size="1.05em" filled={!!post.savedByViewer} /> {post.savedByViewer ? 'Đã lưu' : 'Lưu'}</button>}
      </div>
      <section className="post-comments post-comments-shared" aria-label="Bình luận">
        {comments.map((comment) => <div className="post-comment" key={comment.commentId}><Avatar src={comment.authorAvatar} name={comment.authorName} size={30} /><div><strong>{comment.authorName}</strong><p>{comment.content}</p></div></div>)}
        <form className="comment-compose comment-compose-shared" onSubmit={(event) => { event.preventDefault(); onComment?.(post.postId) }}>
          <Avatar src={commentAvatar?.src} name={commentAvatar?.name || 'Bạn'} size={32} />
          <input id={`comment-${post.postId}`} value={commentDraft} onChange={(event) => onCommentDraftChange?.(post.postId, event.target.value)} placeholder="Viết bình luận..." maxLength={1000} />
          <button type="submit" disabled={!commentDraft.trim()}>Gửi</button>
        </form>
      </section>
    </article>
  )
}
