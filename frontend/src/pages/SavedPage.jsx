import React, { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useToast } from "../components/ui"
import { PostCard } from "../components/Posts"
import { savedApi } from "../api/savedApi"
import { feedApi } from "../api/feedApi"
import { videoApi } from "../api/videoApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { mediaUrl, timeAgo } from "../utils/format"
import GroupDetail from "./GroupDetail"

const TYPES = [["ALL", "Tất cả"], ["POST", "Bài viết"], ["VIDEO", "Video"], ["GROUP_POST", "Bài trong nhóm"], ["LINK", "Liên kết"]]
const TYPE_LABEL = { POST: "Bài viết", VIDEO: "Video", GROUP_POST: "Bài viết nhóm", LINK: "Liên kết" }
const PAGE_SIZE = 24
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url } }

function SavedItemTitle({ title }) {
  const titleRef = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)

  useEffect(() => {
    const element = titleRef.current
    if (!element) return undefined
    setCanExpand(false)
    const measure = () => setCanExpand((current) => current || element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [title])

  return <>
    <h3 ref={titleRef} className={`saved-item-title${expanded ? "" : " clamped"}`}>{title}</h3>
    {canExpand && <button type="button" className="saved-item-title-toggle" onClick={() => setExpanded((value) => !value)}>{expanded ? "Ẩn bớt" : "Xem thêm"}</button>}
  </>
}

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
  const [collectionToDelete, setCollectionToDelete] = useState(null)
  const [deletingCollection, setDeletingCollection] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [activePost, setActivePost] = useState(null)
  const [activeGroupPost, setActiveGroupPost] = useState(null)
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
    const run = async () => {
      try {
        const response = await savedApi.list(params(0))
        const pageItems = response.data?.content || []
        let list = pageItems
        if (query) {
          const normalizedQuery = query.toLocaleLowerCase("vi-VN")
          const authorMatches = []
          let authorPage = 0
          let authorHasMore = true
          while (authorHasMore) {
            const authorResponse = await savedApi.list({ ...params(authorPage), q: undefined })
            const authorData = authorResponse.data
            const authorPageItems = authorData?.content || []
            authorMatches.push(...authorPageItems.filter((item) => item.authorName?.toLocaleLowerCase("vi-VN").includes(normalizedQuery)))
            authorHasMore = authorData ? !(authorData.last ?? authorPageItems.length < PAGE_SIZE) : false
            authorPage += 1
          }
          const merged = new Map([...pageItems, ...authorMatches].map((item) => [item.savedItemId, item]))
          list = [...merged.values()].sort((a, b) => {
            const dateOrder = new Date(a.savedAt) - new Date(b.savedAt)
            return (sort === "OLDEST" ? dateOrder : -dateOrder) || (sort === "OLDEST" ? a.savedItemId - b.savedItemId : b.savedItemId - a.savedItemId)
          })
        }
        setItems(list)
        setPage(0)
        setHasMore(response.data ? !(response.data.last ?? pageItems.length < PAGE_SIZE) : false)
      } catch (e) { setError(getApiErrorMessage(e, "Không tải được nội dung đã lưu.")) }
      finally { setLoading(false) }
    }
    run()
  }, [params, query, sort])
  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const r = await savedApi.list(params(page + 1))
      const list = r.data?.content || []
      setItems((current) => {
        const merged = new Map([...current, ...list].map((item) => [item.savedItemId, item]))
        return [...merged.values()]
      })
      setPage(page + 1); setHasMore(!(r.data?.last ?? list.length < PAGE_SIZE))
    } catch (e) { toast(getApiErrorMessage(e, "Không tải thêm được."), "error") } finally { setLoadingMore(false) }
  }

  const fail = (e, fb) => toast(getApiErrorMessage(e, fb), "error")
  const refresh = () => { load(); loadCollections(); loadTotal() }

  const createCollection = async () => {
    if (!nameDraft.trim()) return
    try { const { data } = await savedApi.createCollection(nameDraft.trim()); setCreating(false); setNameDraft(""); await loadCollections(); setCollection(data.collectionId); toast("Đã tạo bộ sưu tập.") } catch (e) { fail(e, "Không thể tạo bộ sưu tập.") }
  }
  const removeCollection = async () => {
    if (!collectionToDelete || deletingCollection) return
    setDeletingCollection(true)
    try {
      await savedApi.deleteCollection(collectionToDelete.collectionId)
      if (String(collection) === String(collectionToDelete.collectionId)) setCollection("")
      setCollectionToDelete(null)
      refresh()
    } catch (e) { fail(e, "Không thể xóa bộ sưu tập.") }
    finally { setDeletingCollection(false) }
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
    if (item.contentType === "GROUP_POST") {
      const groupId = item.sourcePath?.match(/^\/groups\/(\d+)/)?.[1]
      if (groupId) return setActiveGroupPost({ groupId, postId: item.contentId })
    }
    if (item.contentType === "POST" || item.contentType === "VIDEO") {
      setActivePost({ postId: item.contentId, authorId: item.authorId, authorName: item.authorName, authorAvatar: item.authorAvatar, content: item.title || item.description || "", imageUrl: item.previewUrl, mediaType: item.contentType === "VIDEO" ? "VIDEO" : "IMAGE", privacy: "PUBLIC", comments: [], likeCount: 0, savedByViewer: true })
      try { setActivePost((await feedApi.get(item.contentId)).data) } catch { /* vẫn hiển thị bản xem trước */ }
      return
    }
    navigate(item.sourcePath || "/feed")
  }

  const openSharedPost = async (post) => {
    setActivePost({ ...post, comments: post.comments || [] })
    try {
      const { data } = await feedApi.get(post.postId)
      setActivePost((current) => String(current?.postId) === String(data.postId) ? data : current)
    } catch { /* vẫn hiển thị bản xem trước */ }
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
                  <button className="danger" onClick={() => { setMenu(null); setCollectionToDelete(c) }}>Xóa bộ sưu tập</button>
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
            {!loading && items.map((item) => {
              const isLink = item.contentType === "LINK" && item.targetUrl
              const rawTitle = item.title || item.description || "Nội dung đã lưu"
              const title = isLink ? rawTitle.replace(item.targetUrl, "").trim() || hostOf(item.targetUrl) : rawTitle
              const previewTone = item.contentType === "VIDEO" ? "sp0" : item.contentType === "GROUP_POST" ? "sp1" : item.contentType === "LINK" ? "sp2" : "sp0"
              return (
                <article key={item.savedItemId} className={menu === `i${item.savedItemId}` ? "saved-item-menu-open" : ""}>
                  <button type="button" className={`saved-preview ${previewTone}`} onClick={() => openItem(item)} aria-label="Mở nội dung" style={item.previewUrl && item.contentType !== "VIDEO" ? { backgroundImage: `url("${mediaUrl(item.previewUrl)}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                    {item.contentType === "VIDEO" && item.previewUrl
                      ? <video className="saved-video-preview" src={videoApi.resolveMediaUrl(mediaUrl(item.previewUrl))} muted playsInline preload="metadata" onLoadedData={(event) => { const video = event.currentTarget; if (video.duration > 0) video.currentTime = Math.min(0.1, video.duration / 2) }} />
                      : !item.previewUrl && <Icon name={isLink ? "globe" : item.contentType === "VIDEO" ? "video" : "file"} />}
                  </button>
                  <div>
                    <span>{TYPE_LABEL[item.contentType] || item.contentType} · Đã lưu {timeAgo(item.savedAt)} trước{item.collectionName ? ` · ${item.collectionName}` : ""}</span>
                    <SavedItemTitle title={title} />
                    <p>{isLink ? hostOf(item.targetUrl) : item.authorId ? <button className="author-link" onClick={() => navigate(`/profile/${item.authorId}`)}>{item.authorName}</button> : item.authorName}</p>
                    <div style={{ display: "flex", gap: 14 }}>
                      <button onClick={() => openItem(item)}>{isLink ? "Mở liên kết" : "Mở nội dung"} <Icon name="arrow" size={14} /></button>
                    </div>
                  </div>
                  <div className="sv-menu-wrap" style={{ position: "relative" }}>
                    <button className="icon-button" aria-label="Tùy chọn" onClick={() => setMenu(menu === `i${item.savedItemId}` ? null : `i${item.savedItemId}`)}><Icon name="more" /></button>
                    {menu === `i${item.savedItemId}` && (
                      <div className="pop-menu post-menu saved-item-menu">
                        <small className="menu-label">Chuyển vào bộ sưu tập</small>
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
      {collectionToDelete && (
        <Modal title="Xóa bộ sưu tập" close={() => setCollectionToDelete(null)} className="collection-delete-modal">
          <div className="collection-delete-content">
            <span className="collection-delete-icon"><Icon name="trash" size={20} /></span>
            <div>
              <strong>Bạn có chắc muốn xóa “{collectionToDelete.name}”?</strong>
              <p>Các mục đã lưu trong bộ sưu tập này vẫn được giữ lại.</p>
            </div>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" disabled={deletingCollection} onClick={() => setCollectionToDelete(null)}>Hủy</Button>
            <Button variant="danger" disabled={deletingCollection} onClick={removeCollection}>{deletingCollection ? "Đang xóa..." : "Xóa bộ sưu tập"}</Button>
          </div>
        </Modal>
      )}
      {creating && (
        <Modal title="Tạo bộ sưu tập" close={() => setCreating(false)}>
          <div className="form-grid"><label className="full">Tên bộ sưu tập<input autoFocus value={nameDraft} maxLength={80} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCollection()} placeholder="Ví dụ: Tài liệu ôn thi" /></label></div>
          <div className="modal-actions"><Button variant="secondary" onClick={() => setCreating(false)}>Hủy</Button><Button disabled={!nameDraft.trim()} onClick={createCollection}>Tạo bộ sưu tập</Button></div>
        </Modal>
      )}
      {activePost && (
        <PostCard
          key={activePost.postId}
          post={activePost}
          meId={user?.userId}
          onChange={setActivePost}
          onRemove={() => { setActivePost(null); refresh() }}
          onShared={() => {}}
          openCommentsOnMount
          hideCard
          onCloseComments={() => setActivePost(null)}
          onOpenSharedPost={openSharedPost}
        />
      )}
      {activeGroupPost && (
        <div className="saved-group-post-host">
          <GroupDetail
            key={`${activeGroupPost.groupId}-${activeGroupPost.postId}`}
            groupId={activeGroupPost.groupId}
            commentsOnlyPostId={activeGroupPost.postId}
            onCloseComments={() => setActiveGroupPost(null)}
          />
        </div>
      )}
    </div>
  )
}
