import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { savedApi } from '../api/savedApi'
import { feedApi } from '../api/feedApi'
import { videoApi } from '../api/videoApi'
import { BookmarkIcon, ClockIcon, CommentIcon, ExternalLinkIcon, FileIcon, FolderIcon, GlobeIcon, ImageIcon, LinkIcon, MoreVerticalIcon, PlayIcon, SearchIcon, ShareIcon, ThumbUpIcon } from '../components/Icons'
import '../styles/saved.css'
import '../styles/saved-redesign.css'

const typeLabel = (type) => type === 'GROUP_POST' ? 'Bài viết nhóm' : type === 'VIDEO' ? 'Video' : type === 'LINK' ? 'Link' : 'Bài viết'

const timeAgo = (value) => {
  if (!value) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'vừa xong'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`
  return `${Math.floor(days / 365)} năm trước`
}

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url || '' }
}

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const total = Math.round(seconds)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function Thumb({ item, href, onOpen }) {
  const [duration, setDuration] = useState('')
  const [failed, setFailed] = useState(false)
  const src = item.previewUrl && !failed ? videoApi.resolveMediaUrl(item.previewUrl) : ''
  const isVideo = item.contentType === 'VIDEO'
  const content = <>
    {src && isVideo && <video src={`${src}#t=0.5`} preload="metadata" muted playsInline tabIndex={-1}
      onLoadedMetadata={(event) => setDuration(formatDuration(event.currentTarget.duration))} onError={() => setFailed(true)} />}
    {src && !isVideo && <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
    {!src && <span className="sv-thumb-fallback" aria-hidden="true">{item.contentType === 'LINK' ? hostOf(item.targetUrl).slice(0, 1).toUpperCase() || <ExternalLinkIcon size="1em" /> : isVideo ? <PlayIcon size="1em" /> : <ImageIcon size="1em" />}</span>}
    <span className="sv-badge">{typeLabel(item.contentType)}</span>
    {isVideo && <span className="sv-play" aria-hidden="true"><PlayIcon size="1em" /></span>}
    {isVideo && duration && <span className="sv-duration">{duration}</span>}
  </>
  if (item.contentType === 'LINK' && item.targetUrl) {
    return <a className="sv-thumb" href={item.targetUrl} target="_blank" rel="noreferrer" aria-label="Mở liên kết">{content}</a>
  }
  if (item.contentType === 'POST' || item.contentType === 'VIDEO') {
    return <button className="sv-thumb sv-thumb-button" type="button" onClick={() => onOpen(item)} aria-label="Mở bài viết đã lưu">{content}</button>
  }
  return <Link className="sv-thumb" to={href} aria-label="Mở nội dung">{content}</Link>
}

export default function SavedPage() {
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [collections, setCollections] = useState([])
  const [collectionId, setCollectionId] = useState(null)
  const [sort, setSort] = useState('NEWEST')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [collectionBusy, setCollectionBusy] = useState(false)
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [collectionNameDraft, setCollectionNameDraft] = useState('')
  const [itemBusy, setItemBusy] = useState(null)
  const [menu, setMenu] = useState(null)
  const [activePost, setActivePost] = useState(null)
  const [openingSavedId, setOpeningSavedId] = useState(null)
  const [viewerComment, setViewerComment] = useState('')
  const [shareTarget, setShareTarget] = useState(null)
  const [shareCaption, setShareCaption] = useState('')
  const [shareError, setShareError] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!activePost) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape') setActivePost(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [activePost])

  useEffect(() => {
    if (!collectionDialogOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !collectionBusy) setCollectionDialogOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [collectionDialogOpen, collectionBusy])

  const openSavedPost = async (item) => {
    if (openingSavedId) return
    setOpeningSavedId(item.savedItemId)
    const fallbackPost = {
      postId: item.contentId,
      authorId: item.authorId,
      authorName: item.authorName,
      authorAvatar: item.authorAvatar,
      content: item.title || item.description || '',
      imageUrl: item.previewUrl,
      mediaType: item.contentType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
      privacy: 'PUBLIC',
      comments: [],
      likeCount: 0,
      likedByViewer: false,
      savedByViewer: true,
    }
    setActivePost(fallbackPost)
    setViewerComment('')
    try {
      const { data } = await feedApi.get(item.contentId)
      setActivePost(data)
    } catch { /* Nội dung preview đã lưu vẫn mở được khi không tải được chi tiết bài đăng. */ }
    finally { setOpeningSavedId(null) }
  }

  const reactToSavedPost = async () => {
    if (!activePost) return
    try {
      const { data } = await feedApi.react(activePost.postId, 'LIKE')
      setActivePost(data)
    } catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật lượt thích.') }
  }

  const commentOnSavedPost = async (event) => {
    event.preventDefault()
    const content = viewerComment.trim()
    if (!activePost || !content) return
    try {
      const { data } = await feedApi.comment(activePost.postId, content)
      setActivePost(data)
      setViewerComment('')
    } catch (err) { announce(err.response?.data?.message || 'Không thể gửi bình luận.') }
  }

  const toggleSavedFromViewer = async () => {
    if (!activePost) return
    const contentType = activePost.mediaType === 'VIDEO' ? 'VIDEO'
      : /https?:\/\/[^\s<>()]+/i.test(activePost.content || '') ? 'LINK' : 'POST'
    try {
      const { data } = await savedApi.toggle(contentType, activePost.postId)
      setActivePost((current) => current ? { ...current, savedByViewer: data.saved } : current)
      if (!data.saved) {
        setItems((current) => current.filter((item) => !(item.contentType === contentType && String(item.contentId) === String(activePost.postId))))
        setTotalCount((current) => Math.max(0, current - 1))
        announce('Đã bỏ lưu nội dung.')
      } else announce('Đã lưu nội dung.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật nội dung đã lưu.') }
  }

  const submitShare = async (event) => {
    event.preventDefault()
    if (!shareTarget || sharing) return
    setSharing(true)
    setShareError('')
    try {
      await feedApi.share(shareTarget.postId, shareCaption)
      setShareTarget(null)
      setShareCaption('')
      announce('Đã chia sẻ bài viết lên trang chủ.')
    } catch (err) { setShareError(err.response?.data?.message || 'Không thể chia sẻ bài viết.') }
    finally { setSharing(false) }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!menu) return undefined
    const close = (event) => { if (!event.target.closest?.('.sv-menu-wrap')) setMenu(null) }
    const onKey = (event) => { if (event.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey) }
  }, [menu])

  const loadCollections = async () => {
    try {
      const { data } = await savedApi.collections()
      setCollections(data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải bộ sưu tập.')
    }
  }

  const loadTotal = async () => {
    try {
      const { data } = await savedApi.list({ type: 'ALL', page: 0, size: 1 })
      setTotalCount(data.totalElements ?? 0)
    } catch { /* tổng số chỉ là thông tin phụ */ }
  }

  useEffect(() => { loadCollections(); loadTotal() }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    savedApi.list({ type: 'ALL', q: query, collectionId: collectionId || undefined, sort, page: 0, size: 24 })
      .then(({ data }) => {
        if (!active) return
        setItems(data.content || [])
        if (!collectionId && !query) setTotalCount(data.totalElements ?? data.content?.length ?? 0)
        setHasMore(!data.last)
        setPage(0)
        setError('')
      })
      .catch((err) => { if (active) { setItems([]); setError(err.response?.data?.message || 'Không thể tải nội dung đã lưu.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, collectionId, sort, retryKey])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { data } = await savedApi.list({ type: 'ALL', q: query, collectionId: collectionId || undefined, sort, page: page + 1, size: 24 })
      setItems((current) => [...current, ...(data.content || [])])
      setPage((current) => current + 1)
      setHasMore(!data.last)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải thêm nội dung.')
    } finally { setLoadingMore(false) }
  }

  const announce = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const createCollection = async (event) => {
    event.preventDefault()
    const name = collectionNameDraft.trim()
    if (!name || collectionBusy) return
    setCollectionBusy(true)
    try {
      const { data } = await savedApi.createCollection(name)
      setCollections((current) => [...current, data])
      setCollectionId(data.collectionId)
      setCollectionDialogOpen(false)
      setCollectionNameDraft('')
      announce('Đã tạo bộ sưu tập.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể tạo bộ sưu tập.') }
    finally { setCollectionBusy(false) }
  }

  const renameCollection = async (collection) => {
    setMenu(null)
    const name = window.prompt('Tên bộ sưu tập', collection.name)
    if (name == null || name.trim() === collection.name) return
    if (!name.trim()) { announce('Tên bộ sưu tập không được để trống.'); return }
    try {
      const { data } = await savedApi.renameCollection(collection.collectionId, name.trim())
      setCollections((current) => current.map((item) => item.collectionId === data.collectionId ? data : item))
      setItems((current) => current.map((item) => item.collectionId === data.collectionId ? { ...item, collectionName: data.name } : item))
      announce('Đã đổi tên bộ sưu tập.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể đổi tên bộ sưu tập.') }
  }

  const deleteCollection = async (collection) => {
    setMenu(null)
    if (!window.confirm(`Xóa bộ sưu tập “${collection.name}”? Nội dung đã lưu vẫn được giữ.`)) return
    try {
      await savedApi.deleteCollection(collection.collectionId)
      setCollections((current) => current.filter((item) => item.collectionId !== collection.collectionId))
      if (collectionId === collection.collectionId) setCollectionId(null)
      setItems((current) => current.map((item) => item.collectionId === collection.collectionId
        ? { ...item, collectionId: null, collectionName: null } : item))
      announce('Đã xóa bộ sưu tập.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể xóa bộ sưu tập.') }
  }

  const unsave = async (item) => {
    setMenu(null)
    try {
      await savedApi.unsave(item.savedItemId)
      setItems((current) => current.filter((entry) => entry.savedItemId !== item.savedItemId))
      setTotalCount((current) => Math.max(0, current - 1))
      setCollections((current) => current.map((collection) => collection.collectionId === item.collectionId
        ? { ...collection, itemCount: Math.max(0, collection.itemCount - 1) } : collection))
      announce('Đã bỏ lưu nội dung.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể bỏ lưu nội dung.') }
  }

  const changeCollection = async (item, value) => {
    setMenu(null)
    setItemBusy(item.savedItemId)
    try {
      if (value) await savedApi.addToCollection(item.savedItemId, Number(value))
      else await savedApi.removeFromCollection(item.savedItemId)
      const collection = collections.find((entry) => entry.collectionId === Number(value))
      setItems((current) => {
        if (collectionId && Number(value) !== collectionId) return current.filter((entry) => entry.savedItemId !== item.savedItemId)
        return current.map((entry) => entry.savedItemId === item.savedItemId
          ? { ...entry, collectionId: collection?.collectionId || null, collectionName: collection?.name || null } : entry)
      })
      await loadCollections()
      announce(value ? 'Đã chuyển nội dung vào bộ sưu tập.' : 'Đã bỏ nội dung khỏi bộ sưu tập.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể cập nhật bộ sưu tập.') }
    finally { setItemBusy(null) }
  }

  const activeCollection = useMemo(() => collections.find((item) => item.collectionId === collectionId), [collections, collectionId])
  const viewerMedia = activePost?.sharedPost?.imageUrl ? activePost.sharedPost : activePost
  const heroTitle = activeCollection?.name || 'Tất cả nội dung đã lưu'
  const emptyTitle = query ? 'Không tìm thấy nội dung' : collectionId ? 'Bộ sưu tập này đang trống' : 'Chưa có nội dung đã lưu'
  const emptyDescription = query
    ? 'Thử tìm bằng từ khóa khác.'
    : collectionId
      ? 'Lưu bài viết, video hoặc liên kết vào bộ sưu tập này để xem lại sau.'
      : 'Khi lưu bài viết, video hoặc liên kết, nội dung sẽ xuất hiện ở đây.'

  return (
    <main className="saved-page sv-page">
      <div className="saved-content sv-content">
        {notice && <div className="saved-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}
        <div className="sv-layout">
          <aside className="sv-sidebar">
            <header className="sv-side-head">
              <span className="sv-side-mark" aria-hidden="true"><BookmarkIcon size="1em" /></span>
              <div><h1>Đã lưu</h1><p>Nội dung bạn đã lưu để xem lại sau</p></div>
            </header>
            <button type="button" className={`sv-side-all ${!collectionId ? 'active' : ''}`} onClick={() => setCollectionId(null)}>
              <span aria-hidden="true"><BookmarkIcon size="1em" /></span>Tất cả<small>{totalCount}</small>
            </button>
            <div className="sv-side-divider" />
            <div className="sv-collections-head"><strong>Bộ sưu tập</strong><button type="button" disabled={collectionBusy} onClick={() => { setCollectionNameDraft(''); setCollectionDialogOpen(true) }} aria-label="Tạo bộ sưu tập" title="Tạo bộ sưu tập">＋</button></div>
            <div className="sv-collection-list">
              <div className={`sv-collection-row ${!collectionId ? 'active' : ''}`}>
                <button type="button" className="sv-collection-select" onClick={() => setCollectionId(null)}><span className="sv-folder" aria-hidden="true"><FolderIcon size="1em" /></span><span className="sv-collection-name">Tất cả nội dung đã lưu</span><small>{totalCount}</small></button>
              </div>
              {collections.map((collection) => <div className={`sv-collection-row ${collectionId === collection.collectionId ? 'active' : ''}`} key={collection.collectionId}>
                <button type="button" className="sv-collection-select" onClick={() => setCollectionId(collection.collectionId)}><span className="sv-folder" aria-hidden="true"><FolderIcon size="1em" /></span><span className="sv-collection-name">{collection.name}</span><small>{collection.itemCount}</small></button>
                <div className="sv-menu-wrap">
                  <button type="button" className="sv-kebab" aria-label={`Tùy chọn ${collection.name}`} aria-expanded={menu === `c${collection.collectionId}`} onClick={() => setMenu(menu === `c${collection.collectionId}` ? null : `c${collection.collectionId}`)}><MoreVerticalIcon size={18} /></button>
                  {menu === `c${collection.collectionId}` && <div className="sv-menu" role="menu"><button type="button" role="menuitem" onClick={() => renameCollection(collection)}>Đổi tên</button><button type="button" role="menuitem" onClick={() => deleteCollection(collection)}>Xóa bộ sưu tập</button></div>}
                </div>
              </div>)}
            </div>
          </aside>
          <section className="sv-main">
            <header className="sv-hero">
              <span className="sv-hero-icon" aria-hidden="true"><BookmarkIcon size="1em" /></span>
              <div className="sv-hero-copy"><span className="sv-eyebrow">CMC TALK · ĐÃ LƯU</span><h2>{heroTitle}</h2><p>Xem lại những nội dung bạn đã lưu, bao gồm bài viết, video, liên kết và các nội dung khác. Dễ dàng tìm kiếm và sắp xếp theo nhu cầu của bạn.</p></div>
              <div className="sv-hero-art" aria-hidden="true">
                <span className="sv-art-folder"><i /></span>
                <span className="sv-art-tile sv-art-doc"><FileIcon size="1em" /></span>
                <span className="sv-art-tile sv-art-play"><PlayIcon size="1em" /></span>
                <span className="sv-art-tile sv-art-link"><LinkIcon size="1em" /></span>
              </div>
            </header>
            <div className="sv-toolbar">
              <button type="button" className="sv-all-chip" onClick={() => { setCollectionId(null) }}>Tất cả</button>
              <label className="sv-search"><span aria-hidden="true"><SearchIcon size={18} /></span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm kiếm trong mục đã lưu..." aria-label="Tìm kiếm nội dung đã lưu" />{searchInput && <button type="button" onClick={() => setSearchInput('')} aria-label="Xóa tìm kiếm">×</button>}</label>
              <label className="sv-sort"><span aria-hidden="true"><ClockIcon size={17} /></span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp nội dung đã lưu"><option value="NEWEST">Mới lưu nhất</option><option value="OLDEST">Cũ nhất</option></select></label>
            </div>
            {error && <ErrorState title="Có lỗi xảy ra" message={error} onRetry={() => { setError(''); loadCollections(); setRetryKey((current) => current + 1) }} />}
            {loading && <LoadingState variant="skeleton" lines={4} skeletonHeight={130} label="Đang tải nội dung đã lưu..." />}
            {!loading && !error && items.length === 0 && <div className="sv-empty">
              <EmptyState title={emptyTitle} description={emptyDescription} action={!query && <Link className="sv-empty-action" to="/feed">Khám phá ngay</Link>} />
            </div>}
            {!loading && !error && items.length > 0 && <div className="sv-grid">{items.map((item) => {
              const href = item.sourcePath || '/feed'
              const isLink = item.contentType === 'LINK' && item.targetUrl
              const rawTitle = item.title || item.description || 'Nội dung đã lưu'
              const title = isLink ? (rawTitle.replace(item.targetUrl, '').trim() || hostOf(item.targetUrl)) : rawTitle
              return <article className="sv-card" key={item.savedItemId}>
                <Thumb item={item} href={href} onOpen={openSavedPost} />
                <div className="sv-info">
                  {item.contentType !== 'VIDEO' && item.contentType !== 'LINK' && <span className="sv-kind"><FileIcon size="1em" /> {typeLabel(item.contentType)}</span>}
                  <h3 className="sv-title" title={title}>{title}</h3>
                  <div className="sv-source">
                    {isLink ? <span className="sv-globe" aria-hidden="true"><GlobeIcon size="1em" /></span> : item.authorId ? <Link className="sv-author-link" to={`/feed/profile/${item.authorId}`} aria-label={`Xem trang cá nhân ${item.authorName || 'người đăng'}`}><Avatar src={item.authorAvatar} name={item.authorName} size={22} /></Link> : <Avatar src={item.authorAvatar} name={item.authorName} size={22} />}
                    {isLink ? <span>{hostOf(item.targetUrl)}</span> : item.authorId ? <Link className="sv-author-link" to={`/feed/profile/${item.authorId}`}>{item.authorName || 'Nội dung đã lưu'}</Link> : <span>{item.authorName || 'Nội dung đã lưu'}</span>}
                  </div>
                  <div className="sv-meta">
                    <span className="sv-saved-at"><i aria-hidden="true"><BookmarkIcon size="1em" filled /></i>Đã lưu {timeAgo(item.savedAt)}</span>
                    {item.collectionName && <span className="sv-chip" title="Bộ sưu tập">{item.collectionName}</span>}
                    <span className="sv-actions">
                      {isLink
                        ? <a className="sv-icon-btn" href={item.targetUrl} target="_blank" rel="noreferrer" aria-label="Mở liên kết" title="Mở liên kết"><ExternalLinkIcon size={17} /></a>
                        : item.contentType === 'POST' || item.contentType === 'VIDEO'
                          ? <button type="button" className="sv-icon-btn" onClick={() => openSavedPost(item)} aria-label="Mở nội dung đã lưu" title="Mở nội dung đã lưu" disabled={openingSavedId === item.savedItemId}><ExternalLinkIcon size={17} /></button>
                          : <Link className="sv-icon-btn" to={href} aria-label="Mở nội dung" title="Mở nội dung"><ExternalLinkIcon size={17} /></Link>}
                      <span className="sv-menu-wrap">
                        <button type="button" className="sv-icon-btn" aria-label="Tùy chọn" aria-expanded={menu === `i${item.savedItemId}`} disabled={itemBusy === item.savedItemId} onClick={() => setMenu(menu === `i${item.savedItemId}` ? null : `i${item.savedItemId}`)}><MoreVerticalIcon size={18} /></button>
                        {menu === `i${item.savedItemId}` && <div className="sv-menu sv-menu-item" role="menu">
                          <span className="sv-menu-label">Chuyển vào bộ sưu tập</span>
                          <button type="button" role="menuitem" className={!item.collectionId ? 'on' : ''} onClick={() => changeCollection(item, '')}>Chưa phân loại</button>
                          {collections.map((collection) => <button type="button" role="menuitem" key={collection.collectionId} className={item.collectionId === collection.collectionId ? 'on' : ''} onClick={() => changeCollection(item, collection.collectionId)}>{collection.name}</button>)}
                          <button type="button" role="menuitem" className="danger" onClick={() => unsave(item)}>Bỏ lưu</button>
                        </div>}
                      </span>
                    </span>
                  </div>
                </div>
              </article>
            })}</div>}
            {hasMore && !loading && <button type="button" className="sv-load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Đang tải...' : 'Xem thêm'}</button>}
          </section>
        </div>
      </div>
      {activePost && createPortal(
        <div className="post-image-backdrop" role="dialog" aria-modal="true" aria-label="Bài viết đã lưu" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivePost(null) }}>
          <button className="post-image-viewer-close" type="button" onClick={() => setActivePost(null)} aria-label="Đóng bài viết">×</button>
          <div className="post-media-viewer-stage">
            {viewerMedia?.mediaType === 'VIDEO'
              ? <video className="post-image-viewer" src={videoApi.resolveMediaUrl(viewerMedia.imageUrl)} controls autoPlay playsInline />
              : viewerMedia?.imageUrl && <img className="post-image-viewer" src={viewerMedia.imageUrl} alt={viewerMedia.content || activePost.content || 'Ảnh trong bài viết'} />}
          </div>
          <aside className="post-media-viewer-details">
            <header className="post-media-viewer-author">
              <Link to={`/feed/profile/${activePost.authorId}`} onClick={() => setActivePost(null)}><Avatar src={activePost.authorAvatar} name={activePost.authorName} size={42} /></Link>
              <div><Link to={`/feed/profile/${activePost.authorId}`} onClick={() => setActivePost(null)}><strong>{activePost.authorName || 'Người dùng'}</strong></Link><small>{activePost.createdAt ? new Date(activePost.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''} · {activePost.privacy === 'FRIENDS' ? 'Bạn bè' : 'Công khai'}</small></div>
            </header>
            {activePost.content && <p className="post-media-viewer-caption">{activePost.content}</p>}
            <div className="post-media-viewer-stats">👍 {activePost.likeCount || 0} lượt thích <span>{activePost.comments?.length || 0} bình luận</span></div>
            <div className="post-media-viewer-actions">
              <button type="button" className={activePost.likedByViewer ? 'saved-action-active' : ''} onClick={reactToSavedPost}><ThumbUpIcon size={17} /> {activePost.likedByViewer ? 'Đã thích' : 'Thích'}</button>
              <button type="button" onClick={() => document.getElementById('saved-post-viewer-comment')?.focus()}><CommentIcon size={17} /> Bình luận</button>
              <button type="button" onClick={() => { setShareTarget(activePost); setShareCaption(''); setShareError(''); setActivePost(null) }}><ShareIcon size={17} /> Chia sẻ</button>
              <button type="button" className={activePost.savedByViewer ? 'saved-action-active' : ''} onClick={toggleSavedFromViewer}><BookmarkIcon size={17} filled={!!activePost.savedByViewer} /> {activePost.savedByViewer ? 'Đã lưu' : 'Lưu'}</button>
            </div>
            <div className="post-media-viewer-comments">
              {(activePost.comments || []).map((comment) => <div className="post-media-viewer-comment" key={comment.commentId}>
                <Avatar src={comment.authorAvatar} name={comment.authorName} size={32} />
                <div><strong>{comment.authorName}</strong><p>{comment.content}</p></div>
              </div>)}
              {!activePost.comments?.length && <p className="post-media-viewer-empty">Chưa có bình luận nào.</p>}
            </div>
            <form className="post-media-viewer-compose" onSubmit={commentOnSavedPost}>
              <input id="saved-post-viewer-comment" value={viewerComment} onChange={(event) => setViewerComment(event.target.value)} placeholder="Viết bình luận..." maxLength={1000} />
              <button type="submit" disabled={!viewerComment.trim()}>Gửi</button>
            </form>
          </aside>
        </div>,
        document.body,
      )}
      {shareTarget && <div className="share-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !sharing) { setShareTarget(null); setShareError('') } }}>
        <form className="share-dialog" onSubmit={submitShare}>
          <header className="share-dialog-header"><h2>Chia sẻ bài viết</h2><button type="button" onClick={() => { setShareTarget(null); setShareError('') }} disabled={sharing} aria-label="Đóng">×</button></header>
          <textarea className="share-caption-input" value={shareCaption} onChange={(event) => setShareCaption(event.target.value)} placeholder="Viết điều gì đó về bài viết này..." maxLength={10000} rows={3} />
          <div className="share-source-preview">
            <div className="shared-post-heading"><Avatar src={shareTarget.authorAvatar} name={shareTarget.authorName} size={32} /><div><strong>{shareTarget.authorName}</strong><small>{shareTarget.createdAt ? new Date(shareTarget.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''}</small></div></div>
            {shareTarget.content && <p>{shareTarget.content}</p>}
            {shareTarget.imageUrl && (shareTarget.mediaType === 'VIDEO'
              ? <video className="shared-post-media" src={videoApi.resolveMediaUrl(shareTarget.imageUrl)} controls playsInline preload="metadata" />
              : <img className="shared-post-media" src={shareTarget.imageUrl} alt="Nội dung bài viết" />)}
          </div>
          {shareError && <div className="share-dialog-error">{shareError}</div>}
          <button className="share-submit-button" type="submit" disabled={sharing}>{sharing ? 'Đang chia sẻ...' : 'Chia sẻ ngay'}</button>
        </form>
      </div>}
      {collectionDialogOpen && <div className="sv-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !collectionBusy) setCollectionDialogOpen(false) }}>
        <form className="sv-dialog" role="dialog" aria-modal="true" aria-labelledby="sv-create-collection-title" onSubmit={createCollection}>
          <header className="sv-dialog-header">
            <h2 id="sv-create-collection-title">Tạo bộ sưu tập</h2>
            <button type="button" onClick={() => setCollectionDialogOpen(false)} disabled={collectionBusy} aria-label="Đóng">×</button>
          </header>
          <label htmlFor="sv-collection-name">Tên bộ sưu tập</label>
          <input id="sv-collection-name" autoFocus value={collectionNameDraft} onChange={(event) => setCollectionNameDraft(event.target.value)} maxLength={80} placeholder="Ví dụ: Bài viết hay" />
          <div className="sv-dialog-footer">
            <button type="button" className="sv-dialog-cancel" onClick={() => setCollectionDialogOpen(false)} disabled={collectionBusy}>Hủy</button>
            <button type="submit" className="sv-dialog-submit" disabled={collectionBusy || !collectionNameDraft.trim()}>{collectionBusy ? 'Đang tạo...' : 'Tạo'}</button>
          </div>
        </form>
      </div>}
    </main>
  )
}
