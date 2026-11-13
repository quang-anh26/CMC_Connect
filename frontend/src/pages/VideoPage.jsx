import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useAsync, useToast } from "../components/ui"
import { POST_REACTIONS } from "../components/Posts"
import { videoApi } from "../api/videoApi"
import { feedApi } from "../api/feedApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { timeAgo } from "../utils/format"

const FILTERS = [["POPULAR:ALL", "Dành cho bạn"], ["LATEST:ALL", "Mới nhất"], ["POPULAR:FOLLOWING", "Đang theo dõi"], ["POPULAR:SAVED", "Đã lưu"]]

function UploadModal({ onClose, onDone }) {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [content, setContent] = useState("")
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const pick = (f) => {
    setError("")
    if (f && videoApi.isBrowserPlayableVideo && !videoApi.isBrowserPlayableVideo(f)) {
      setError("Định dạng video này có thể không phát được trên trình duyệt. Hãy dùng MP4, WebM hoặc Ogg.")
      return
    }
    setFile(f)
  }
  const submit = async () => {
    setBusy(true)
    setError("")
    try {
      const { data } = await videoApi.upload(file, (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)))
      await videoApi.create({ content: content.trim(), imageUrl: data.url, privacy: "PUBLIC" })
      toast("Đã đăng video.")
      onDone()
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể đăng video."))
    } finally { setBusy(false) }
  }
  return (
    <Modal title="Đăng video" close={onClose}>
      <div className="form-grid">
        <label className="full">Tệp video<input type="file" accept="video/*" onChange={(e) => pick(e.target.files?.[0] || null)} /></label>
        <label className="full">Mô tả<textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} maxLength={10000} /></label>
        {busy && <p className="full">Đang tải lên... {progress}%</p>}
        {error && <p className="full" style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
      </div>
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={busy || !file} onClick={submit}>Đăng video</Button></div>
    </Modal>
  )
}

function ReportModal({ card, onClose }) {
  const toast = useToast()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await videoApi.report(card.video.postId, reason.trim()); toast("Đã gửi báo cáo video."); onClose() } catch (err) { toast(getApiErrorMessage(err, "Không thể gửi báo cáo."), "error") } finally { setBusy(false) }
  }
  return (
    <Modal title="Báo cáo video" close={onClose}>
      <div className="form-grid"><label className="full">Lý do báo cáo<textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Mô tả vấn đề với video này..." /></label></div>
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={busy || !reason.trim()} onClick={submit}>Gửi báo cáo</Button></div>
    </Modal>
  )
}

function ShareModal({ card, onClose, onShared }) {
  const toast = useToast()
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await feedApi.share(card.video.postId, caption.trim()); toast("Đã chia sẻ video."); onShared(); onClose() } catch (err) { toast(getApiErrorMessage(err, "Không thể chia sẻ video."), "error") } finally { setBusy(false) }
  }
  return (
    <Modal title="Chia sẻ video" close={onClose}>
      <div className="form-grid"><label className="full">Lời nhắn (không bắt buộc)<textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Bạn nghĩ gì về video này?" /></label></div>
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button disabled={busy} onClick={submit}>Chia sẻ ngay</Button></div>
    </Modal>
  )
}

export default function VideoPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [filter, setFilter] = useState("POPULAR:ALL")
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(0)
  const [cards, setCards] = useState([])
  const [uploading, setUploading] = useState(false)
  const [reporting, setReporting] = useState(null)
  const [sharing, setSharing] = useState(null)
  const [menu, setMenu] = useState(null)
  const [open, setOpen] = useState(null)
  const [draft, setDraft] = useState("")
  useEffect(() => { const t = setTimeout(() => { setDebounced(query.trim()); setPage(0) }, 300); return () => clearTimeout(t) }, [query])
  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])
  const [sort, f] = filter.split(":")
  const { data, loading, error, reload } = useAsync(() => videoApi.list({ q: debounced, sort, filter: f, page, size: 6 }).then((r) => r.data), [debounced, filter, page])

  useEffect(() => {
    if (!data) return
    setCards((prev) => (page === 0 ? data.content || [] : [...prev, ...(data.content || [])]))
  }, [data, page])

  const patch = (postId, fn) => setCards((cs) => cs.map((c) => (c.video.postId === postId ? fn(c) : c)))
  const fail = (err, fb) => toast(getApiErrorMessage(err, fb), "error")
  const react = async (c, type) => { try { const { data: v } = await feedApi.react(c.video.postId, type); patch(c.video.postId, (x) => ({ ...x, video: v })) } catch (e) { fail(e, "Không thể thả cảm xúc.") } }
  const save = async (c) => { try { const { data: r } = await videoApi.toggleSave(c.video.postId); patch(c.video.postId, (x) => ({ ...x, savedByViewer: r.saved ?? !x.savedByViewer })); toast(r.saved ? "Đã lưu video." : "Đã bỏ lưu video.") } catch (e) { fail(e, "Không thể lưu video.") } }
  const follow = async (c) => { try { const { data: r } = await videoApi.toggleFollow(c.video.postId); patch(c.video.postId, (x) => ({ ...x, followingCreator: r.following ?? !x.followingCreator })) } catch (e) { fail(e, "Không thể theo dõi.") } }
  const comment = async (c) => {
    if (!draft.trim()) return
    try { const { data: v } = await feedApi.comment(c.video.postId, draft.trim()); patch(c.video.postId, (x) => ({ ...x, video: v })); setDraft("") } catch (e) { fail(e, "Không thể gửi bình luận.") }
  }
  const remove = async (c) => {
    if (!window.confirm("Bạn có chắc muốn xóa video này?")) return
    try { await videoApi.remove(c.video.postId); setCards((cs) => cs.filter((x) => x.video.postId !== c.video.postId)); toast("Đã xóa video.") } catch (e) { fail(e, "Không thể xóa video.") }
  }

  const last = data && (data.last ?? page + 1 >= (data.totalPages || 1))
  return (
    <div className="video-page">
      <header className="page-title-row">
        <div><h1>Video</h1><p>Khoảnh khắc, kiến thức và câu chuyện từ cộng đồng CMC.</p></div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="inline-search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm video" /></label>
          <Button icon="plus" onClick={() => setUploading(true)}>Đăng video</Button>
        </div>
      </header>
      <div className="event-filters">
        {FILTERS.map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => { setFilter(key); setPage(0) }}>{label}</button>)}
      </div>
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && cards.length === 0 && <EmptyState title="Chưa có video" copy="Hãy đăng video đầu tiên hoặc thử bộ lọc khác." icon="video" />}
      <div className="video-grid">
        {cards.map((c, i) => {
          const v = c.video
          const mine = String(v.authorId) === String(user?.userId)
          const picked = POST_REACTIONS.find((r) => r.type === v.viewerReaction)
          return (
            <article className={i === 0 ? "video-large" : ""} key={v.postId}>
              <div className="video-thumb">
                <video src={videoApi.resolveMediaUrl(c.playbackUrl || v.imageUrl)} controls playsInline preload="metadata" onPlay={() => videoApi.view(v.postId).catch(() => {})} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div className="video-info">
                <span style={{ cursor: "pointer" }} onClick={() => navigate(`/profile/${v.authorId}`)}><Avatar name={v.authorName} src={v.authorAvatar} /></span>
                <div><h3>{v.content || "Video không có mô tả"}</h3><p>{v.authorName} · {timeAgo(v.createdAt)} · {v.viewCount} lượt xem</p></div>
                {!mine && <button type="button" onClick={() => follow(c)} className="follow-chip">{c.followingCreator ? "Đang theo dõi" : "Theo dõi"}</button>}
                <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                  <button className="icon-button" aria-label="Tùy chọn video" onClick={() => setMenu(menu === v.postId ? null : v.postId)}><Icon name="more" /></button>
                  {menu === v.postId && (
                    <div className="pop-menu post-menu">
                      {mine ? <button className="danger" onClick={() => { setMenu(null); remove(c) }}><Icon name="trash" size={16} />Xóa video</button> : <button onClick={() => { setMenu(null); setReporting(c) }}>Báo cáo video</button>}
                    </div>
                  )}
                </div>
              </div>
              <div className="video-actions">
                <div className="reaction-control">
                  <button className={picked || v.likedByViewer ? "active-like" : ""} onClick={() => react(c, picked?.type || "LIKE")}>
                    {picked ? <span className="reaction-emoji">{picked.emoji}</span> : <Icon name="heart" size={18} />}{v.likeCount}
                  </button>
                  <div className="reaction-picker">{POST_REACTIONS.map((r) => <button key={r.type} type="button" title={r.label} onClick={() => react(c, r.type)}>{r.emoji}</button>)}</div>
                </div>
                <button onClick={() => setOpen(open === v.postId ? null : v.postId)}><Icon name="comment" size={18} />{(v.comments || []).length}</button>
                <button onClick={() => setSharing(c)}><Icon name="share" size={18} />{v.shareCount || 0}</button>
                <button onClick={() => save(c)}><Icon name="bookmark" size={18} />{c.savedByViewer ? "Đã lưu" : "Lưu"}</button>
              </div>
              {open === v.postId && (
                <div className="comment-thread video-comments">
                  {(v.comments || []).map((cm) => (
                    <div className="comment-preview comment-item" key={cm.commentId}><Avatar name={cm.authorName} src={cm.authorAvatar} size="sm" /><div><strong>{cm.authorName}</strong><p>{cm.content}</p><span>{timeAgo(cm.createdAt)}</span></div></div>
                  ))}
                  <form className="comment-form" onSubmit={(e) => { e.preventDefault(); comment(c) }}>
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Viết bình luận..." maxLength={2000} />
                    <button className="button button-primary" disabled={!draft.trim()}>Gửi</button>
                  </form>
                </div>
              )}
            </article>
          )
        })}
      </div>
      {loading && <Loading label="Đang tải video..." />}
      {!loading && data && !last && <div style={{ textAlign: "center", marginTop: 20 }}><Button variant="secondary" onClick={() => setPage(page + 1)}>Xem thêm video</Button></div>}
      {uploading && <UploadModal onClose={() => setUploading(false)} onDone={() => { setUploading(false); setPage(0); reload() }} />}
      {reporting && <ReportModal card={reporting} onClose={() => setReporting(null)} />}
      {sharing && <ShareModal card={sharing} onClose={() => setSharing(null)} onShared={() => patch(sharing.video.postId, (x) => ({ ...x, video: { ...x.video, shareCount: (x.video.shareCount || 0) + 1 } }))} />}
    </div>
  )
}
