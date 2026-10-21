import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { savedApi } from '../api/savedApi'
import { videoApi } from '../api/videoApi'
import '../styles/saved.css'

const types = [
  ['ALL', 'Tất cả'],
  ['POST', 'Bài viết'],
  ['VIDEO', 'Video'],
  ['LINK', 'Link'],
]

const typeLabel = (type) => type === 'GROUP_POST' ? 'Bài viết nhóm' : type === 'VIDEO' ? 'Video' : type === 'LINK' ? 'Liên kết' : 'Bài viết'
const savedDate = (value) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export default function SavedPage() {
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [collections, setCollections] = useState([])
  const [selectedType, setSelectedType] = useState('ALL')
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
  const [itemCollectionBusy, setItemCollectionBusy] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadCollections = async () => {
    try {
      const { data } = await savedApi.collections()
      setCollections(data || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải bộ sưu tập.')
    }
  }

  useEffect(() => { loadCollections() }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    savedApi.list({ type: selectedType, q: query, collectionId: collectionId || undefined, sort, page: 0, size: 24 })
      .then(({ data }) => {
        if (!active) return
        setItems(data.content || [])
        if (selectedType === 'ALL' && !collectionId && !query) {
          setTotalCount(data.totalElements ?? data.content?.length ?? 0)
        }
        setHasMore(!data.last)
        setPage(0)
        setError('')
      })
      .catch((err) => { if (active) { setItems([]); setError(err.response?.data?.message || 'Không thể tải nội dung đã lưu.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedType, query, collectionId, sort, retryKey])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { data } = await savedApi.list({ type: selectedType, q: query, collectionId: collectionId || undefined, sort, page: page + 1, size: 24 })
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

  const createCollection = async () => {
    const name = window.prompt('Tên bộ sưu tập mới')
    if (name == null) return
    if (!name.trim()) { announce('Tên bộ sưu tập không được để trống.'); return }
    setCollectionBusy(true)
    try {
      const { data } = await savedApi.createCollection(name.trim())
      setCollections((current) => [...current, data])
      setCollectionId(data.collectionId)
      announce('Đã tạo bộ sưu tập.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể tạo bộ sưu tập.') }
    finally { setCollectionBusy(false) }
  }

  const renameCollection = async (collection) => {
    const name = window.prompt('Tên bộ sưu tập', collection.name)
    if (name == null || name.trim() === collection.name) return
    if (!name.trim()) { announce('Tên bộ sưu tập không được để trống.'); return }
    try {
      const { data } = await savedApi.renameCollection(collection.collectionId, name.trim())
      setCollections((current) => current.map((item) => item.collectionId === data.collectionId ? data : item))
      announce('Đã đổi tên bộ sưu tập.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể đổi tên bộ sưu tập.') }
  }

  const deleteCollection = async (collection) => {
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
    try {
      await savedApi.unsave(item.savedItemId)
      setItems((current) => current.filter((entry) => entry.savedItemId !== item.savedItemId))
      setCollections((current) => current.map((collection) => collection.collectionId === item.collectionId
        ? { ...collection, itemCount: Math.max(0, collection.itemCount - 1) } : collection))
      announce('Đã bỏ lưu nội dung.')
    } catch (err) { announce(err.response?.data?.message || 'Không thể bỏ lưu nội dung.') }
  }

  const changeCollection = async (item, value) => {
    setItemCollectionBusy(item.savedItemId)
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
    finally { setItemCollectionBusy(null) }
  }

  const title = useMemo(() => collections.find((item) => item.collectionId === collectionId)?.name || 'Đã lưu', [collections, collectionId])
  const emptyTitle = query ? 'Không tìm thấy nội dung' : collectionId ? 'Bộ sưu tập này đang trống' : 'Chưa có nội dung đã lưu'
  const emptyDescription = query
    ? 'Thử tìm bằng từ khóa khác.'
    : collectionId
      ? 'Lưu bài viết, video hoặc liên kết vào bộ sưu tập này để xem lại sau.'
      : 'Khi lưu bài viết, video hoặc liên kết, nội dung sẽ xuất hiện ở đây.'

  return (
    <main className="saved-page">
      <div className="saved-content">
        {notice && <div className="saved-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}
        <div className="saved-layout">
          <aside className="saved-sidebar">
            <header className="saved-sidebar-heading">
              <span className="saved-sidebar-mark" aria-hidden="true">▮</span>
              <div><h1>Đã lưu</h1><p>Nơi lưu giữ những nội dung bạn yêu thích</p></div>
            </header>
            <nav aria-label="Bộ lọc nội dung đã lưu">
              {types.map(([type, label]) => <button key={type} type="button" className={!collectionId && selectedType === type ? 'active' : ''} onClick={() => { setCollectionId(null); setSelectedType(type) }}><span>{type === 'ALL' ? '▣' : type === 'VIDEO' ? '▷' : type === 'LINK' ? '↗' : '▧'}</span>{label}{type === 'ALL' && <small>{totalCount}</small>}</button>)}
            </nav>
            <div className="saved-collections-heading"><strong>Bộ sưu tập</strong><button type="button" disabled={collectionBusy} onClick={createCollection} aria-label="Tạo bộ sưu tập" title="Tạo bộ sưu tập">＋</button></div>
            <button type="button" className={`saved-all-collections ${!collectionId ? 'active' : ''}`} onClick={() => { setCollectionId(null); setSelectedType('ALL') }}><span aria-hidden="true">▤</span>Tất cả nội dung đã lưu</button>
            <div className="saved-collection-list">
              {collections.map((collection) => <div className={`saved-collection-row ${collectionId === collection.collectionId ? 'active' : ''}`} key={collection.collectionId}>
                <button type="button" className="saved-collection-select" onClick={() => { setCollectionId(collection.collectionId); setSelectedType('ALL') }}><span>▤</span><span>{collection.name}</span><small>{collection.itemCount}</small></button>
                <details><summary aria-label={`Tùy chọn ${collection.name}`}>•••</summary><div><button type="button" onClick={() => renameCollection(collection)}>Đổi tên</button><button type="button" onClick={() => deleteCollection(collection)}>Xóa bộ sưu tập</button></div></details>
              </div>)}
            </div>
            <section className="saved-tip">
              <strong><span aria-hidden="true">♧</span>Mẹo nhỏ</strong>
              <p>Bạn có thể lưu bài viết, video, liên kết để xem lại bất cứ lúc nào!</p>
            </section>
          </aside>
          <section className="saved-main">
            <header className="saved-hero">
              <div className="saved-hero-copy">
                <span className="saved-hero-icon" aria-hidden="true">▮</span>
                <div><span className="saved-eyebrow">KHO LƯU TRỮ CỦA BẠN</span><h2>Bài viết đã lưu</h2><p>Lưu lại những nội dung thú vị để xem sau,<br />không bỏ lỡ điều bạn quan tâm.</p></div>
              </div>
              <div className="saved-hero-art" aria-hidden="true">
                <span className="saved-art-orbit" />
                <span className="saved-art-tile saved-art-image">▧</span>
                <span className="saved-art-tile saved-art-link">↗</span>
                <span className="saved-art-tile saved-art-play">▶</span>
                <span className="saved-art-folder"><i /></span>
                <span className="saved-art-caption">Lưu lại<br />những điều<br />tuyệt vời! ♥</span>
              </div>
            </header>
            <div className="saved-toolbar">
              <div className="saved-type-tabs">{types.map(([type, label]) => <button type="button" key={type} className={selectedType === type ? 'active' : ''} onClick={() => { setCollectionId(null); setSelectedType(type) }}>{label}</button>)}</div>
              <label className="saved-search"><span aria-hidden="true">⌕</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm trong nội dung đã lưu..." aria-label="Tìm kiếm nội dung đã lưu" />{searchInput && <button type="button" onClick={() => setSearchInput('')} aria-label="Xóa tìm kiếm">×</button>}</label>
              <label className="saved-sort"><span aria-hidden="true">◷</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp nội dung đã lưu"><option value="NEWEST">Mới lưu nhất</option><option value="OLDEST">Cũ nhất</option></select></label>
            </div>
            {error && <ErrorState title="Có lỗi xảy ra" message={error} onRetry={() => { setError(''); loadCollections(); setRetryKey((current) => current + 1) }} />}
            {loading && <LoadingState variant="skeleton" lines={4} skeletonHeight={96} label="Đang tải nội dung đã lưu..." />}
            {!loading && !error && items.length === 0 && <div className="saved-empty-panel">
              <div className="saved-empty-art" aria-hidden="true"><span className="saved-empty-orbit" /><span className="saved-empty-folder"><i /></span><span className="saved-empty-tile">▧</span><span className="saved-empty-play">▶</span><span className="saved-empty-spark">✦</span></div>
              <EmptyState title={emptyTitle} description={emptyDescription} action={!query && <Link className="saved-empty-action" to={selectedType === 'VIDEO' ? '/video' : '/feed'}><span aria-hidden="true">▮</span>Khám phá ngay</Link>} />
            </div>}
            {!loading && !error && items.length > 0 && <div className="saved-list">{items.map((item) => <article className="saved-card" key={item.savedItemId}>
              <div className="saved-card-head"><Avatar src={item.authorAvatar} name={item.authorName} size={40} /><div className="saved-author"><strong>{item.authorName || 'Nội dung đã lưu'}</strong><span>Đã lưu {savedDate(item.savedAt)} · {typeLabel(item.contentType)}</span></div><button type="button" className="saved-unsave" onClick={() => unsave(item)}>Bỏ lưu</button></div>
              <div className="saved-card-body">
                <p className="saved-card-title">{item.title || item.description}</p>
                {item.previewUrl && (item.contentType === 'VIDEO'
                  ? <div className="saved-video-preview">▷ <span>Video đã lưu</span></div>
                  : <img className="saved-preview-image" src={videoApi.resolveMediaUrl(item.previewUrl)} alt={item.title || 'Nội dung đã lưu'} loading="lazy" />)}
                {item.targetUrl && <a className="saved-target-url" href={item.targetUrl} target="_blank" rel="noreferrer">{item.targetUrl}</a>}
                <footer className="saved-card-footer">
                  {item.sourcePath && <Link className="saved-open-link" to={item.sourcePath}>Mở nội dung →</Link>}
                  <label>Bộ sưu tập<select aria-label="Chuyển bộ sưu tập" value={item.collectionId || ''} disabled={itemCollectionBusy === item.savedItemId} onChange={(event) => changeCollection(item, event.target.value)}><option value="">Chưa phân loại</option>{collections.map((collection) => <option key={collection.collectionId} value={collection.collectionId}>{collection.name}</option>)}</select></label>
                </footer>
              </div>
            </article>)}</div>}
            {hasMore && !loading && <button type="button" className="saved-load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Đang tải...' : 'Xem thêm'}</button>}
          </section>
        </div>
      </div>
    </main>
  )
}
