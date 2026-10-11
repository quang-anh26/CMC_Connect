import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { groupApi } from '../api/groupApi'

const initialForm = { name: '', description: '', category: '', visibility: 'PUBLIC' }

export default function GroupsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('discover')
  const [search, setSearch] = useState('')
  const [groups, setGroups] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialForm)

  const loadGroups = () => {
    setLoading(true)
    groupApi.list(tab === 'mine' ? { mine: true } : { search })
      .then(({ data }) => { setGroups(data || []); setError('') })
      .catch((err) => { setGroups([]); setError(err.response?.data?.message || 'Không thể tải danh sách nhóm.') })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadGroups() }, [tab, search])
  useEffect(() => {
    groupApi.notifications().then(({ data }) => setNotifications(data || [])).catch(() => setNotifications([]))
  }, [])

  const createGroup = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { data } = await groupApi.create(form)
      setModalOpen(false)
      setForm(initialForm)
      navigate(`/groups/${data.groupId}`)
    } catch (err) {
      setNotice(err.response?.data?.message || 'Không thể tạo nhóm. Vui lòng thử lại.')
    } finally { setSaving(false) }
  }

  const respondInvite = async (notification, approved) => {
    try {
      await groupApi.respondInvite(notification.referenceId, approved)
      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      setNotice(approved ? 'Đã tham gia nhóm.' : 'Đã từ chối lời mời.')
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể xử lý lời mời.') }
  }

  const openNotification = async (notification) => {
    try { await groupApi.markNotificationRead(notification.id) } catch {}
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))
    navigate(`/groups/${notification.groupId}`)
  }

  const joinGroup = async (event, group) => {
    event.preventDefault()
    try {
      const { data } = await groupApi.join(group.groupId)
      if (data.status === 'JOINED') navigate(`/groups/${group.groupId}`)
      else setNotice('Đã gửi yêu cầu tham gia nhóm.')
      loadGroups()
    } catch (err) { setNotice(err.response?.data?.message || 'Không thể tham gia nhóm.') }
  }

  return (
    <main className="groups-page">
      <header className="groups-page-head">
        <div><span className="groups-kicker">CỘNG ĐỒNG</span><h1>Nhóm</h1><p>Tìm nơi để chia sẻ những điều bạn quan tâm.</p></div>
        <button className="group-primary-button" type="button" onClick={() => setModalOpen(true)}><span aria-hidden="true">+</span> Tạo nhóm</button>
      </header>

      <div className="groups-toolbar">
        <label className="groups-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nhóm theo tên" aria-label="Tìm nhóm" /></label>
        <div className="groups-tabs" role="tablist" aria-label="Danh sách nhóm">
          <button type="button" role="tab" aria-selected={tab === 'discover'} className={tab === 'discover' ? 'selected' : ''} onClick={() => setTab('discover')}>Khám phá</button>
          <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'selected' : ''} onClick={() => setTab('mine')}>Nhóm của bạn</button>
        </div>
      </div>

      {notice && <div className="group-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button></div>}

      {notifications.some((item) => item.type === 'INVITE') && <section className="group-invites" aria-label="Lời mời nhóm">
        <div className="group-section-heading"><div><span className="groups-kicker">DÀNH CHO BẠN</span><h2>Lời mời</h2></div></div>
        {notifications.filter((item) => item.type === 'INVITE').map((item) => <div className="group-invite-row" key={item.id}>
          <div><strong>{item.groupName}</strong><span>{item.message}</span></div>
          <button type="button" className="group-primary-button compact" onClick={() => respondInvite(item, true)}>Chấp nhận</button>
          <button type="button" className="group-quiet-button" onClick={() => respondInvite(item, false)}>Từ chối</button>
        </div>)}
      </section>}

      {notifications.some((item) => item.type !== 'INVITE' && !item.read) && <section className="group-invites group-alerts" aria-label="Thông báo nhóm">
        <div className="group-section-heading"><div><span className="groups-kicker">CẬP NHẬT</span><h2>Thông báo</h2></div></div>
        {notifications.filter((item) => item.type !== 'INVITE' && !item.read).slice(0, 5).map((item) => <button type="button" className="group-alert-row" key={item.id} onClick={() => openNotification(item)}><span className="group-alert-mark">•</span><span><strong>{item.groupName}</strong><small>{item.message}</small></span><time>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</time></button>)}
      </section>}

      <section className="groups-results" aria-live="polite">
        <div className="group-section-heading"><div><span className="groups-kicker">{tab === 'mine' ? 'ĐANG THAM GIA' : 'CỘNG ĐỒNG MỞ'}</span><h2>{tab === 'mine' ? 'Nhóm của bạn' : 'Có thể bạn quan tâm'}</h2></div><span className="group-result-count">{groups.length} nhóm</span></div>
        {loading ? <div className="groups-loading"><span className="group-spinner" />Đang tải nhóm...</div>
          : error ? <div className="groups-state groups-error"><strong>Không tải được nhóm</strong><span>{error}</span><button type="button" onClick={loadGroups}>Thử lại</button></div>
            : groups.length === 0 ? <div className="groups-state"><span className="group-empty-mark" aria-hidden="true">◌</span><strong>{tab === 'mine' ? 'Bạn chưa tham gia nhóm nào' : 'Chưa tìm thấy nhóm phù hợp'}</strong><span>{tab === 'mine' ? 'Khám phá cộng đồng hoặc tạo nhóm đầu tiên.' : 'Thử từ khóa khác hoặc tạo một cộng đồng mới.'}</span></div>
              : <div className="group-list">{groups.map((group) => <article className="group-list-item" key={group.groupId}>
                <Link className="group-list-cover" to={`/groups/${group.groupId}`} style={group.coverImage ? { backgroundImage: `linear-gradient(0deg, rgba(9, 17, 23, .18), rgba(9, 17, 23, .04)), url("${group.coverImage}")` } : undefined} aria-label={`Mở nhóm ${group.name}`}>
                  {group.avatar ? <img src={group.avatar} alt="" /> : <span>{group.name.slice(0, 1).toUpperCase()}</span>}
                </Link>
                <div className="group-list-copy"><div className="group-list-title"><Link to={`/groups/${group.groupId}`}>{group.name}</Link><span className={`group-privacy ${group.visibility === 'PRIVATE' ? 'private' : ''}`}>{group.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</span></div>
                  <span className="group-list-meta">{group.category || 'Cộng đồng'} · {group.memberCount} thành viên</span>
                  <p>{group.description || 'Chưa có mô tả cho nhóm này.'}</p>
                </div>
                {group.joined ? <Link className="group-secondary-button" to={`/groups/${group.groupId}`}>Xem nhóm</Link>
                  : <button className="group-primary-button compact" type="button" onClick={(event) => joinGroup(event, group)}>Tham gia</button>}
              </article>)}</div>}
      </section>

      {modalOpen && <div className="group-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
        <form className="group-create-modal" onSubmit={createGroup} aria-labelledby="create-group-title">
          <div className="group-modal-heading"><div><span className="groups-kicker">BẮT ĐẦU CỘNG ĐỒNG</span><h2 id="create-group-title">Tạo nhóm</h2></div><button type="button" className="group-close-button" onClick={() => setModalOpen(false)} aria-label="Đóng">×</button></div>
          <label>Tên nhóm<input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Những người yêu cây" /></label>
          <label>Mô tả<textarea rows="3" maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Nhóm này dành cho ai?" /></label>
          <label>Danh mục<input maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Sở thích, học tập, địa phương..." /></label>
          <fieldset className="group-visibility-picker"><legend>Quyền riêng tư</legend><label><input type="radio" name="visibility" value="PUBLIC" checked={form.visibility === 'PUBLIC'} onChange={() => setForm({ ...form, visibility: 'PUBLIC' })} /><span><strong>Công khai</strong><small>Mọi người có thể tìm và xem bài viết.</small></span></label><label><input type="radio" name="visibility" value="PRIVATE" checked={form.visibility === 'PRIVATE'} onChange={() => setForm({ ...form, visibility: 'PRIVATE' })} /><span><strong>Riêng tư</strong><small>Chỉ thành viên mới xem được nội dung.</small></span></label></fieldset>
          {notice && <p className="group-form-error" role="alert">{notice}</p>}
          <div className="group-modal-actions"><button type="button" className="group-quiet-button" onClick={() => setModalOpen(false)}>Hủy</button><button className="group-primary-button" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo nhóm'}</button></div>
        </form>
      </div>}
    </main>
  )
}