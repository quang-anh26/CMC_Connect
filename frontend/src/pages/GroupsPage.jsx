import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useAsync, useToast } from "../components/ui"
import { groupApi } from "../api/groupApi"
import { useAuth } from "../context/AuthContext"
import GroupDetail from "./GroupDetail"
import { getApiErrorMessage } from "../utils/apiError"
import { mediaUrl, timeAgo } from "../utils/format"

const asList = (d) => (Array.isArray(d) ? d : d?.content || [])
const VIS = { PUBLIC: "Nhóm công khai", PRIVATE: "Nhóm riêng tư" }

function GroupIcon({ group, i }) {
  return group.avatar ? <img className="group-icon" src={mediaUrl(group.avatar)} alt="" style={{ objectFit: "cover" }} /> : <div className={`group-icon gi${i % 4}`}><Icon name={i % 2 ? "users" : "forum"} /></div>
}

export default function GroupsPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState("mine")
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", category: "", visibility: "PUBLIC" })
  const [busy, setBusy] = useState(false)
  const groups = useAsync(() => (groupId ? Promise.resolve([]) : groupApi.list(tab === "mine" ? { mine: true } : { search }).then((r) => asList(r.data))), [tab, search, groupId])
  const invites = useAsync(() => groupApi.notifications().then((r) => (r.data || []).filter((n) => n.type === "INVITE")).catch(() => []), [])

  if (groupId) return <GroupDetail groupId={groupId} key={groupId} />

  const list = groups.data || []
  const first = list[0]
  const create = async () => {
    setBusy(true)
    try {
      const { data } = await groupApi.create(form)
      setCreating(false)
      navigate(`/groups/${data.groupId}`)
    } catch (err) { toast(getApiErrorMessage(err, "Không thể tạo nhóm."), "error") } finally { setBusy(false) }
  }
  const join = async (g) => {
    try {
      const { data } = await groupApi.join(g.groupId)
      if (data?.status === "JOINED") navigate(`/groups/${g.groupId}`)
      else { toast("Đã gửi yêu cầu tham gia nhóm."); groups.reload() }
    } catch (err) { toast(getApiErrorMessage(err, "Không thể tham gia nhóm."), "error") }
  }
  const respond = async (n, approved) => {
    try { await groupApi.respondInvite(n.referenceId, approved); toast(approved ? "Đã tham gia nhóm." : "Đã từ chối lời mời."); invites.reload(); groups.reload() } catch (err) { toast(getApiErrorMessage(err, "Không thể xử lý lời mời."), "error") }
  }

  return (
    <div className="directory-page">
      <header className="page-title-row">
        <div><h1>{tab === "mine" ? "Nhóm của bạn" : "Khám phá nhóm"}</h1><p>Cùng học tập, chia sẻ sở thích và tham gia hoạt động.</p></div>
        <Button icon="plus" onClick={() => setCreating(true)}>Tạo nhóm</Button>
      </header>
      <div className="event-filters">
        <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>Đã tham gia</button>
        <button className={tab === "discover" ? "active" : ""} onClick={() => setTab("discover")}>Khám phá</button>
        {(invites.data || []).length > 0 && <button onClick={() => document.getElementById("group-invites")?.scrollIntoView({ behavior: "smooth" })}>Lời mời <em>{invites.data.length}</em></button>}
        {tab === "discover" && (
          <label className="inline-search filter-end"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nhóm" /></label>
        )}
      </div>
      {(invites.data || []).length > 0 && (
        <section className="request-strip" id="group-invites" style={{ marginBottom: 20 }}>
          <div><h2>Lời mời vào nhóm</h2></div>
          <div className="request-list">
            {invites.data.map((n) => (
              <article key={n.id}><div className="group-icon"><Icon name="group" /></div><div><h3>{n.groupName}</h3><p>{n.message}</p></div><div><Button onClick={() => respond(n, true)}>Chấp nhận</Button><Button variant="secondary" onClick={() => respond(n, false)}>Từ chối</Button></div></article>
            ))}
          </div>
        </section>
      )}
      {groups.loading && <Loading label="Đang tải nhóm..." />}
      {groups.error && <ErrorBlock message={groups.error} onRetry={groups.reload} />}
      {!groups.loading && !groups.error && list.length === 0 && <EmptyState title={tab === "mine" ? "Bạn chưa tham gia nhóm nào" : "Chưa tìm thấy nhóm phù hợp"} copy="Tham gia cộng đồng hoặc tạo nhóm đầu tiên." icon="group" />}
      {first && !groups.loading && tab === "mine" && (
        <section className="group-feature">
          {first.coverImage ? <img src={mediaUrl(first.coverImage)} alt="" /> : <div className="cover-fallback"><Icon name="group" size={40} /></div>}
          <div><span>{VIS[first.visibility]} · {first.memberCount} thành viên</span><h2>{first.name}</h2><p>{first.description || "Chưa có mô tả cho nhóm này."}</p><Button onClick={() => navigate(`/groups/${first.groupId}`)}>Truy cập nhóm</Button></div>
        </section>
      )}
      {list.length > 0 && !groups.loading && (
        <>
          <div className="section-title"><h2>{tab === "mine" ? "Tất cả nhóm của bạn" : "Có thể bạn quan tâm"}</h2></div>
          <div className="group-list">
            {list.map((g, i) => (
              <article key={g.groupId}>
                <GroupIcon group={g} i={i} />
                <div><h3>{g.name}</h3><p>{VIS[g.visibility]} · {g.memberCount} thành viên</p><span>{g.category || "Cộng đồng"}</span></div>
                {g.joined ? <Button variant="secondary" onClick={() => navigate(`/groups/${g.groupId}`)}>Xem nhóm</Button> : <Button variant="secondary" onClick={() => join(g)}>Tham gia</Button>}
              </article>
            ))}
          </div>
        </>
      )}
      {creating && (
        <Modal title="Tạo nhóm mới" close={() => setCreating(false)}>
          <div className="form-grid">
            <label className="full">Tên nhóm<input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Chủ đề<input value={form.category} maxLength={80} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Học tập, CLB..." /></label>
            <label>Quyền riêng tư<select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="PUBLIC">Công khai</option><option value="PRIVATE">Riêng tư</option></select></label>
            <label className="full">Mô tả<textarea rows={4} value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          </div>
          <div className="modal-actions"><Button variant="secondary" onClick={() => setCreating(false)}>Hủy</Button><Button disabled={busy || !form.name.trim()} onClick={create}>Tạo nhóm</Button></div>
        </Modal>
      )}
    </div>
  )
}
