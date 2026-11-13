import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
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

const EMOJIS = ["😀", "😂", "😍", "🥰", "😎", "🤔", "👍", "🎉", "🔥", "❤️", "🙏", "😢"]

function PostMedia({ url, type, short, onOpen }) {
  if (!url) return null
  if (isVideoUrl(url, type)) {
    return <video className="post-image" src={videoApi.resolveMediaUrl(mediaUrl(url))} controls playsInline preload="metadata" />
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
  return (
    <div className="shared-post">
      <header onClick={() => navigate(`/profile/${post.authorId}`)}>
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

export function PostCard({ post, meId, onChange, onRemove, onShared }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareText, setShareText] = useState("")
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const mine = String(post.authorId) === String(meId)
  const comments = post.comments || []
  const isVideo = String(post.mediaType).toUpperCase() === "VIDEO"

  const run = async (action, fallback) => {
    try {
      return await action()
    } catch (err) {
      toast(getApiErrorMessage(err, fallback), "error")
      return null
    }
  }

  const react = async (type) => {
    const res = await run(() => feedApi.react(post.postId, type), "Không thể thả cảm xúc.")
    if (res) onChange?.(res.data)
  }
  const selectedReaction = POST_REACTIONS.find((r) => r.type === post.viewerReaction)

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

  const remove = async () => {
    setMenuOpen(false)
    if (!window.confirm("Bạn có chắc muốn xóa bài viết này?")) return
    const res = await run(() => feedApi.remove(post.postId), "Không thể xóa bài viết.")
    if (res) {
      onRemove?.(post.postId)
      toast("Đã xóa bài viết.")
    }
  }

  const setPrivacy = async (privacy) => {
    setMenuOpen(false)
    const res = await run(() => feedApi.updatePrivacy(post.postId, privacy), "Không thể đổi quyền riêng tư.")
    if (res) onChange?.(res.data)
  }

  return (
    <article className="post panel" id={`post-${post.postId}`}>
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
        {mine && (
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button className="icon-button" aria-label="Tùy chọn" onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="more" />
            </button>
            {menuOpen && (
              <div className="pop-menu post-menu">
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
              </div>
            )}
          </div>
        )}
      </header>
      {post.content && (
        <div className="post-copy">
          <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.content}</p>
        </div>
      )}
      {post.sharedPost ? <SharedPost post={post.sharedPost} /> : <PostMedia url={post.imageUrl} type={post.mediaType} onOpen={setLightbox} />}
      <div className="post-meta">
        <span>
          <b>{selectedReaction ? selectedReaction.emoji : "♥"}</b> {post.likeCount || 0} lượt thích
        </span>
        <span>
          {comments.length} bình luận · {post.shareCount || 0} lượt chia sẻ
        </span>
      </div>
      <div className="post-actions">
        <div className="reaction-control">
          <button className={selectedReaction || post.likedByViewer ? "active" : ""} onClick={() => react(selectedReaction?.type || "LIKE")}>
            {selectedReaction ? <span className="reaction-emoji">{selectedReaction.emoji}</span> : <Icon name="heart" />}
            {selectedReaction ? selectedReaction.label : "Thích"}
          </button>
          <div className="reaction-picker" role="group" aria-label="Chọn cảm xúc">
            {POST_REACTIONS.map((r) => (
              <button key={r.type} type="button" title={r.label} aria-label={r.label} onClick={() => react(r.type)}>
                {r.emoji}
              </button>
            ))}
          </div>
        </div>
        <button className={commentsOpen ? "active" : ""} onClick={() => setCommentsOpen(!commentsOpen)}>
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
      {!commentsOpen && comments.length > 0 && (
        <div className="comment-preview">
          <Avatar name={comments[comments.length - 1].authorName} src={comments[comments.length - 1].authorAvatar} size="sm" />
          <div>
            <strong>{comments[comments.length - 1].authorName}</strong>
            <p>{comments[comments.length - 1].content}</p>
            <span>{timeAgo(comments[comments.length - 1].createdAt)}</span>
          </div>
        </div>
      )}
      {commentsOpen && (
        <div className="comment-thread">
          {comments.map((c) => (
            <div className="comment-preview comment-item" key={c.commentId}>
              <Avatar name={c.authorName} src={c.authorAvatar} size="sm" />
              <div>
                <strong>{c.authorName}</strong>
                <p>{c.content}</p>
                <span>{timeAgo(c.createdAt)}</span>
              </div>
            </div>
          ))}
          <form className="comment-form" onSubmit={sendComment}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Viết bình luận..." maxLength={2000} />
            <button className="button button-primary" disabled={!draft.trim() || busy}>
              Gửi
            </button>
          </form>
        </div>
      )}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" aria-label="Đóng" onClick={() => setLightbox(null)}><Icon name="close" size={22} /></button>
          <img src={mediaUrl(lightbox)} alt="Ảnh phóng to" onClick={(e) => e.stopPropagation()} />
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
    </article>
  )
}
