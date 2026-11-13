import React, { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useAsync, useToast } from "../components/ui"
import { eventApi } from "../api/eventApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { eventTimeRange, mediaUrl, monthShort } from "../utils/format"

const FILTERS = [["ALL", "Tất cả"], ["UPCOMING", "Sắp diễn ra"], ["JOINED", "Đã tham gia"], ["MINE", "Do tôi tổ chức"]]
const PRIVACY = { PUBLIC: "Công khai", FRIENDS: "Bạn bè", PRIVATE: "Chỉ mình tôi" }

function Cover({ event }) {
  return event.imageUrl ? <img src={mediaUrl(event.imageUrl)} alt={event.title} /> : <div className="cover-fallback"><Icon name="calendar" size={36} /></div>
}

function EventForm({ initial, onClose, onSaved }) {
  const toast = useToast()
  const start = initial?.startsAt ? new Date(initial.startsAt) : null
  const pad = (n) => String(n).padStart(2, "0")
  const [form, setForm] = useState({
    title: initial?.title || "",
    date: start ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` : "",
    time: start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : "",
    location: initial?.location || "",
    description: initial?.description || "",
    privacy: initial?.privacy || "PUBLIC",
    imageUrl: initial?.imageUrl || "",
  })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const valid = form.title.trim() && form.date && form.time && form.location.trim()

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { data } = await eventApi.uploadImage(file)
      setForm((f) => ({ ...f, imageUrl: data.url }))
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể tải ảnh lên."), "error")
    }
  }

  const submit = async () => {
    setBusy(true)
    try {
      const payload = {
        title: form.title.trim(),
        imageUrl: form.imageUrl || null,
        startsAt: `${form.date}T${form.time}:00`,
        location: form.location.trim(),
        description: form.description.trim(),
        privacy: form.privacy,
      }
      const { data } = initial ? await eventApi.update(initial.eventId, payload) : await eventApi.create(payload)
      toast(initial ? "Đã cập nhật sự kiện." : "Đã tạo sự kiện.")
      onSaved(data)
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể lưu sự kiện."), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={initial ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"} close={onClose}>
      <div className="form-grid">
        <label className="full">Tên sự kiện<input value={form.title} onChange={set("title")} maxLength={120} placeholder="Ví dụ: Workshop kỹ năng thuyết trình" /></label>
        <label>Ngày tổ chức<input type="date" value={form.date} onChange={set("date")} /></label>
        <label>Thời gian<input type="time" value={form.time} onChange={set("time")} /></label>
        <label className="full">Địa điểm<input value={form.location} onChange={set("location")} maxLength={180} placeholder="Nhập phòng hoặc địa điểm" /></label>
        <label>Quyền riêng tư
          <select value={form.privacy} onChange={set("privacy")}>
            {Object.entries(PRIVACY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Ảnh bìa<input type="file" accept="image/*" onChange={upload} /></label>
        {form.imageUrl && <img className="full form-preview" src={mediaUrl(form.imageUrl)} alt="Ảnh bìa" />}
        <label className="full">Mô tả<textarea rows={4} value={form.description} onChange={set("description")} maxLength={5000} placeholder="Giới thiệu ngắn về sự kiện..." /></label>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button disabled={busy || !valid} onClick={submit}>{initial ? "Lưu thay đổi" : "Tạo sự kiện"}</Button>
      </div>
    </Modal>
  )
}

function EventDetail({ eventId, meId, onClose, onChanged, onEdit }) {
  const toast = useToast()
  const { data: event, loading, error, setData } = useAsync(() => eventApi.get(eventId).then((r) => r.data), [eventId])
  const attend = async (status) => {
    try {
      const { data } = await eventApi.attendance(eventId, status)
      setData(data)
      onChanged()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể cập nhật trạng thái tham gia."), "error")
    }
  }
  const cancel = async () => {
    if (!window.confirm("Hủy sự kiện này?")) return
    try {
      await eventApi.cancel(eventId)
      toast("Đã hủy sự kiện.")
      onChanged()
      onClose()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể hủy sự kiện."), "error")
    }
  }
  return (
    <Modal title={event?.title || "Sự kiện"} close={onClose} wide>
      {loading && <Loading />}
      {error && <ErrorBlock message={error} />}
      {event && (
        <div className="topic-detail">
          <div className="event-detail-cover"><Cover event={event} /></div>
          <p className="event-meta"><Icon name="clock" size={16} /> {eventTimeRange(event.startsAt)}</p>
          <p className="event-meta"><Icon name="location" size={16} /> {event.location}</p>
          <p className="event-meta"><Icon name="users" size={16} /> {event.goingCount} tham gia · {event.interestedCount} quan tâm · {PRIVACY[event.privacy]}</p>
          <p className="event-meta">Tổ chức bởi <strong>{event.organizerName}</strong></p>
          {event.description && <p className="topic-detail-body">{event.description}</p>}
          <div className="topic-detail-actions">
            <Button variant={event.viewerStatus === "GOING" ? "primary" : "secondary"} onClick={() => attend("GOING")}>{event.viewerStatus === "GOING" ? "Đã tham gia" : "Tham gia"}</Button>
            <Button variant={event.viewerStatus === "INTERESTED" ? "primary" : "secondary"} onClick={() => attend("INTERESTED")}>{event.viewerStatus === "INTERESTED" ? "Đang quan tâm" : "Quan tâm"}</Button>
            {String(event.organizerId) === String(meId) && (
              <>
                <Button variant="secondary" icon="edit" onClick={() => onEdit(event)}>Chỉnh sửa</Button>
                <Button variant="danger" icon="trash" onClick={cancel}>Hủy sự kiện</Button>
              </>
            )}
          </div>
          {(event.attendees || []).length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Người tham gia</h3>
              <div className="attendee-list">
                {event.attendees.map((a) => (
                  <span key={a.userId}><Avatar name={a.name} src={a.avatar} size="sm" /> {a.name}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function EventsPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [filter, setFilter] = useState("ALL")
  const [form, setForm] = useState(null)
  const { data, loading, error, reload } = useAsync(() => eventApi.list(filter).then((r) => r.data || []), [filter])
  const events = data || []
  const featured = events.find((e) => new Date(e.startsAt) >= new Date()) || events[0]
  const rest = events.filter((e) => e !== featured)

  return (
    <div className="events-page">
      <header className="page-title-row">
        <div>
          <h1>Sự kiện trong trường</h1>
          <p>Khám phá hoạt động học thuật, câu lạc bộ và kết nối sinh viên.</p>
        </div>
        <Button icon="plus" onClick={() => setForm({})}>Tạo sự kiện</Button>
      </header>
      <div className="event-filters">
        {FILTERS.map(([key, label]) => (
          <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {loading && <Loading label="Đang tải sự kiện..." />}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && events.length === 0 && <EmptyState title="Chưa có sự kiện" copy="Hãy tạo sự kiện đầu tiên cho cộng đồng." icon="calendar" />}
      {featured && !loading && (
        <div className="featured-event">
          <Cover event={featured} />
          <div className="featured-copy">
            <span>Sự kiện nổi bật · {new Date(featured.startsAt).toLocaleDateString("vi-VN")}</span>
            <h2>{featured.title}</h2>
            <p>{featured.description || `${eventTimeRange(featured.startsAt)} · ${featured.location}`}</p>
            <div>
              <Button onClick={() => navigate(`/events/${featured.eventId}`)}>Xem chi tiết</Button>
            </div>
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <>
          <div className="event-section-head"><h2>Tất cả sự kiện</h2><span>{events.length} sự kiện</span></div>
          <div className="event-grid">
            {rest.map((e) => (
              <article className="event-card" key={e.eventId} style={{ cursor: "pointer" }} onClick={() => navigate(`/events/${e.eventId}`)}>
                <div className="event-cover">
                  <Cover event={e} />
                  <span><b>{new Date(e.startsAt).getDate()}</b><small>{monthShort(e.startsAt)}</small></span>
                </div>
                <div className="event-card-body">
                  <span>{PRIVACY[e.privacy]}</span>
                  <h3>{e.title}</h3>
                  <p><Icon name="clock" />{eventTimeRange(e.startsAt)}</p>
                  <p><Icon name="location" />{e.location}</p>
                  <div>
                    <span className="avatar-stack">
                      {(e.attendees || []).slice(0, 3).map((a) => <Avatar key={a.userId} name={a.name} src={a.avatar} size="sm" />)}
                    </span>
                    <small>{e.goingCount} người tham gia</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {eventId && !form && <EventDetail eventId={eventId} meId={user?.userId} onClose={() => navigate("/events")} onChanged={reload} onEdit={(ev) => setForm(ev)} />}
      {form && (
        <EventForm
          initial={form.eventId ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
