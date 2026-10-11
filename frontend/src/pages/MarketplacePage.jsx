import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { marketplaceApi } from '../api/marketplaceApi'
import { conversationApi } from '../api/conversationApi'
import { videoApi } from '../api/videoApi'
import { useAuth } from '../context/AuthContext'

const categories = ['Tất cả', 'Điện thoại', 'Thời trang', 'Điện tử', 'Đồ gia dụng', 'Xe', 'Đồ cá nhân', 'Khác']
const conditions = [
  ['NEW', 'Mới'],
  ['LIKE_NEW', 'Như mới'],
  ['GOOD', 'Tốt'],
  ['FAIR', 'Đã sử dụng'],
]
const initialForm = {
  title: '', description: '', price: '', category: 'Điện thoại',
  condition: 'GOOD', location: '', imageUrls: [],
}
const formatPrice = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price || 0)
const formatDate = (date) => date ? new Date(date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function MarketplacePage() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [detail, setDetail] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [recommendationError, setRecommendationError] = useState('')
  const [queryInput, setQueryInput] = useState(searchParams.get('q') || '')
  const [filters, setFilters] = useState({
    category: '', condition: '', minPrice: '', maxPrice: '', location: '',
  })
  const [sort, setSort] = useState('NEWEST')
  const [scope, setScope] = useState('ALL')
  const [mineStatus, setMineStatus] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [savingForm, setSavingForm] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  const previewUrls = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles])
  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        if (queryInput.trim()) current.set('q', queryInput.trim())
        else current.delete('q')
        return current
      }, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [queryInput, setSearchParams])

  useEffect(() => {
    if (listingId) return undefined
    let active = true
    setLoading(true)
    const params = {
      q: searchParams.get('q') || '',
      category: filters.category,
      condition: filters.condition,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      location: filters.location,
      sort,
      scope,
      status: scope === 'MINE' ? mineStatus : '',
      page: 0,
      size: 24,
    }
    marketplaceApi.list(params)
      .then(({ data }) => {
        if (!active) return
        setListings(data.content || [])
        setHasMore(!data.last)
        setPage(0)
        setError('')
      })
      .catch((err) => { if (active) { setListings([]); setError(err.response?.data?.message || 'Không thể tải sản phẩm.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [listingId, searchParams, filters, sort, scope, mineStatus, reloadKey])

  useEffect(() => {
    if (listingId) {
      let active = true
      setDetail(null)
      setLoading(true)
      setError('')
      marketplaceApi.get(listingId)
        .then(({ data }) => { if (active) { setDetail(data); setError('') } })
        .catch((err) => { if (active) setError(err.response?.data?.message || 'Không tìm thấy sản phẩm.') })
        .finally(() => { if (active) setLoading(false) })
      return () => { active = false }
    }
    return undefined
  }, [listingId, reloadKey])

  useEffect(() => {
    if (listingId || scope !== 'ALL' || searchParams.get('q') || filters.category || filters.condition || filters.location || filters.minPrice || filters.maxPrice) return
    setRecommendationError('')
    marketplaceApi.recommendations({ size: 8 })
      .then(({ data }) => setRecommendations(data.content || []))
      .catch((err) => { setRecommendations([]); setRecommendationError(err.response?.data?.message || 'Không thể tải gợi ý sản phẩm.') })
    marketplaceApi.searchHistory()
      .then(({ data }) => setSearchHistory(data || []))
      .catch((err) => { setSearchHistory([]); setRecommendationError(err.response?.data?.message || 'Không thể tải lịch sử tìm kiếm.') })
  }, [listingId, scope, searchParams, filters])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { data } = await marketplaceApi.list({
        q: searchParams.get('q') || '', ...filters, sort, scope,
        status: scope === 'MINE' ? mineStatus : '', page: page + 1, size: 24,
      })
      setListings((current) => [...current, ...(data.content || [])])
      setPage((current) => current + 1)
      setHasMore(!data.last)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải thêm sản phẩm.')
    } finally { setLoadingMore(false) }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...initialForm, location: user?.location || '' })
    setSelectedFiles([])
    setFormOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      title: item.title, description: item.description, price: item.price,
      category: item.category, condition: item.condition, location: item.location,
      imageUrls: item.imageUrls || [],
    })
    setSelectedFiles([])
    setFormOpen(true)
  }

  const submitListing = async (event) => {
    event.preventDefault()
    if (selectedFiles.length + form.imageUrls.length > 8) {
      setNotice('Mỗi tin đăng được tối đa 8 ảnh.')
      return
    }
    setSavingForm(true)
    try {
      let imageUrls = form.imageUrls
      if (selectedFiles.length) {
        const { data } = await marketplaceApi.uploadImages(selectedFiles)
        imageUrls = [...imageUrls, ...data.imageUrls]
      }
      const payload = { ...form, price: Number(form.price), imageUrls }
      if (editing) {
        const { data } = await marketplaceApi.update(editing.listingId, payload)
        setListings((current) => current.map((item) => item.listingId === data.listingId ? data : item))
        if (String(detail?.listingId) === String(data.listingId)) setDetail(data)
        setNotice('Đã cập nhật tin đăng.')
      } else {
        const { data } = await marketplaceApi.create(payload)
        setScope('MINE')
        setMineStatus('')
        setListings((current) => [data, ...current])
        setNotice('Đã đăng bán sản phẩm.')
      }
      setFormOpen(false)
      setSelectedFiles([])
    } catch (err) {
      setNotice(err.response?.data?.message || 'Không thể lưu tin đăng.')
    } finally { setSavingForm(false) }
  }

  const toggleSave = async (item) => {
    try {
      const { data } = await marketplaceApi.toggleSaved(item.listingId)
      const update = (current) => ({ ...current, savedByViewer: data.saved })
      setListings((current) => scope === 'SAVED' && !data.saved
        ? current.filter((entry) => entry.listingId !== item.listingId)
        : current.map((entry) => entry.listingId === item.listingId ? update(entry) : entry))
      setDetail((current) => current?.listingId === item.listingId && !(scope === 'SAVED' && !data.saved) ? update(current) : current)
      setNotice(data.saved ? 'Đã lưu sản phẩm.' : 'Đã bỏ lưu sản phẩm.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể lưu sản phẩm.') }
  }

  const toggleFollow = async (sellerId) => {
    try {
      const { data } = await marketplaceApi.toggleFollow(sellerId)
      const update = (item) => item.sellerId === sellerId ? { ...item, followingSeller: data.following } : item
      setListings((current) => current.map(update))
      setDetail((current) => current?.sellerId === sellerId ? update(current) : current)
      setNotice(data.following ? 'Đã theo dõi người bán.' : 'Đã bỏ theo dõi người bán.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể theo dõi người bán.') }
  }

  const contactSeller = async (item) => {
    if (String(item.sellerId) === String(user?.userId)) {
      setNotice('Đây là tin đăng của bạn.')
      return
    }
    try {
      const { data } = await conversationApi.getOrCreatePrivate(item.sellerId)
      navigate(`/chat/${data.conversationId}`)
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể mở cuộc trò chuyện với người bán.') }
  }

  const shareListing = async (item) => {
    const url = new URL(`/marketplace/${item.listingId}`, window.location.origin).toString()
    try {
      if (navigator.share) await navigator.share({ title: item.title, text: `${item.title} · ${formatPrice(item.price)}`, url })
      else {
        await navigator.clipboard.writeText(url)
        setNotice('Đã sao chép liên kết sản phẩm.')
      }
      const { data } = await marketplaceApi.share(item.listingId)
      const update = (entry) => entry.listingId === item.listingId ? { ...entry, shareCount: data.shareCount } : entry
      setListings((current) => current.map(update))
      setDetail((current) => current?.listingId === item.listingId ? { ...current, shareCount: data.shareCount } : current)
    } catch (err) {
      if (err.name !== 'AbortError') setNotice(err.response?.data?.message || 'Không thể chia sẻ sản phẩm.')
    }
  }

  const markSold = async (item) => {
    try {
      const { data } = await marketplaceApi.markSold(item.listingId)
      setListings((current) => scope === 'ALL'
        ? current.filter((entry) => entry.listingId !== data.listingId)
        : current.map((entry) => entry.listingId === data.listingId ? data : entry))
      setDetail(data)
      setNotice('Đã đánh dấu sản phẩm là đã bán.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể cập nhật trạng thái sản phẩm.') }
  }

  const deleteListing = async (item) => {
    if (!window.confirm(`Xóa tin đăng “${item.title}”?`)) return
    try {
      await marketplaceApi.remove(item.listingId)
      setListings((current) => current.filter((entry) => entry.listingId !== item.listingId))
      if (detail?.listingId === item.listingId) navigate('/marketplace')
      setNotice('Đã xóa tin đăng.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể xóa tin đăng.') }
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (!reportTarget || !reportReason.trim()) return
    setReporting(true)
    try {
      await marketplaceApi.report(reportTarget.listingId, { targetType: reportTarget.type, reason: reportReason.trim() })
      setReportTarget(null)
      setReportReason('')
      setNotice('Đã gửi báo cáo. Cảm ơn bạn đã thông tin.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể gửi báo cáo.') }
    finally { setReporting(false) }
  }

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const detailBack = () => navigate('/marketplace')

  const renderCard = (item) => (
    <article className="market-card" key={item.listingId}>
      <div className="market-card-image">
        <Link className="market-card-image-link" to={`/marketplace/${item.listingId}`} aria-label={`Xem ${item.title}`}>
          {item.imageUrls?.[0] ? <img src={videoApi.resolveMediaUrl(item.imageUrls[0])} alt={item.title} loading="lazy" /> : <span className="market-no-image">▧</span>}
        </Link>
        {item.status === 'SOLD' && <span className="market-sold-label">ĐÃ BÁN</span>}
        <button type="button" className={`market-save-button ${item.savedByViewer ? 'saved' : ''}`} aria-label={item.savedByViewer ? 'Bỏ lưu sản phẩm' : 'Lưu sản phẩm'} onClick={() => toggleSave(item)}>{item.savedByViewer ? '♥' : '♡'}</button>
      </div>
      <div className="market-card-copy">
        <Link to={`/marketplace/${item.listingId}`} className="market-card-title">{item.title}</Link>
        <strong>{formatPrice(item.price)}</strong>
        <span>{item.location}</span>
      </div>
    </article>
  )

  const content = listingId ? (detail ? (
    <section className="market-detail">
      <button type="button" className="market-back-button" onClick={detailBack}>← Quay lại Marketplace</button>
      <div className="market-detail-layout">
        <div className="market-detail-gallery">
          {detail.imageUrls?.length ? detail.imageUrls.map((image, index) => <img key={`${image}-${index}`} src={videoApi.resolveMediaUrl(image)} alt={`${detail.title} ${index + 1}`} />) : <div className="market-no-image">▧ Chưa có ảnh</div>}
        </div>
        <div className="market-detail-info">
          <span className={`market-status ${detail.status === 'SOLD' ? 'sold' : ''}`}>{detail.status === 'SOLD' ? 'Đã bán' : 'Đang bán'} · {detail.category}</span>
          <h1>{detail.title}</h1>
          <strong className="market-detail-price">{formatPrice(detail.price)}</strong>
          <p className="market-detail-location">⌖ {detail.location} · Đăng {formatDate(detail.createdAt)}</p>
          <div className="market-detail-actions">
            <button className="market-primary-button" disabled={detail.status === 'SOLD'} onClick={() => contactSeller(detail)}>Nhắn tin người bán</button>
            <button type="button" onClick={() => toggleSave(detail)}>{detail.savedByViewer ? '♥ Đã lưu' : '♡ Lưu'}</button>
            <button type="button" onClick={() => shareListing(detail)}>↗ Chia sẻ</button>
          </div>
          <div className="market-seller-card">
            <Avatar src={detail.sellerAvatar} name={detail.sellerName} size={46} />
            <div><strong>{detail.sellerName}</strong><span>Người bán trên KapaTalk</span></div>
            {String(detail.sellerId) !== String(user?.userId) && <button type="button" onClick={() => toggleFollow(detail.sellerId)}>{detail.followingSeller ? 'Đang theo dõi' : 'Theo dõi'}</button>}
          </div>
          <h2>Mô tả sản phẩm</h2>
          <p className="market-detail-description">{detail.description}</p>
          <dl className="market-specs"><div><dt>Tình trạng</dt><dd>{conditions.find(([value]) => value === detail.condition)?.[1] || detail.condition}</dd></div><div><dt>Khu vực</dt><dd>{detail.location}</dd></div><div><dt>Ngày đăng</dt><dd>{formatDate(detail.createdAt)}</dd></div></dl>
          {String(detail.sellerId) === String(user?.userId)
            ? <div className="market-owner-actions"><button type="button" onClick={() => openEdit(detail)}>Sửa tin</button>{detail.status !== 'SOLD' && <button type="button" onClick={() => markSold(detail)}>Đánh dấu đã bán</button>}<button type="button" onClick={() => deleteListing(detail)}>Xóa tin</button></div>
            : <button type="button" className="market-report-link" onClick={() => { setReportTarget({ listingId: detail.listingId, type: 'LISTING' }); setReportReason('') }}>Báo cáo sản phẩm</button>}
          {String(detail.sellerId) !== String(user?.userId) && <button type="button" className="market-report-link" onClick={() => { setReportTarget({ listingId: detail.listingId, type: 'SELLER' }); setReportReason('') }}>Báo cáo người bán</button>}
        </div>
      </div>
    </section>
  ) : (
    <section className={`market-state ${error ? 'market-error' : ''}`}>
      {loading ? <><span className="market-empty-icon">⌕</span><strong>Đang tải sản phẩm...</strong></> : <><strong>Không thể mở sản phẩm</strong><span>{error || 'Không tìm thấy sản phẩm.'}</span><button type="button" onClick={() => setReloadKey((current) => current + 1)}>Thử lại</button></>}
    </section>
  )) : (
    <div className="market-layout">
      <aside className="market-sidebar">
        <label className="market-search"><span>⌕</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Tìm kiếm trên Marketplace" aria-label="Tìm kiếm sản phẩm" />{queryInput && <button type="button" onClick={() => setQueryInput('')} aria-label="Xóa tìm kiếm">×</button>}</label>
        <button type="button" className="market-primary-button market-sell-button" onClick={openCreate}>＋ Đăng bán</button>
        <nav className="market-menu" aria-label="Marketplace">
          <button type="button" className={scope === 'ALL' && sort !== 'NEARBY' ? 'active' : ''} onClick={() => { setScope('ALL'); setSort('NEWEST') }}><span className="market-menu-icon" aria-hidden="true">⌂</span><span>Khám phá</span></button>
          <button type="button" className={sort === 'NEARBY' ? 'active' : ''} onClick={() => { setScope('ALL'); setSort('NEARBY') }}><span className="market-menu-icon" aria-hidden="true">⌖</span><span>Gần bạn</span></button>
          <button type="button" className={sort === 'POPULAR' ? 'active' : ''} onClick={() => { setScope('ALL'); setSort('POPULAR') }}><span className="market-menu-icon" aria-hidden="true">✦</span><span>Nổi bật</span></button>
          <button type="button" className={scope === 'MINE' ? 'active' : ''} onClick={() => { setScope('MINE'); setSort('NEWEST') }}><span className="market-menu-icon" aria-hidden="true">▤</span><span>Tin đăng của bạn</span></button>
          <button type="button" className={scope === 'SAVED' ? 'active' : ''} onClick={() => { setScope('SAVED'); setSort('NEWEST') }}><span className="market-menu-icon" aria-hidden="true">♡</span><span>Đã lưu</span></button>
        </nav>
        {scope === 'MINE' && <select className="market-filter-select" value={mineStatus} onChange={(event) => setMineStatus(event.target.value)} aria-label="Lọc trạng thái tin đăng"><option value="">Tất cả tin đăng</option><option value="ACTIVE">Đang bán</option><option value="SOLD">Đã bán</option></select>}
        <div className="market-filter-block">
          <h2>Danh mục</h2>
          {categories.map((category) => <button type="button" key={category} className={(filters.category || 'Tất cả') === category ? 'selected' : ''} onClick={() => updateFilter('category', category === 'Tất cả' ? '' : category)}>{category}</button>)}
        </div>
        <div className="market-filter-block">
          <h2>Bộ lọc</h2>
          <label>Giá từ<input type="number" min="0" value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} placeholder="₫ thấp nhất" /></label>
          <label>Đến<input type="number" min="0" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} placeholder="₫ cao nhất" /></label>
          <label>Tình trạng<select value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)}><option value="">Tất cả</option>{conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Khu vực<input value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} placeholder="Ví dụ: Hà Nội" /></label>
          <button type="button" className="market-clear-filters" onClick={() => setFilters({ category: '', condition: '', minPrice: '', maxPrice: '', location: '' })}>Xóa bộ lọc</button>
        </div>
      </aside>
      <section className="market-main">
        <header className="market-heading"><div><span className="market-eyebrow">MUA BÁN TRONG CỘNG ĐỒNG</span><h1>{scope === 'MINE' ? 'Tin đăng của bạn' : scope === 'SAVED' ? 'Sản phẩm đã lưu' : sort === 'NEARBY' ? 'Sản phẩm gần bạn' : sort === 'POPULAR' ? 'Sản phẩm nổi bật' : 'Marketplace'}</h1><p>Tìm món đồ phù hợp, kết nối trực tiếp với người bán.</p></div><button type="button" className="market-primary-button market-desktop-sell" onClick={openCreate}>＋ Đăng bán sản phẩm</button></header>
        <div className="market-toolbar"><span>{loading ? 'Đang tìm sản phẩm...' : `${listings.length}${hasMore ? '+' : ''} sản phẩm`}</span><label>Sắp xếp<select value={sort === 'NEARBY' ? 'NEARBY' : sort} onChange={(event) => setSort(event.target.value)}><option value="NEWEST">Mới nhất</option><option value="POPULAR">Nổi bật</option><option value="PRICE_ASC">Giá thấp đến cao</option><option value="PRICE_DESC">Giá cao đến thấp</option><option value="NEARBY">Gần bạn</option></select></label></div>
        {!loading && error && <div className="market-state market-error"><strong>Không tải được Marketplace</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((current) => current + 1)}>Thử lại</button></div>}
        {!loading && !error && listings.length === 0 && <div className="market-state"><span className="market-empty-icon">⌕</span><strong>Chưa tìm thấy sản phẩm phù hợp</strong><span>{scope === 'MINE' ? 'Tin đăng của bạn sẽ xuất hiện tại đây.' : scope === 'SAVED' ? 'Sản phẩm bạn lưu sẽ được tập hợp tại đây.' : 'Thử đổi từ khóa hoặc bộ lọc, hoặc đăng bán sản phẩm đầu tiên.'}</span>{scope === 'MINE' && <button className="market-primary-button" type="button" onClick={openCreate}>Đăng bán sản phẩm</button>}</div>}
        {sort === 'NEARBY' && !user?.location && <p className="market-location-note">Hãy thêm khu vực trong hồ sơ để gợi ý chính xác hơn.</p>}
        {listings.length > 0 && <div className="market-grid">{listings.map(renderCard)}</div>}
        {loading && <div className="market-grid">{Array.from({ length: 8 }, (_, index) => <div className="market-skeleton" key={index} />)}</div>}
        {hasMore && listings.length > 0 && <button type="button" className="market-load-more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Đang tải...' : 'Xem thêm sản phẩm'}</button>}
        {(recommendations.length > 0 || recommendationError) && scope === 'ALL' && !searchParams.get('q') && !filters.category && <section className="market-recommendations"><div><h2>Gợi ý cho bạn</h2><span>Dựa trên những tìm kiếm gần đây</span></div>{recommendationError && <p className="market-recommendation-error">{recommendationError}</p>}{recommendations.length > 0 && <div className="market-grid">{recommendations.slice(0, 4).map(renderCard)}</div>}{searchHistory.length > 0 && <p>Tìm gần đây: {searchHistory.slice(0, 3).join(' · ')}</p>}</section>}
      </section>
    </div>
  )

  return (
    <main className="marketplace-page">
      <header className="market-topbar"><Link to="/marketplace" className="market-brand"><span aria-hidden="true">▰</span> Marketplace</Link><label className="market-top-search"><span aria-hidden="true">⌕</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Tìm kiếm sản phẩm..." aria-label="Tìm kiếm sản phẩm" /></label><button type="button" className="market-mobile-sell" onClick={openCreate}>＋ Đăng bán</button></header>
      <div className="market-content">
        {notice && <div className="market-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}
        {content}
      </div>

      {formOpen && createPortal(<div className="market-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingForm) setFormOpen(false) }}>
        <form className="market-form-modal" onSubmit={submitListing}>
          <header><div><span className="market-eyebrow">{editing ? 'QUẢN LÝ TIN ĐĂNG' : 'KẾT NỐI NGƯỜI MUA'}</span><h2>{editing ? 'Chỉnh sửa sản phẩm' : 'Đăng bán sản phẩm'}</h2></div><button type="button" onClick={() => setFormOpen(false)} aria-label="Đóng">×</button></header>
          <label>Ảnh sản phẩm <small>(tối đa 8 ảnh)</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files || []).slice(0, Math.max(0, 8 - form.imageUrls.length)))} /></label>
          {(form.imageUrls.length > 0 || previewUrls.length > 0) && <div className="market-image-previews">{form.imageUrls.map((url) => <div key={url}><img src={videoApi.resolveMediaUrl(url)} alt="Ảnh sản phẩm đã chọn" /><button type="button" onClick={() => setForm((current) => ({ ...current, imageUrls: current.imageUrls.filter((image) => image !== url) }))}>×</button></div>)}{previewUrls.map((url) => <div key={url}><img src={url} alt="Ảnh sản phẩm xem trước" /><button type="button" onClick={() => setSelectedFiles((current) => current.filter((_, index) => previewUrls[index] !== url))}>×</button></div>)}</div>}
          <label>Tên sản phẩm<input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Giá bán (₫)<input required type="number" min="1" step="1" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></label>
          <div className="market-form-row"><label>Danh mục<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{categories.filter((category) => category !== 'Tất cả').map((category) => <option key={category}>{category}</option>)}</select></label><label>Tình trạng<select value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))}>{conditions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          <label>Khu vực<input required maxLength={160} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Quận/huyện, tỉnh/thành" /></label>
          <label>Mô tả<textarea required maxLength={4000} rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả chi tiết sản phẩm, tình trạng và cách giao dịch..." /></label>
          <footer><button type="button" onClick={() => setFormOpen(false)} disabled={savingForm}>Hủy</button><button className="market-primary-button" type="submit" disabled={savingForm}>{savingForm ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Đăng bán'}</button></footer>
        </form>
      </div>, document.body)}

      {reportTarget && createPortal(<div className="market-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !reporting) setReportTarget(null) }}><form className="market-report-modal" onSubmit={submitReport}><header><h2>Báo cáo {reportTarget.type === 'SELLER' ? 'người bán' : 'sản phẩm'}</h2><button type="button" onClick={() => setReportTarget(null)} aria-label="Đóng">×</button></header><label>Lý do<textarea required maxLength={1000} rows={4} autoFocus value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Cho chúng tôi biết vấn đề bạn gặp phải..." /></label><footer><button type="button" onClick={() => setReportTarget(null)}>Hủy</button><button type="submit" className="market-primary-button" disabled={reporting || !reportReason.trim()}>{reporting ? 'Đang gửi...' : 'Gửi báo cáo'}</button></footer></form></div>, document.body)}
    </main>
  )
}
