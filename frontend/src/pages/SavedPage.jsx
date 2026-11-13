import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useToast } from "../components/ui"
import { PostCard } from "../components/Posts"
import { savedApi } from "../api/savedApi"
import { feedApi } from "../api/feedApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { mediaUrl, timeAgo } from "../utils/format"

const TYPES = [["ALL", "Tất cả"], ["POST", "Bài viết"], ["VIDEO", "Video"], ["GROUP_POST", "Bài trong nhóm"], ["LINK", "Liên kết"]]
const TYPE_LABEL = { POST: "Bài viết", VIDEO: "Video", GROUP_POST: "Bài viết nhóm", LINK: "Liên kết" }
const PAGE_SIZE = 24
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url } }

export default function SavedPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [collections, setCollections] = useState([])
  const [collection, setCollection] = useState("")
  const [type, setType] = useState("ALL")
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("NEWEST")
  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [menu, setMenu] = useState(null)
  const [creating, setCreating] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [activePost, setActivePost] = useState(null)
  const [total, setTotal] = useState(0)

  useEffect(() => { const t = setTimeout(() => setQuery(searchInput.trim()), 300); return () => clearTimeout(t) }, [searchInput])
  useEffect(() => {
    const close = (e) => !e.target.closest?.(".sv-menu-wrap") && setMenu(null)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [])

  const params = useCallback((p) => ({ type, q: query || undefined, collectionId: collection || undefined, sort, page: p, size: PAGE_SIZE }), [type, query, collection, sort])
  const loadCollections = useCallback(() => savedApi.collections().then((r) => setCollections(r.data || [])).catch(() => {}), [])
  const loadTotal = useCallback(() => savedApi.list({ type: "ALL", page: 0, size: 1 }).then((r) => setTotal(r.data?.totalElements ?? (r.data?.content || []).length)).catch(() => {}), [])
  useEffect(() => { loadCollections(); loadTotal() }, [loadCollections, loadTotal])

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    savedApi.list(params(0)).then((r) => {
      const list = r.data?.content || []
      setItems(list); setPage(0); setHasMore(r.data ? !(r.data.last ?? list.length < PAGE_SIZE) : false)
    }).catch((e) => setError(getApiErrorMessage(e, "Không tải được nội dung đã lưu."))).finally(() => setLoading(false))
  }, [params])
  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const r = await savedApi.list(params(page + 1))
      const list = r.data?.content || []
      setItems((cur) => [...cur, ...list]); setPage(page + 1); setHasMore(!(r.data?.last ?? list.length < PAGE_SIZE))
    } catch (e) { toast(getApiErrorMessage(e, "Không tải thêm được."), "error") } finally { setLoadingMore(false) }
  }

  const fail = (e, fb) => toast(getApiErrorMessage(e, fb), "error")
  const refresh = () => { load(); loadCollections(); loadTotal() }

  const createCollection = async () => {
    if (!nameDraft.trim()) return
    try { const { data } = await savedApi.createCollection(nameDraft.trim()); setCreating(false); setNameDraft(""); await loadCollections(); setCollection(data.collectionId); toast("Đã tạo bộ sưu tập.") } catch (e) { fail(e, "Không thể tạo bộ sưu tập.") }
  }
  const rename = async (c) => {
    setMenu(null)
    const name = window.prompt("Đổi tên bộ sưu tập:", c.name)
    if (!name?.trim() || name.trim() === c.name) return
    try { await savedApi.renameCollection(c.collectionId, name.trim()); refresh() } catch (e) { fail(e, "Không thể đổi tên.") }
  }
  const removeCollection = async (c) => {
    setMenu(null)
    if (!window.confirm(`Xóa bộ sưu tập "${c.name}"? Các mục đã lưu vẫn được giữ lại.`)) return
    try { await savedApi.deleteCollection(c.collectionId); if (String(collection) === String(c.collectionId)) setCollection(""); refresh() } catch (e) { fail(e, "Không thể xóa bộ sưu tập.") }
  }
  const unsave = async (item) => {
    setMenu(null)
    try { await savedApi.unsave(item.savedItemId); setItems((l) => l.filter((x) => x.savedItemId !== item.savedItemId)); loadCollections(); loadTotal(); toast("Đã bỏ lưu.") } catch (e) { fail(e, "Không thể bỏ lưu.") }
  }
  const changeCollection = async (item, value) => {
    setMenu(null)
    try {
      if (value) await savedApi.addToCollection(item.savedItemId, Number(value))
      else await savedApi.removeFromCollection(item.savedItemId)
      refresh()
    } catch (e) { fail(e, "Không thể chuyển bộ sưu tập.") }
  }

  const openItem = async (item) => {
    if (item.contentType === "LINK" && item.targetUrl) return window.open(item.targetUrl, "_blank", "noopener")
    if (item.contentType === "POST" || item.contentType === "VIDEO") {
      setActivePost({ postId: item.contentId, authorId: item.authorId, authorName: item.authorName, authorAvatar: item.authorAvatar, content: item.title || item.description || "", imageUrl: item.previewUrl, mediaType: item.contentType === "VIDEO" ? "VIDEO" : "IMAGE", privacy: "PUBLIC", comments: [], likeCount: 0, savedByViewer: true })
      try { setActivePost((await feedApi.get(item.contentId)).data) } catch { /* vẫn hiển thị bản xem trước */ }
      return
    }
    navigate(item.sourcePath || "/feed")
  }

  const current = collections.find((c) => String(c.collectionId) === String(collection))
  return (
    <div className="saved-page">
      <header className="page-title-row">
        <div><h1>{current ? current.name : "Nội dung đã lưu"}</h1><p>Xem lại bài viết, video, liên kết và tài liệu quan trọng.</p></div>
        <Button variant="secondary" icon="plus" onClick={() => setCreating(true)}>Bộ sưu tập mới</Button>
      </header>
      <div className="saved-layout">
        <aside className="collections panel">
          <h3>Bộ sưu tập</h3>
          <button className={!collection ? "active" : ""} onClick={() => setCollection("")}><Icon name="bookmark" />Tất cả mục đã lưu<span>{total}</span></button>
          {collections.map((c) => (
            <div key={c.collectionId} className="collection-row sv-menu-wrap">
              <button className={String(collection) === String(c.collectionId) ? "active" : ""} onClick={() => setCollection(c.collectionId)}>
                <Icon name="file" /><em>{c.name}</em><span>{c.itemCount}</span>
              </button>
              <button className="collection-more" aria-label="Tùy chọn bộ sưu tập" onClick={() => setMenu(menu === `c${c.collectionId}` ? null : `c${c.collectionId}`)}><Icon name="more" size={16} /></button>
              {menu === `c${c.collectionId}` && (
                <div className="pop-menu collection-menu">
                  <button onClick={() => rename(c)}>Đổi tên</button>
                  <button className="danger" onClick={() => removeCollection(c)}>Xóa bộ sưu tập</button>
                </div>
              )}
            </div>
          ))}
        </aside>
        <main>
          <div className="saved-toolbar">
            <label><Icon name="search" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm trong mục đã lưu" /></label>
            <select className="toolbar-select" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select className="toolbar-select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="NEWEST">Mới lưu gần đây</option><option value="OLDEST">Lưu lâu nhất</option></select>
          </div>
          <div className="saved-list">
            {loading && <Loading />}
            {error && <ErrorBlock message={error} onRetry={load} />}
            {!loading && !error && items.length === 0 && <EmptyState title="Chưa có nội dung đã lưu" copy="Nội dung bạn lưu sẽ xuất hiện tại đây." icon="bookmark" />}
            {!loading && items.map((item, i) => {
              const isLink = item.contentType === "LINK" && item.targetUrl
              const rawTitle = item.title || item.description || "Nội dung đã lưu"
              const title = isLink ? rawTitle.replace(item.targetUrl, "").trim() || hostOf(item.targetUrl) : rawTitle
              return (
                <article key={item.savedItemId}>
                  <button type="button" className={`saved-preview sp${i % 3}`} onClick={() => openItem(item)} aria-label="Mở nội dung" style={item.previewUrl && item.contentType !== "VIDEO" ? { backgroundImage: `url("${mediaUrl(item.previewUrl)}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                    {(!item.previewUrl || item.contentType === "VIDEO") && <Icon name={item.contentType === "VIDEO" ? "video" : isLink ? "globe" : "file"} />}
                  </button>
                  <div>
                    <span>{TYPE_LABEL[item.contentType] || item.contentType} · Đã lưu {timeAgo(item.savedAt)} trước{item.collectionName ? ` · ${item.collectionName}` : ""}</span>
                    <h3>{title}</h3>
                    <p>{isLink ? hostOf(item.targetUrl) : item.authorId ? <button className="author-link" onClick={() => navigate(`/profile/${item.authorId}`)}>{item.authorName}</button> : item.authorName}</p>
                    <div style={{ display: "flex", gap: 14 }}>
                      <button onClick={() => openItem(item)}>{isLink ? "Mở liên kết" : "Mở nội dung"} <Icon name="arrow" size={14} /></button>
                    </div>
                  </div>
                  <div className="sv-menu-wrap" style={{ position: "relative" }}>
                    <button className="icon-button" aria-label="Tùy chọn" onClick={() => setMenu(menu === `i${item.savedItemId}` ? null : `i${item.savedItemId}`)}><Icon name="more" /></button>
                    {menu === `i${item.savedItemId}` && (
                      <div className="pop-menu post-menu">
                        <small className="menu-label">Chuyển vào bộ sưu tập</small>
                        <button className={!item.collectionId ? "on" : ""} onClick={() => changeCollection(item, "")}>Chưa phân loại</button>
                        {collections.map((c) => <button key={c.collectionId} className={item.collectionId === c.collectionId ? "on" : ""} onClick={() => changeCollection(item, c.collectionId)}>{c.name}</button>)}
                        <button className="danger" onClick={() => unsave(item)}>Bỏ lưu</button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
            {hasMore && !loading && <div style={{ textAlign: "center", padding: 12 }}><Button variant="secondary" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Đang tải..." : "Xem thêm"}</Button></div>}
          </div>
        </main>
      </div>
      {creating && (
        <Modal title="Tạo bộ sưu tập" close={() => setCreating(false)}>
          <div className="form-grid"><label className="full">Tên bộ sưu tập<input autoFocus value={nameDraft} maxLength={80} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCollection()} placeholder="Ví dụ: Tài liệu ôn thi" /></label></div>
          <div className="modal-actions"><Button variant="secondary" onClick={() => setCreating(false)}>Hủy</Button><Button disabled={!nameDraft.trim()} onClick={createCollection}>Tạo bộ sưu tập</Button></div>
        </Modal>
      )}
      {activePost && (
        <Modal title="Bài viết đã lưu" close={() => { setActivePost(null); refresh() }} wide>
          <div style={{ padding: 12 }}>
            <PostCard post={activePost} meId={user?.userId} onChange={setActivePost} onRemove={() => { setActivePost(null); refresh() }} onShared={() => {}} />
          </div>
        </Modal>
      )}
    </div>
  )
}
