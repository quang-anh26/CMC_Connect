import React, { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Icon } from "./Icon"
import { Avatar, Button, Modal, useToast } from "./ui"
import { feedApi } from "../api/feedApi"
import { savedApi } from "../api/savedApi"
import { storyApi } from "../api/storyApi"
import { videoApi } from "../api/videoApi"
import { getApiErrorMessage } from "../utils/apiError"
import { isVideoUrl, mediaUrl, timeAgo } from "../utils/format"

export const PRIVACY = {
  PUBLIC: { label: "Công khai", icon: "globe" },
  FRIENDS: { label: "Bạn bè", icon: "users" },
  PRIVATE: { label: "Chỉ mình tôi", icon: "lock" },
}

export const POST_REACTIONS = [
  { type: "LIKE", label: "Thích", emoji: "👍" },
  { type: "LOVE", label: "Yêu thích", emoji: "❤️" },
  { type: "HAHA", label: "Haha", emoji: "😂" },
  { type: "WOW", label: "Wow", emoji: "😮" },
  { type: "ANGRY", label: "Phẫn nộ", emoji: "😡" },
]

function ReactionIcons({ reactions = [] }) {
  return (
    <span className="post-reaction-summary" aria-label="Các biểu cảm đã được thả">
      {reactions.map((reaction) => {
        const knownReaction = POST_REACTIONS.find((item) => item.type === reaction.reactionType)
        return (
          <span key={reaction.reactionType} title={`${reaction.count} ${knownReaction?.label || reaction.reactionType}`}>
            {knownReaction?.emoji || "👍"}
          </span>
        )
      })}
    </span>
  )
}

const EMOJIS = ["😀", "😂", "😍", "🥰", "😎", "🤔", "👍", "🎉", "🔥", "❤️", "🙏", "😢"]

function PostMedia({ url, type, short, onOpen }) {
  if (!url) return null
  if (isVideoUrl(url, type)) {
    return (
      <button type="button" className="post-media-btn" onClick={() => onOpen?.(url)} aria-label="Xem video lớn">
        <video className="post-image" src={videoApi.resolveMediaUrl(mediaUrl(url))} playsInline preload="metadata" />
        <span className="post-video-play" aria-hidden="true">▶</span>
      </button>
    )
  }
  return (
    <button type="button" className="post-media-btn" onClick={() => onOpen?.(url)} aria-label="Xem ảnh lớn">
      <img className={`post-image ${short ? "post-image-short" : ""}`} src={mediaUrl(url)} alt="Ảnh bài viết" />
    </button>
  )
}

export function Composer({ me, onPosted }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [text, setText] = useState("")
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [privacy, setPrivacy] = useState("FRIENDS")
  const [menu, setMenu] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreview("")
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async () => {
    if (busy || (!text.trim() && !file)) return
    setBusy(true)
    try {
      let imageUrl = null
      let mediaType = null
      if (file) {
        if (videoApi.isVideoFile(file)) {
          const { data } = await videoApi.upload(file)
          imageUrl = data.url
          mediaType = "VIDEO"
        } else {
          const { data } = await storyApi.upload(file)
          imageUrl = data.url
          mediaType = data.mediaType || "IMAGE"
        }
      }
      const { data } = await feedApi.create({ content: text.trim(), imageUrl, mediaType, privacy })
      setText("")
      setFile(null)
      toast("Bài viết đã được đăng.")
      onPosted?.(data)
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể đăng bài viết."), "error")
    } finally {
      setBusy(false)
    }
  }

  const name = me?.displayName || ""
  return (
    <section className="composer panel">
      <div className="composer-input">
        <Avatar name={name} src={me?.avatar} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={name ? `${name} ơi, bạn đang nghĩ gì?` : "Bạn đang nghĩ gì?"}
          rows={2}
          maxLength={10000}
        />
      </div>
      {preview && (
        <div className="composer-preview">
          {file && videoApi.isVideoFile(file) ? <video src={preview} controls /> : <img src={preview} alt="Xem trước" />}
          <button type="button" aria-label="Bỏ tệp" onClick={() => setFile(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <div className="composer-footer">
        <div style={{ position: "relative" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              e.target.value = ""
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>
            <Icon name="image" />
            <span>Ảnh / video</span>
          </button>
          <button type="button" onClick={() => setMenu(menu === "emoji" ? null : "emoji")}>
            <Icon name="smile" />
            <span>Cảm xúc</span>
          </button>
          {menu === "emoji" && (
            <div className="pop-menu emoji-menu">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setText((t) => t + emoji)
                    setMenu(null)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="composer-submit" style={{ position: "relative" }}>
          <button type="button" className="privacy" onClick={() => setMenu(menu === "privacy" ? null : "privacy")}>
            <Icon name={PRIVACY[privacy].icon} size={16} />
            <span>{PRIVACY[privacy].label}</span>
          </button>
          {menu === "privacy" && (
            <div className="pop-menu privacy-menu">
              {Object.entries(PRIVACY).map(([value, item]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPrivacy(value)
                    setMenu(null)
                  }}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <Button disabled={busy || (!text.trim() && !file)} onClick={submit}>
            {busy ? "Đang đăng..." : "Đăng bài"}
          </Button>
        </div>
      </div>
    </section>
  )
}

function SharedPost({ post }) {
  const navigate = useNavigate()
  const openOriginalComments = () => navigate(`/feed?postId=${post.postId}&openComments=${post.postId}`)
  return (
    <div className="shared-post" role="link" tabIndex={0} onClick={openOriginalComments} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        openOriginalComments()
      }
    }}>
      <header>
        <Avatar name={post.authorName} src={post.authorAvatar} size="sm" />
        <div>
          <strong>{post.authorName}</strong>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
      </header>
      {post.content && <p>{post.content}</p>}
      <PostMedia url={post.imageUrl} type={post.mediaType} short />
    </div>
  )
}

export function PostCard({ post, meId, onChange, onRemove, onHide, onShared, openCommentsOnMount = false, hideCard = false, onCloseComments }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const [draft, setDraft] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareText, setShareText] = useState("")
  const [busy, setBusy] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editContent, setEditContent] = useState(post.content || "")
  const [savingEdit, setSavingEdit] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [commentsModalOpen, setCommentsModalOpen] = useState(false)
  const viewerCommentsRef = useRef(null)
  const commentsModalListRef = useRef(null)
  const postCopyRef = useRef(null)
  const [contentExpanded, setContentExpanded] = useState(false)
  const [contentOverflows, setContentOverflows] = useState(false)

  const closeComments = () => {
    setCommentsModalOpen(false)
    onCloseComments?.()
    if (searchParams.get("openComments") !== String(post.postId)) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("openComments")
    if (nextParams.get("postId") === String(post.postId)) nextParams.delete("postId")
    setSearchParams(nextParams, { replace: true })
  }

  useEffect(() => {
    if (openCommentsOnMount) setCommentsModalOpen(true)
  }, [openCommentsOnMount])
  const mine = String(post.authorId) === String(meId)
  const comments = post.comments || []
  const isVideo = String(post.mediaType).toUpperCase() === "VIDEO"
  const canHoverForReactions = window.matchMedia("(hover: hover)").matches

  useEffect(() => {
    const element = postCopyRef.current
    if (!element || !post.content) return undefined
    const measure = () => setContentOverflows(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [post.content, contentExpanded])

  useEffect(() => {
    if (!viewerOpen) return undefined
    const onKeyDown = (event) => event.key === "Escape" && setViewerOpen(false)
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousScrollbarGutter = document.documentElement.style.scrollbarGutter
    const previousBodyPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
    const currentBodyPaddingRight = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    document.documentElement.style.scrollbarGutter = "auto"
    if (scrollbarWidth) document.body.style.paddingRight = `${currentBodyPaddingRight + scrollbarWidth}px`
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.scrollbarGutter = previousScrollbarGutter
      document.body.style.paddingRight = previousBodyPaddingRight
    }
  }, [viewerOpen])

  const run = async (action, fallback) => {
    try {
      return await action()
    } catch (err) {
      toast(getApiErrorMessage(err, fallback), "error")
      return null
    }
  }

  const react = async (type) => {
    if (reacting) return
    setReacting(true)
    try {
      const res = await run(() => feedApi.react(post.postId, type), "Không thể thả cảm xúc.")
      if (res) {
        onChange?.(res.data)
        setReactionPickerOpen(false)
      }
    } finally {
      setReacting(false)
    }
  }
  const selectedReaction = POST_REACTIONS.find((r) => r.type === post.viewerReaction)
  const likedByViewer = Boolean(post.viewerReaction || post.likedByViewer)

  const save = async () => {
    const res = await run(() => savedApi.toggle(isVideo ? "VIDEO" : "POST", post.postId), "Không thể lưu bài viết.")
    if (res) {
      onChange?.({ ...post, savedByViewer: res.data.saved })
      toast(res.data.saved ? "Đã lưu bài viết." : "Đã bỏ lưu bài viết.")
    }
  }

  const sendComment = async (event) => {
    event.preventDefault()
    if (!draft.trim() || busy) return
    setBusy(true)
    const res = await run(() => feedApi.comment(post.postId, draft.trim()), "Không thể gửi bình luận.")
    setBusy(false)
    if (res) {
      onChange?.(res.data)
      setDraft("")
    }
  }

  const share = async () => {
    setBusy(true)
    const res = await run(() => feedApi.share(post.postId, shareText.trim()), "Không thể chia sẻ bài viết.")
    setBusy(false)
    if (res) {
      setShareOpen(false)
      setShareText("")
      onChange?.({ ...post, shareCount: (post.shareCount || 0) + 1 })
      onShared?.(res.data)
      toast("Đã chia sẻ bài viết.")
    }
  }

  const remove = () => {
    setMenuOpen(false)
    setDeleteConfirmOpen(true)
  }

  const confirmRemove = async () => {
    if (deletingPost) return
    setDeletingPost(true)
    const res = await run(() => feedApi.remove(post.postId), "Không thể xóa bài viết.")
    setDeletingPost(false)
    if (res) {
      setDeleteConfirmOpen(false)
      onRemove?.(post.postId)
      toast("Đã xóa bài viết.")
    }
  }

  const setPrivacy = async (privacy) => {
    setMenuOpen(false)
    const res = await run(() => feedApi.updatePrivacy(post.postId, privacy), "Không thể đổi quyền riêng tư.")
    if (res) onChange?.(res.data)
  }

  const saveEdit = async () => {
    if (savingEdit) return
    setSavingEdit(true)
    const res = await run(() => feedApi.update(post.postId, editContent), "Không thể chỉnh sửa bài viết.")
    setSavingEdit(false)
    if (res) {
      onChange?.(res.data)
      setEditOpen(false)
      toast("Đã cập nhật bài viết.")
    }
  }

  const hideAuthor = async () => {
    setMenuOpen(false)
    const res = await run(() => feedApi.notInterested(post.authorId), "Không thể ẩn bài viết.")
    if (res) {
      onHide?.(post.authorId)
      toast(`Đã ẩn bài viết của ${post.authorName}.`)
    }
  }

  return (
    <article className={`post panel${hideCard ? " post-card-hidden" : ""}${reactionPickerOpen ? " post-reaction-open" : ""}`} id={`post-${post.postId}`}>
      <header className="post-head">
        <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${post.authorId}`)}>
          <Avatar name={post.authorName} src={post.authorAvatar} />
        </span>
        <div>
          <strong style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${post.authorId}`)}>
            {post.authorName}
          </strong>
          <span>
            {timeAgo(post.createdAt)} · {(PRIVACY[post.privacy] || PRIVACY.PUBLIC).label}
          </span>
        </div>
        {(
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button className="icon-button" aria-label="Tùy chọn" onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="more" />
            </button>
            {menuOpen && (
              <div className="pop-menu post-menu">
                {mine ? (
                  <>
                    <button type="button" onClick={() => { setMenuOpen(false); setEditContent(post.content || ""); setEditOpen(true) }}>
                      <Icon name="edit" size={16} />
                      Chỉnh sửa bài viết
                    </button>
                    {Object.entries(PRIVACY).map(([value, item]) => (
                      <button key={value} type="button" onClick={() => setPrivacy(value)}>
                        <Icon name={item.icon} size={16} />
                        {item.label}
                      </button>
                    ))}
                    <button type="button" className="danger" onClick={remove}>
                      <Icon name="trash" size={16} />
                      Xóa bài viết
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={hideAuthor}>
                    <Icon name="close" size={16} />
                    Không quan tâm
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>
      {post.content && (
        <div className="post-copy">
          <p ref={postCopyRef} className={contentExpanded ? "post-copy-text expanded" : "post-copy-text clamped"}>{post.content}</p>
          {(contentOverflows || contentExpanded) && <button type="button" className="post-copy-toggle" onClick={() => setContentExpanded((value) => !value)}>{contentExpanded ? "Ẩn bớt" : "Xem thêm"}</button>}
        </div>
      )}
      {post.sharedPost ? <SharedPost post={post.sharedPost} /> : <PostMedia url={post.imageUrl} type={post.mediaType} onOpen={() => setViewerOpen(true)} />}
      <div className="post-meta">
        {(post.likeCount || 0) > 0 && (
          <span className="post-reaction-count">
            <ReactionIcons reactions={post.reactionSummary || []} />
            {post.likeCount} lượt cảm xúc
          </span>
        )}
        <span>
          {comments.length} bình luận · {post.shareCount || 0} lượt chia sẻ
        </span>
      </div>
      <div className="post-actions">
        <div
          className="post-reaction-control"
          onMouseEnter={() => canHoverForReactions && setReactionPickerOpen(true)}
          onMouseLeave={() => canHoverForReactions && setReactionPickerOpen(false)}
        >
          <button
            type="button"
            disabled={reacting}
            className={likedByViewer ? "liked" : ""}
            aria-pressed={likedByViewer}
            onClick={() => {
              if (!canHoverForReactions) {
                setReactionPickerOpen(true)
                return
              }
              react(selectedReaction?.type || "LOVE")
            }}
          >
            {selectedReaction ? <span className="reaction-emoji">{selectedReaction.emoji}</span> : <Icon name="heart" />}
            {selectedReaction?.label || "Yêu thích"}
          </button>
          {reactionPickerOpen && (
            <div className="post-reaction-picker">
              {POST_REACTIONS.map((reaction) => (
                <button key={reaction.type} type="button" title={reaction.label} aria-label={reaction.label} disabled={reacting} onClick={() => react(reaction.type)}>
                  {reaction.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setCommentsModalOpen(true)}>
          <Icon name="comment" />
          Bình luận
        </button>
        <button onClick={() => setShareOpen(true)}>
          <Icon name="share" />
          Chia sẻ
        </button>
        <button className={post.savedByViewer ? "active" : ""} onClick={save}>
          <Icon name="bookmark" />
          {post.savedByViewer ? "Đã lưu" : "Lưu"}
        </button>
      </div>
      {commentsModalOpen && (
        <Modal title={`Bài viết của ${post.authorName}`} close={closeComments} wide className="post-comments-modal" backdropClassName="post-comments-backdrop" portal preservePage>
          <div className="post-comments-dialog">
            <div className="post-comments-scroll">
              <div className="post-comments-author">
                <Avatar name={post.authorName} src={post.authorAvatar} />
                <div><strong>{post.authorName}</strong><span>{timeAgo(post.createdAt)} · {(PRIVACY[post.privacy] || PRIVACY.PUBLIC).label}</span></div>
              </div>
              {post.content && <p className="post-comments-copy">{post.content}</p>}
              {post.sharedPost ? <div className="post-comments-shared"><SharedPost post={post.sharedPost} /></div> : post.imageUrl && (isVideo
                ? <video className="post-comments-media" src={videoApi.resolveMediaUrl(mediaUrl(post.imageUrl))} controls playsInline preload="metadata" onPlay={() => videoApi.view(post.postId).catch(() => {})} />
                : <img className="post-comments-media" src={mediaUrl(post.imageUrl)} alt="Ảnh bài viết" />)}
              <div className="post-viewer-stats">
                {(post.likeCount || 0) > 0 && <span className="post-viewer-reaction-count"><ReactionIcons reactions={post.reactionSummary || []} />{post.likeCount} lượt cảm xúc</span>}
                <span>{comments.length} bình luận · {post.shareCount || 0} lượt chia sẻ</span>
              </div>
              <div className="post-viewer-actions">
                <button type="button" disabled={reacting} className={likedByViewer ? "liked" : ""} aria-pressed={likedByViewer} onClick={() => react(selectedReaction?.type || "LOVE")}><Icon name="heart" /> {selectedReaction?.label || "Yêu thích"}</button>
                <button type="button" onClick={() => commentsModalListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><Icon name="comment" /> Bình luận</button>
                <button type="button" onClick={() => setShareOpen(true)}><Icon name="share" /> Chia sẻ</button>
                <button type="button" onClick={save}><Icon name="bookmark" /> {post.savedByViewer ? "Đã lưu" : "Lưu"}</button>
              </div>
              <div className="post-comments-list" ref={commentsModalListRef}>
                {comments.map((c) => <div className="post-viewer-comment" key={c.commentId}>
                  <button type="button" className="post-viewer-comment-profile" aria-label={`Mở trang cá nhân của ${c.authorName}`} onClick={() => { closeComments(); navigate(`/profile/${c.authorId}`) }}><Avatar name={c.authorName} src={c.authorAvatar} size="sm" /></button>
                  <div className="post-viewer-comment-body">
                    <div className="post-viewer-comment-meta"><button type="button" onClick={() => { closeComments(); navigate(`/profile/${c.authorId}`) }}>{c.authorName}</button><small>{timeAgo(c.createdAt)}</small></div>
                    <p>{c.content}</p>
                  </div>
                </div>)}
                {comments.length === 0 && <p className="post-viewer-empty">Chưa có bình luận nào.</p>}
              </div>
            </div>
            <form className="post-viewer-comment-form" onSubmit={sendComment}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Viết bình luận..." maxLength={2000} />
              <button type="submit" disabled={!draft.trim() || busy}>Gửi</button>
            </form>
          </div>
        </Modal>
      )}
      {viewerOpen && (
        <div className={`post-viewer ${post.imageUrl ? "has-media" : "text-only"}`} onClick={() => setViewerOpen(false)} role="dialog" aria-modal="true" aria-label="Xem bài viết">
          <button type="button" className="post-viewer-close" aria-label="Đóng" onClick={() => setViewerOpen(false)}><Icon name="close" size={22} /></button>
          {post.imageUrl && <div className="post-viewer-media" onClick={(e) => e.stopPropagation()}>
            {isVideo ? <video src={videoApi.resolveMediaUrl(mediaUrl(post.imageUrl))} controls autoPlay playsInline onPlay={() => videoApi.view(post.postId).catch(() => {})} /> : <img src={mediaUrl(post.imageUrl)} alt="Ảnh bài viết phóng to" />}
          </div>}
          <aside className="post-viewer-side" onClick={(e) => e.stopPropagation()}>
            <header>
              <Avatar name={post.authorName} src={post.authorAvatar} />
              <div><strong>{post.authorName}</strong><span>{timeAgo(post.createdAt)} · {(PRIVACY[post.privacy] || PRIVACY.PUBLIC).label}</span></div>
            </header>
            {post.content && <p className="post-viewer-copy">{post.content}</p>}
            <div className="post-viewer-actions">
              <button type="button" disabled={reacting} className={likedByViewer ? "liked" : ""} aria-pressed={likedByViewer} onClick={() => react(selectedReaction?.type || "LOVE")}><Icon name="heart" /> {selectedReaction?.label || "Yêu thích"}</button>
              <button type="button" onClick={() => { setViewerOpen(false); setCommentsModalOpen(true) }}><Icon name="comment" /> Bình luận</button>
              <button type="button" onClick={() => setShareOpen(true)}><Icon name="share" /> Chia sẻ</button>
              <button type="button" onClick={save}><Icon name="bookmark" /> {post.savedByViewer ? "Đã lưu" : "Lưu"}</button>
            </div>
            <div className="post-viewer-stats">
              {(post.likeCount || 0) > 0 && <span className="post-viewer-reaction-count"><ReactionIcons reactions={post.reactionSummary || []} />{post.likeCount} lượt cảm xúc</span>}
              <span>{comments.length} bình luận · {post.shareCount || 0} lượt chia sẻ</span>
            </div>
            <div className="post-viewer-comments" ref={viewerCommentsRef}>
              {comments.map((c) => <div className="post-viewer-comment" key={c.commentId}>
                <button type="button" className="post-viewer-comment-profile" aria-label={`Mở trang cá nhân của ${c.authorName}`} onClick={() => { setViewerOpen(false); navigate(`/profile/${c.authorId}`) }}><Avatar name={c.authorName} src={c.authorAvatar} size="sm" /></button>
                <div className="post-viewer-comment-body">
                  <div className="post-viewer-comment-meta"><button type="button" onClick={() => { setViewerOpen(false); navigate(`/profile/${c.authorId}`) }}>{c.authorName}</button><small>{timeAgo(c.createdAt)}</small></div>
                  <p>{c.content}</p>
                </div>
              </div>)}
              {comments.length === 0 && <p className="post-viewer-empty">Chưa có bình luận nào.</p>}
            </div>
            <form className="post-viewer-comment-form" onSubmit={sendComment}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Viết bình luận..." maxLength={2000} />
              <button type="submit" disabled={!draft.trim() || busy}>Gửi</button>
            </form>
          </aside>
        </div>
      )}
      {shareOpen && (
        <Modal title="Chia sẻ bài viết" close={() => setShareOpen(false)}>
          <div className="form-grid">
            <label className="full">
              Lời nhắn (không bắt buộc)
              <textarea rows={3} value={shareText} onChange={(e) => setShareText(e.target.value)} placeholder="Bạn nghĩ gì về bài viết này?" />
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShareOpen(false)}>Hủy</Button>
            <Button disabled={busy} onClick={share}>Chia sẻ ngay</Button>
          </div>
        </Modal>
      )}
      {editOpen && (
        <Modal title="Chỉnh sửa bài viết" close={() => !savingEdit && setEditOpen(false)}>
          <div className="form-grid">
            <label className="full">
              Nội dung bài viết
              <textarea rows={5} value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={10000} />
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" disabled={savingEdit} onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button disabled={savingEdit || (editContent.trim() === (post.content || ""))} onClick={saveEdit}>
              {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </Modal>
      )}
      {deleteConfirmOpen && (
        <Modal
          title="Xóa bài viết"
          close={() => !deletingPost && setDeleteConfirmOpen(false)}
          className="collection-delete-modal"
          backdropClassName="post-delete-confirm-backdrop"
          portal
          preservePage
        >
          <div className="collection-delete-content">
            <span className="collection-delete-icon"><Icon name="trash" size={20} /></span>
            <div>
              <strong>Bạn có chắc muốn xóa bài viết này?</strong>
              <p>Bài viết sẽ bị xóa và không thể khôi phục.</p>
            </div>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" disabled={deletingPost} onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
            <Button variant="danger" disabled={deletingPost} onClick={confirmRemove}>{deletingPost ? "Đang xóa..." : "Xóa bài viết"}</Button>
          </div>
        </Modal>
      )}
    </article>
  )
}