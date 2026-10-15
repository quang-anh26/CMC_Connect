import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { CalendarIcon, LocationPinIcon, MessengerLogo } from '../components/Icons'
import { eventApi } from '../api/eventApi'
import { useAuth } from '../context/AuthContext'

const filters = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'UPCOMING', label: 'Sắp diễn ra' },
  { value: 'JOINED', label: 'Đã tham gia' },
  { value: 'MINE', label: 'Sự kiện của tôi' },
]

const blankForm = {
  title: '',
  imageUrl: '',
  startsAt: '',
  location: '',
  description: '',
  privacy: 'PUBLIC',
}

function localDateTimeValue(value) {
  if (value) return value.slice(0, 16)
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return now.toISOString().slice(0, 16)
}

function formatEventDate(value) {
  const date = new Date(value)
  return {
    day: new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(date).replace('.', ''),
    full: new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date),
  }
}

function getErrorMessage(error) {
  return error.response?.data?.message || error.response?.data?.error || 'Có lỗi xảy ra. Vui lòng thử lại.'
}

function AttendanceButtons({ event, onChange, compact = false }) {
  const [busy, setBusy] = useState(false)
  const hasStarted = new Date(event.startsAt).getTime() < Date.now()
  const submit = async (status) => {
    if (busy) return
    setBusy(true)
    try {
      const { data } = await eventApi.attendance(event.eventId, status)
      onChange(data)
    } catch (error) {
      window.alert(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`event-attendance-actions ${compact ? 'compact' : ''}`}>
      <button type="button" className={`event-going-button ${event.viewerStatus === 'GOING' ? 'selected' : ''}`} disabled={busy || hasStarted} onClick={() => submit('GOING')}>
        {hasStarted ? 'Đã diễn ra' : event.viewerStatus === 'GOING' ? 'Đã tham gia' : 'Tham gia'}
      </button>
      <button type="button" className={`event-interested-button ${event.viewerStatus === 'INTERESTED' ? 'selected' : ''}`} disabled={busy || hasStarted} onClick={() => submit('INTERESTED')}>
        {hasStarted ? 'Đã kết thúc' : event.viewerStatus === 'INTERESTED' ? 'Đang quan tâm' : 'Quan tâm'}
      </button>
    </div>
  )
}

export default function EventsPage() {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const { user } = useAuth()
  const [filter, setFilter] = useState('ALL')
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(imageFile)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [imageFile])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    if (eventId) {
      setSelectedEvent(null)
      eventApi.get(eventId)
        .then(({ data }) => { if (active) setSelectedEvent(data) })
        .catch((requestError) => { if (active) setError(getErrorMessage(requestError)) })
        .finally(() => { if (active) setLoading(false) })
    } else {
      setSelectedEvent(null)
      eventApi.list(filter)
        .then(({ data }) => { if (active) setEvents(data) })
        .catch((requestError) => { if (active) setError(getErrorMessage(requestError)) })
        .finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false }
  }, [eventId, filter])

  const isOrganizer = selectedEvent && String(selectedEvent.organizerId) === String(user?.userId)
  const listTitle = useMemo(() => filters.find((item) => item.value === filter)?.label || 'Sự kiện', [filter])

  const updateEventInList = (nextEvent) => {
    setEvents((current) => current.map((item) => item.eventId === nextEvent.eventId ? nextEvent : item))
    if (eventId) setSelectedEvent(nextEvent)
  }

  const openCreateForm = () => {
    setEditing(false)
    setForm(blankForm)
    setImageFile(null)
    setFormOpen(true)
  }

  const openEditForm = () => {
    setEditing(true)
    setImageFile(null)
    setForm({
      title: selectedEvent.title,
      imageUrl: selectedEvent.imageUrl || '',
      startsAt: localDateTimeValue(selectedEvent.startsAt),
      location: selectedEvent.location,
      description: selectedEvent.description || '',
      privacy: selectedEvent.privacy || 'PUBLIC',
    })
    setFormOpen(true)
  }

  const saveEvent = async (submitEvent) => {
    submitEvent.preventDefault()
    setSaving(true)
    setError('')
    try {
      let imageUrl = form.imageUrl
      if (imageFile) {
        const uploaded = await eventApi.uploadImage(imageFile)
        imageUrl = uploaded.data.url
      }
      const payload = { ...form, imageUrl, startsAt: form.startsAt }
      const response = editing
        ? await eventApi.update(selectedEvent.eventId, payload)
        : await eventApi.create(payload)
      setFormOpen(false)
      setImageFile(null)
      if (editing) {
        setSelectedEvent(response.data)
        setEvents((current) => current.map((item) => item.eventId === response.data.eventId ? response.data : item))
      } else {
        navigate(`/events/${response.data.eventId}`)
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const cancelEvent = async () => {
    if (!selectedEvent || !window.confirm('Bạn có chắc muốn hủy sự kiện này?')) return
    try {
      await eventApi.cancel(selectedEvent.eventId)
      navigate('/events')
      setFilter('MINE')
    } catch (cancelError) {
      setError(getErrorMessage(cancelError))
    }
  }

  const eventCover = (item, className = '') => (
    item.imageUrl
      ? <img className={`event-cover-image ${className}`} src={item.imageUrl} alt={item.title} />
      : <div className={`event-cover-placeholder ${className}`}><CalendarIcon size={42} /></div>
  )

  return (
    <div className="events-page">
      <header className="events-topbar">
        <button className="events-brand" type="button" onClick={() => navigate('/feed')} aria-label="KapaTalk - Trang chủ">
          <MessengerLogo size={34} /><span>KapaTalk</span>
        </button>
        <div className="events-topbar-label">Sự kiện</div>
        <button className="events-feed-link" type="button" onClick={() => navigate('/feed')}>Về bảng tin</button>
      </header>

      <main className="events-content">
        {eventId && (
          <button type="button" className="events-back-link" onClick={() => navigate('/events')}>← Tất cả sự kiện</button>
        )}

        {eventId ? (
          <>
            {loading && <div className="events-state-card">Đang tải sự kiện...</div>}
            {error && <div className="events-error" role="alert">{error}</div>}
            {!loading && selectedEvent && (
              <article className="event-detail-card">
                {eventCover(selectedEvent, 'event-detail-cover')}
                <div className="event-detail-body">
                  <div className="event-detail-heading">
                    <div>
                      <h1>{selectedEvent.title}</h1>
                    </div>
                    {isOrganizer && <div className="event-owner-actions"><button type="button" onClick={openEditForm}>Chỉnh sửa</button><button type="button" className="danger" onClick={cancelEvent}>Hủy sự kiện</button></div>}
                  </div>
                  <div className="event-detail-grid">
                    <section className="event-detail-main">
                      <div className="event-facts">
                        <div><span className="event-fact-icon"><CalendarIcon size={19} /></span><div><strong>{formatEventDate(selectedEvent.startsAt).full}</strong><small>Ngày và giờ bắt đầu</small></div></div>
                        <div><span className="event-fact-icon location-icon"><LocationPinIcon size={20} /></span><div><strong>{selectedEvent.location}</strong><small>Địa điểm tổ chức</small></div></div>
                      </div>
                      <section className="event-description-section"><h2>Giới thiệu</h2><p>{selectedEvent.description || 'Người tổ chức chưa thêm mô tả cho sự kiện này.'}</p></section>
                      <section className="event-attendees-section">
                        <div className="event-section-heading"><h2>Người tham gia</h2></div>
                        {selectedEvent.attendees?.length ? <div className="event-attendee-list">
                          {selectedEvent.attendees.map((attendee) => <div className="event-attendee" key={attendee.userId}><Avatar src={attendee.avatar} name={attendee.name} size={38} /><div><strong>{attendee.name}</strong><small>{attendee.status === 'GOING' ? 'Sẽ tham gia' : 'Đang quan tâm'}</small></div></div>)}
                        </div> : <p className="event-muted">Chưa có ai phản hồi. Hãy là người đầu tiên!</p>}
                      </section>
                    </section>
                    <aside className="event-detail-sidebar">
                      <section className="event-organizer-card"><span className="event-card-label">Người tổ chức</span><div><Avatar src={selectedEvent.organizerAvatar} name={selectedEvent.organizerName} size={44} /><strong>{selectedEvent.organizerName}</strong></div></section>
                      <section className="event-count-card"><div><strong>{selectedEvent.goingCount}</strong><span>Sẽ tham gia</span></div><div><strong>{selectedEvent.interestedCount}</strong><span>Quan tâm</span></div></section>
                      <div className="event-privacy-note">{selectedEvent.privacy === 'PUBLIC' ? '🌐 Công khai' : selectedEvent.privacy === 'FRIENDS' ? '👥 Bạn bè' : '🔒 Riêng tư'}</div>
                      <AttendanceButtons event={selectedEvent} onChange={setSelectedEvent} />
                    </aside>
                  </div>
                </div>
              </article>
            )}
          </>
        ) : (
          <>
            <section className="events-hero">
              <div><span className="events-eyebrow">KAPATALK · KẾT NỐI NGOÀI ĐỜI</span><h1>Sự kiện nổi bật</h1><p>Tìm hoạt động thú vị, gặp gỡ bạn bè và cùng tạo nên những kỷ niệm mới.</p></div>
              <button type="button" className="event-create-button" onClick={openCreateForm}><span>＋</span> Tạo sự kiện</button>
            </section>
            <nav className="event-filter-tabs" aria-label="Lọc sự kiện">
              {filters.map((item) => <button key={item.value} type="button" className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}
            </nav>
            <div className="events-list-heading"><div><h2>{listTitle}</h2><span>{events.length} sự kiện</span></div></div>
            {error && <div className="events-error" role="alert">{error}</div>}
            {loading ? <div className="events-state-card">Đang tải sự kiện...</div> : events.length ? (
              <div className="events-grid">
                {events.map((item) => {
                  const date = formatEventDate(item.startsAt)
                  return <article className="event-card" key={item.eventId}>
                    <Link className="event-card-cover-link" to={`/events/${item.eventId}`}>
                      {eventCover(item, 'event-card-cover')}
                      <span className="event-date-badge"><strong>{date.day}</strong><small>{date.month}</small></span>
                    </Link>
                    <div className="event-card-body">
                      <Link to={`/events/${item.eventId}`} className="event-card-title"><h3>{item.title}</h3></Link>
                      <p className="event-card-date"><CalendarIcon size={15} /> {date.full}</p>
                      <p className="event-card-location"><LocationPinIcon size={15} />{item.location}</p>
                      <div className="event-card-organizer"><Avatar src={item.organizerAvatar} name={item.organizerName} size={27} /><span>{item.organizerName}</span></div>
                      <div className="event-card-footer"><span>{item.goingCount} tham gia · {item.interestedCount} quan tâm</span><span className="event-privacy-chip">{item.privacy === 'PUBLIC' ? 'Công khai' : item.privacy === 'FRIENDS' ? 'Bạn bè' : 'Riêng tư'}</span></div>
                      <AttendanceButtons event={item} compact onChange={updateEventInList} />
                    </div>
                  </article>
                })}
              </div>
            ) : (
              <section className="events-empty-state"><span><CalendarIcon size={34} /></span><h3>Chưa có sự kiện nào</h3><p>{filter === 'JOINED' ? 'Các sự kiện bạn tham gia sẽ xuất hiện ở đây.' : 'Tạo một sự kiện để rủ bạn bè cùng tham gia nhé.'}</p><button type="button" onClick={openCreateForm}>＋ Tạo sự kiện</button></section>
            )}
          </>
        )}
      </main>

      {formOpen && <div className="event-form-backdrop" onMouseDown={(click) => { if (click.target === click.currentTarget) setFormOpen(false) }}>
        <form className="event-form-dialog" onSubmit={saveEvent}>
          <header><div><span className="events-eyebrow">KAPATALK EVENTS</span><h2>{editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}</h2></div><button type="button" className="event-form-close" onClick={() => setFormOpen(false)} aria-label="Đóng">×</button></header>
          <label className="event-image-picker">{imagePreview || form.imageUrl ? <img src={imagePreview || form.imageUrl} alt="Ảnh bìa sự kiện" /> : <span className="event-image-placeholder"><CalendarIcon size={28} /><strong>Thêm ảnh sự kiện</strong><small>Chọn ảnh JPG, PNG hoặc WebP</small></span>}<input type="file" accept="image/*" onChange={(change) => setImageFile(change.target.files?.[0] || null)} /></label>
          <label>Tên sự kiện<input required maxLength={120} value={form.title} onChange={(change) => setForm({ ...form, title: change.target.value })} placeholder="Ví dụ: Gặp mặt cộng đồng KapaTalk" /></label>
          <div className="event-form-row"><label>Ngày và giờ<input required type="datetime-local" min={localDateTimeValue()} value={form.startsAt} onChange={(change) => setForm({ ...form, startsAt: change.target.value })} /></label><label>Địa điểm<input required maxLength={180} value={form.location} onChange={(change) => setForm({ ...form, location: change.target.value })} placeholder="Thành phố, địa điểm cụ thể" /></label></div>
          <label>Mô tả<textarea maxLength={5000} rows={4} value={form.description} onChange={(change) => setForm({ ...form, description: change.target.value })} placeholder="Chia sẻ thêm thông tin về sự kiện..." /></label>
          <label>Quyền riêng tư<select value={form.privacy} onChange={(change) => setForm({ ...form, privacy: change.target.value })}><option value="PUBLIC">Công khai — mọi người có thể xem</option><option value="FRIENDS">Bạn bè — chỉ bạn bè của bạn</option><option value="PRIVATE">Riêng tư — chỉ bạn và người tham gia</option></select></label>
          {error && <div className="events-error" role="alert">{error}</div>}
          <footer><button type="button" className="event-cancel-button" onClick={() => setFormOpen(false)}>Đóng</button><button type="submit" className="event-save-button" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo sự kiện'}</button></footer>
        </form>
      </div>}
    </div>
  )
}
