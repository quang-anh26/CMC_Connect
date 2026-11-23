import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "./Icon"
import { Avatar, Button, Modal, useToast } from "./ui"
import { storyApi } from "../api/storyApi"
import { getApiErrorMessage } from "../utils/apiError"
import { isVideoUrl, mediaUrl, timeAgo } from "../utils/format"

const IMAGE_DURATION = 5000
export const STORY_REACTIONS = [
  { type: "LIKE", label: "Thích", emoji: "👍" },
  { type: "LOVE", label: "Yêu thích", emoji: "❤️" },
  { type: "HAHA", label: "Haha", emoji: "😂" },
  { type: "WOW", label: "Wow", emoji: "😮" },
  { type: "SAD", label: "Buồn", emoji: "😢" },
  { type: "ANGRY", label: "Phẫn nộ", emoji: "😡" },
]

function orderStories(list, meId) {
  const byAuthor = new Map()
  list.forEach((s) => {
    if (!byAuthor.has(String(s.authorId))) byAuthor.set(String(s.authorId), [])
    byAuthor.get(String(s.authorId)).push(s)
  })
  const groups = [...byAuthor.entries()].map(([authorId, items]) => ({
    authorId,
    name: items[0].authorName,
    avatar: items[0].authorAvatar,
    items: items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  }))
  return groups.sort((a, b) => (a.authorId === String(meId) ? -1 : b.authorId === String(meId) ? 1 : new Date(b.items[b.items.length - 1].createdAt) - new Date(a.items[a.items.length - 1].createdAt)))
}

export function StoryViewer({ groups, startStory, meId, onClose, onDeleted, onViewed }) {
  const navigate = useNavigate()
  const toast = useToast()
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const [activeId, setActiveId] = useState(startStory.storyId)
  const [interaction, setInteraction] = useState(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [pausedStoryId, setPausedStoryId] = useState(null)
  const videoRef = useRef(null)
  const index = flat.findIndex((s) => String(s.storyId) === String(activeId))
  const story = flat[index]
  const video = story ? isVideoUrl(story.mediaUrl, story.mediaType) : false
  const paused = story && String(pausedStoryId) === String(story.storyId)
  const mine = story && String(story.authorId) === String(meId)
  const move = useCallback((dir) => {
    const target = flat[index + dir]
    if (!target) {
      if (dir > 0) onClose()
      return
    }
    setActiveId(target.storyId)
  }, [flat, index, onClose])

  useEffect(() => {
    if (story) onViewed(story.storyId)
    setProgress(0)
    setInteraction(null)
    setDraft("")
    setError("")
    if (!story) return undefined
    let cancelled = false
    storyApi.interactions(story.storyId).then((r) => !cancelled && setInteraction(r.data)).catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.storyId])

  useEffect(() => {
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
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.scrollbarGutter = previousScrollbarGutter
      document.body.style.paddingRight = previousBodyPaddingRight
    }
  }, [])

  // Ảnh/văn bản tự chuyển sau 5 giây; video chuyển khi phát xong.
  useEffect(() => {
    if (!story || video || paused) return undefined
    const start = Date.now() - (progress / 100) * IMAGE_DURATION
    const timer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / IMAGE_DURATION) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(timer)
        move(1)
      }
    }, 100)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.storyId, video, paused, move])

  useEffect(() => {
    if (!videoRef.current || !video) return
    if (paused) videoRef.current.pause()
    else videoRef.current.play().catch(() => {})
  }, [paused, story?.storyId, video])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return
      if (e.key === "ArrowRight") move(1)
      if (e.key === "ArrowLeft") move(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [move])

  if (!story) return null
  const fail = (err, fb) => setError(getApiErrorMessage(err, fb))
  const openProfile = (authorId) => {
    onClose()
    navigate(`/profile/${authorId}`)
  }

  const react = async (type) => {
    setError("")
    try { setInteraction((await storyApi.react(story.storyId, type)).data) } catch (e) { fail(e, "Không thể thả cảm xúc. Vui lòng thử lại.") }
  }
  const comment = async (e) => {
    e.preventDefault()
    if (!draft.trim() || sending) return
    setSending(true)
    setError("")
    try { setInteraction((await storyApi.comment(story.storyId, draft.trim())).data); setDraft("") } catch (err) { fail(err, "Không gửi được bình luận. Vui lòng thử lại.") } finally { setSending(false) }
  }
  const removeComment = async (id) => {
    try { setInteraction((await storyApi.deleteComment(story.storyId, id)).data) } catch (e) { fail(e, "Không xóa được bình luận.") }
  }
  const removeStory = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa tin này?")) return
    try {
      await storyApi.delete(story.storyId)
      const next = flat[index + 1] || flat[index - 1]
      onDeleted(story.storyId)
      if (next) setActiveId(next.storyId)
      else onClose()
    } catch (e) { fail(e, "Không xóa được tin. Vui lòng thử lại.") }
  }

  const counts = interaction?.reactionCounts || {}
  return (
    <div className="story-overlay" onMouseDown={onClose}>
      <button className="story-close" aria-label="Đóng" onClick={onClose}><Icon name="close" size={22} /></button>
      <div className="story-viewer-frame" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="story-nav prev" aria-label="Tin trước" disabled={index === 0} onClick={() => move(-1)}><Icon name="chevron" size={24} /></button>
        <div className="story-stage">
        <div className="story-progress">
          {flat.filter((s) => String(s.authorId) === String(story.authorId)).map((s) => {
            const pos = flat.findIndex((x) => x.storyId === s.storyId)
            return <i key={s.storyId}><b style={{ width: pos < index ? "100%" : pos === index ? `${progress}%` : "0%" }} /></i>
          })}
        </div>
        <header>
          <button type="button" className="story-author" aria-label={`Mở trang cá nhân của ${story.authorName}`} onClick={() => openProfile(story.authorId)}>
            <Avatar name={story.authorName} src={story.authorAvatar} size="sm" />
            <span><strong>{story.authorName}</strong><small>{timeAgo(story.createdAt)}</small></span>
          </button>
          {mine && <button type="button" className="icon-button" aria-label="Xóa tin" onClick={removeStory}><Icon name="trash" size={18} /></button>}
        </header>
        <div className="story-media" onClick={(e) => {
          if (e.target.closest("button")) return
      setPausedStoryId((current) => String(current) === String(story.storyId) ? null : story.storyId)
        }}>
          {story.mediaUrl && (video ? (
            <video ref={videoRef} key={story.storyId} src={mediaUrl(story.mediaUrl)} autoPlay playsInline onEnded={() => move(1)} onTimeUpdate={(e) => e.target.duration && setProgress((e.target.currentTime / e.target.duration) * 100)} />
          ) : (
            <img src={mediaUrl(story.mediaUrl)} alt="Tin" />
          ))}
          {story.content && <p className={story.mediaUrl ? "caption" : "text-only"}>{story.content}</p>}
        </div>
        {error && <p className="story-error">{error}</p>}
        <footer>
          <div className="story-reactions">
            {STORY_REACTIONS.map((r) => (
              <button key={r.type} type="button" title={r.label} className={interaction?.viewerReaction === r.type ? "active" : ""} onClick={() => react(r.type)}>
                {r.emoji}{counts[r.type] > 0 && <small>{counts[r.type]}</small>}
              </button>
            ))}
          </div>
          <div className="story-comments">
            {(interaction?.comments || []).map((c) => (
              <div className="story-comment" key={c.commentId}>
                <button type="button" className="story-comment-avatar" aria-label={`Mở trang cá nhân của ${c.authorName}`} onClick={() => openProfile(c.authorId)}><Avatar name={c.authorName} src={c.authorAvatar} size="sm" /></button>
                <p><button type="button" className="story-comment-name" onClick={() => openProfile(c.authorId)}>{c.authorName}</button>{" "}{c.content}</p>
                {(mine || String(c.authorId) === String(meId)) && <button type="button" aria-label="Xóa bình luận" onClick={() => removeComment(c.commentId)}><Icon name="close" size={14} /></button>}
              </div>
            ))}
          </div>
          <form onSubmit={comment}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={() => setPausedStoryId(story.storyId)} onBlur={() => setPausedStoryId((current) => String(current) === String(story.storyId) ? null : current)} placeholder="Trả lời tin này..." maxLength={500} />
            <button className="button button-primary" disabled={!draft.trim() || sending}>Gửi</button>
          </form>
        </footer>
        </div>
        <button type="button" className="story-nav next" aria-label="Tin kế tiếp" onClick={() => move(1)}><Icon name="chevron" size={24} /></button>
      </div>
    </div>
  )
}

function CreateStory({ onClose, onCreated }) {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!file) return setPreview("")
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async (event) => {
    event?.preventDefault()
    if (busy) return
    if (!file && !text.trim()) return setError("Hãy nhập nội dung hoặc chọn ảnh/video.")
    setBusy(true)
    setError("")
    try {
      let url = null
      let type = null
      if (file) {
        const { data } = await storyApi.upload(file)
        url = data.url
        type = data.mediaType
      }
      const { data } = await storyApi.create({ content: text.trim() || null, mediaUrl: url, mediaType: type })
      toast("Đã đăng tin.")
      onCreated(data)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể đăng tin. Vui lòng thử lại."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Tạo tin mới" close={onClose} preservePage>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="full story-file-label">Ảnh hoặc video
            <span className="story-file-picker"><span>Choose file</span>{file && <span className="story-file-name">{file.name}</span>}</span>
            <input className="story-file-input" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {preview && <div className="full story-preview">{file?.type?.startsWith("video/") ? <video src={preview} controls /> : <img src={preview} alt="Xem trước" />}</div>}
          <label className="full">Nội dung<textarea rows={3} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }} placeholder="Bạn muốn chia sẻ điều gì?" /></label>
          {error && <p className="full" style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
        </div>
        <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button type="submit" disabled={busy}>{busy ? "Đang đăng..." : "Đăng tin"}</Button></div>
      </form>
    </Modal>
  )
}

export default function Stories({ me, meId }) {
  const [stories, setStories] = useState([])
  const [viewing, setViewing] = useState(null)
  const [creating, setCreating] = useState(false)
  const key = `cmctalk-viewed-stories-${meId}`
  const [viewed, setViewed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")) } catch { return new Set() }
  })

  useEffect(() => {
    storyApi.list().then(({ data }) => setStories(data || [])).catch(() => setStories([]))
  }, [])

  const groups = useMemo(() => orderStories(stories, meId), [stories, meId])
  const markViewed = useCallback((id) => {
    setViewed((cur) => {
      if (cur.has(String(id))) return cur
      const next = new Set(cur)
      next.add(String(id))
      try { localStorage.setItem(key, JSON.stringify([...next])) } catch { /* bỏ qua */ }
      return next
    })
  }, [key])

  return (
    <section className="stories" aria-label="Tin">
      <button className="story story-create" onClick={() => setCreating(true)}>
        <span className="story-ring">
          <Avatar name={me?.displayName} src={me?.avatar} />
          <span className="story-plus"><Icon name="plus" size={13} /></span>
        </span>
        <span>Tạo tin</span>
      </button>
      {groups.map((g) => {
        const allViewed = g.items.every((s) => viewed.has(String(s.storyId)))
        const first = g.items.find((s) => !viewed.has(String(s.storyId))) || g.items[0]
        return (
          <button className="story" key={g.authorId} onClick={() => setViewing(first)}>
            <span className={`story-ring ${allViewed ? "viewed" : ""}`}><Avatar name={g.name} src={g.avatar} /></span>
            <span>{g.authorId === String(meId) ? "Tin của bạn" : g.name}</span>
          </button>
        )
      })}
      {viewing && (
        <StoryViewer
          groups={groups}
          startStory={viewing}
          meId={meId}
          onClose={() => setViewing(null)}
          onViewed={markViewed}
          onDeleted={(id) => setStories((list) => list.filter((s) => s.storyId !== id))}
        />
      )}
      {creating && <CreateStory onClose={() => setCreating(false)} onCreated={(story) => { setStories((l) => [story, ...l]); setViewing(story) }} />}
    </section>
  )
}
