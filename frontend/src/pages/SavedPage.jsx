import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { savedApi } from '../api/savedApi'
import { videoApi } from '../api/videoApi'

const types = [
  ['ALL', 'Tất cả'],
  ['POST', 'Bài viết'],
  ['VIDEO', 'Video'],
  ['MARKETPLACE', 'Sản phẩm'],
  ['LINK', 'Link'],
]

const typeLabel = (type) => type === 'MARKETPLACE' ? 'Sản phẩm' : type === 'GROUP_POST' ? 'Bài viết nhóm' : type === 'VIDEO' ? 'Video' : type === 'LINK' ? 'Liên kết' : 'Bài viết'
const savedDate = (value) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export default function SavedPage() {
  const [items, setItems] = useState([])
  const [collections, setCollections] = useState([])
  const [selectedType, setSelectedType] = useState('ALL')
  const [collectionId, setCollectionId] = useState(null)
  const [sort, setSort] = useState('NEWEST')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
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
        setHasMore(!data.last)
        setPage(0)
        setError('')
      })
      .catch((err) => { if (active) { setItems([]); setError(err.response?.data?.message || 'Không thể tải nội dung đã lưu.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedType, query, collectionId, sort])

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

  return (
    <main className="saved-page">
      <header className="saved-topbar">
        <Link to="/saved" className="saved-brand"><span>▣</span> Đã lưu</Link>
        <label className="saved-search"><span>⌕</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm trong nội dung đã lưu..." aria-label="Tìm kiếm nội dung đã lưu" />{searchInput && <button type="button" onClick={() => setSearchInput('')} aria-label="Xóa tìm kiếm">×</button>}</label>
      </header>
      <div className="saved-content">
        {notice && <div className="saved-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}
        <div className="saved-layout">
          <aside className="saved-sidebar">
            <h1>Đã lưu</h1>
            <p>Nội dung bạn muốn xem lại.</p>
            <nav aria-label="Bộ lọc nội dung đã lưu">
              {types.map(([type, label]) => <button key={type} type="button" className={!collectionId && selectedType === type ? 'active' : ''} onClick={() => { setCollectionId(null); setSelectedType(type) }}><span>{type === 'ALL' ? '▣' : type === 'VIDEO' ? '▷' : type === 'MARKETPLACE' ? '▤' : type === 'LINK' ? '↗' : '▧'}</span>{label}</button>)}
            </nav>
            <div className="saved-collections-heading"><strong>Bộ sưu tập</strong><button type="button" disabled={collectionBusy} onClick={createCollection} aria-label="Tạo bộ sưu tập" title="Tạo bộ sưu tập">＋</button></div>
            <button type="button" className={`saved-all-collections ${!collectionId ? 'active' : ''}`} onClick={() => setCollectionId(null)}>Tất cả nội dung đã lưu</button>
            <div className="saved-collection-list">
              {collections.map((collection) => <div className={`saved-collection-row ${collectionId === collection.collectionId ? 'active' : ''}`} key={collection.collectionId}>
                <button type="button" className="saved-collection-select" onClick={() => { setCollectionId(collection.collectionId); setSelectedType('ALL') }}><span>▤</span><span>{collection.name}</span><small>{collection.itemCount}</small></button>
                <details><summary aria-label={`Tùy chọn ${collection.name}`}>•••</summary><div><button type="button" onClick={() => renameCollection(collection)}>Đổi tên</button><button type="button" onClick={() => deleteCollection(collection)}>Xóa bộ sưu tập</button></div></details>
              </div>)}
            </div>
          </aside>
          <section className="saved-main">
            <header className="saved-heading"><div><span className="saved-eyebrow">KHO LƯU TRỮ CỦA BẠN</span><h2>{title}</h2><p>Lưu lại bài viết, video, sản phẩm và liên kết để xem sau.</p></div>
              <label>Sắp xếp<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="NEWEST">Mới lưu nhất</option><option value="OLDEST">Cũ nhất</option></select></label>
            </header>
            <div className="saved-type-tabs">{types.map(([type, label]) => <button type="button" key={type} className={selectedType === type ? 'active' : ''} onClick={() => setSelectedType(type)}>{label}</button>)}</div>
            {error && <div className="saved-state saved-error"><strong>Có lỗi xảy ra</strong><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Tải lại</button></div>}
            {loading && <div className="saved-list">{Array.from({ length: 4 }, (_, index) => <div className="saved-skeleton" key={index} />)}</div>}
            {!loading && !error && items.length === 0 && <div className="saved-state"><span className="saved-empty-icon">▣</span><strong>{query ? 'Không tìm thấy nội dung' : collectionId ? 'Bộ sưu tập này đang trống' : 'Chưa có nội dung đã lưu'}</strong><span>{query ? 'Thử tìm bằng từ khóa khác.' : 'Khi lưu bài viết, video, sản phẩm hoặc link, nội dung sẽ xuất hiện ở đây.'}</span></div>}
            {!loading && !error && items.length > 0 && <div className="saved-list">{items.map((item) => <article className="saved-card" key={item.savedItemId}>
              <div className="saved-card-head"><Avatar src={item.authorAvatar} name={item.authorName} size={40} /><div className="saved-author"><strong>{item.authorName || 'Nội dung đã lưu'}</strong><span>Đã lưu {savedDate(item.savedAt)} · {typeLabel(item.contentType)}</span></div><button type="button" className="saved-unsave" onClick={() => unsave(item)}>Bỏ lưu</button></div>
              <div className="saved-card-body">
                <p className="saved-card-title">{item.title || item.description}</p>
                {item.contentType === 'MARKETPLACE' && item.description && <p className="saved-description">{item.description}</p>}
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
