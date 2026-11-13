import React, { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "../components/Icon"
import { Avatar, Button, EmptyState, ErrorBlock, Loading, Modal, useAsync, useToast } from "../components/ui"
import {
  bookmarkForumTopic,
  createForumTopic,
  createForumTopicWithAttachment,
  deleteForumTopic,
  downloadForumAttachment,
  getForumTaxonomy,
  getForumTopic,
  getForumTopics,
  replyForumTopic,
  updateForumTopic,
  reportForumTopic,
} from "../api/forumApi"
import { useAuth } from "../context/AuthContext"
import { getApiErrorMessage } from "../utils/apiError"
import { formatBytes, timeAgo } from "../utils/format"

const TYPE_LABEL = {
  QUESTION: "Câu hỏi",
  DISCUSSION: "Thảo luận",
  PROJECT: "Dự án",
  EXPERIENCE: "Kinh nghiệm",
  KNOWLEDGE: "Kiến thức",
  RESOURCE: "Chia sẻ tài liệu",
}
const RESOURCE_KIND = {
  CURRICULUM: "Chương trình học",
  STUDY_MATERIAL: "Tài liệu học tập",
  EXAM: "Đề thi",
  LECTURE: "Bài giảng",
  REFERENCE: "Tài liệu tham khảo",
}
const TABS = [
  ["newest", "Mới nhất"],
  ["unanswered", "Chưa trả lời"],
  ["DISCUSSION", "Thảo luận"],
  ["RESOURCE", "Tài liệu"],
]

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | 0).toString(16)))

function TopicDetail({ topicId, meId, onClose, onChanged }) {
  const toast = useToast()
  const { data: topic, loading, error, setData } = useAsync(() => getForumTopic(topicId), [topicId])
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: "", content: "" })

  const startEdit = () => {
    setDraft({ title: topic.title, content: topic.content })
    setEditing(true)
  }
  const saveEdit = async () => {
    if (!draft.title.trim() || !draft.content.trim()) return
    setBusy(true)
    try {
      const updated = await updateForumTopic(topicId, {
        title: draft.title.trim(),
        content: draft.content.trim(),
        type: topic.type,
        resourceKind: topic.resourceKind || null,
        source: topic.source || null,
        categoryId: topic.categoryId || null,
        courseId: topic.courseId || null,
        facultyId: topic.facultyId || null,
        majorId: topic.majorId || null,
      })
      setData({ ...topic, ...updated, replies: topic.replies })
      setEditing(false)
      toast("Đã cập nhật chủ đề.")
      onChanged()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể cập nhật chủ đề."), "error")
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async (event) => {
    event.preventDefault()
    if (!reply.trim()) return
    setBusy(true)
    try {
      const created = await replyForumTopic(topicId, reply.trim())
      setData({ ...topic, replies: [...(topic.replies || []), created], replyCount: (topic.replyCount || 0) + 1 })
      setReply("")
      onChanged()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể gửi trả lời."), "error")
    } finally {
      setBusy(false)
    }
  }

  const bookmark = async () => {
    try {
      await bookmarkForumTopic(topicId, !bookmarked)
      setBookmarked(!bookmarked)
      toast(!bookmarked ? "Đã lưu chủ đề." : "Đã bỏ lưu chủ đề.")
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể lưu chủ đề."), "error")
    }
  }

  const report = async () => {
    const reason = window.prompt("Lý do báo cáo chủ đề này:")
    if (!reason?.trim()) return
    try {
      await reportForumTopic(topicId, reason.trim())
      toast("Đã gửi báo cáo tới quản trị viên.")
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể gửi báo cáo."), "error")
    }
  }

  const remove = async () => {
    if (!window.confirm("Xóa chủ đề này?")) return
    try {
      await deleteForumTopic(topicId)
      toast("Đã xóa chủ đề.")
      onChanged()
      onClose()
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể xóa chủ đề."), "error")
    }
  }

  const download = async (attachment) => {
    try {
      const blob = await downloadForumAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = attachment.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể tải tệp."), "error")
    }
  }

  return (
    <Modal title={topic?.title || "Chủ đề"} close={onClose} wide>
      <div className="topic-detail">
        {loading && <Loading />}
        {error && <ErrorBlock message={error} />}
        {topic && (
          <>
            <div className="topic-detail-tags">
              <span>{TYPE_LABEL[topic.type] || topic.type}</span>
              {topic.faculty && <span>{topic.faculty}</span>}
              {topic.course && <span>{topic.course}</span>}
              {topic.resourceKind && <span>{RESOURCE_KIND[topic.resourceKind]}</span>}
            </div>
            <div className="topic-detail-author">
              <Avatar name={topic.authorName} src={topic.authorAvatar} size="sm" />
              <span>
                <strong>{topic.authorName}</strong> · {timeAgo(topic.createdAt)} · {topic.viewCount} lượt xem
              </span>
            </div>
            {editing ? (
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="full">Tiêu đề<input value={draft.title} maxLength={180} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
                <label className="full">Nội dung<textarea rows={6} value={draft.content} maxLength={30000} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></label>
                <div className="full" style={{ display: "flex", gap: 8 }}>
                  <Button disabled={busy} onClick={saveEdit}>Lưu chỉnh sửa</Button>
                  <Button variant="secondary" onClick={() => setEditing(false)}>Hủy</Button>
                </div>
              </div>
            ) : (
              <p className="topic-detail-body">{topic.content}</p>
            )}
            {topic.source && <p className="topic-detail-source">Nguồn: {topic.source}</p>}
            {(topic.attachments || []).map((a) => (
              <button type="button" key={a.id} className="attachment-row" onClick={() => download(a)}>
                <Icon name="file" />
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.extension} · {formatBytes(a.size)}</small>
                </span>
                <Icon name="download" size={18} />
              </button>
            ))}
            <div className="topic-detail-actions">
              <Button variant="secondary" icon="bookmark" onClick={bookmark}>{bookmarked ? "Đã lưu" : "Lưu chủ đề"}</Button>
              <Button variant="secondary" onClick={report}>Báo cáo</Button>
              {String(topic.authorId) === String(meId) && !editing && <Button variant="secondary" icon="edit" onClick={startEdit}>Sửa</Button>}
              {String(topic.authorId) === String(meId) && <Button variant="danger" icon="trash" onClick={remove}>Xóa</Button>}
            </div>
            <h3 style={{ marginTop: 18 }}>{(topic.replies || []).length} trả lời</h3>
            <div className="reply-list">
              {(topic.replies || []).map((r) => (
                <div className="comment-preview comment-item" key={r.id}>
                  <Avatar name={r.author} src={r.authorAvatar} size="sm" />
                  <div>
                    <strong>{r.author}</strong>
                    <p>{r.content}</p>
                    <span>{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
            <form className="comment-form" onSubmit={sendReply}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Viết câu trả lời của bạn..." maxLength={10000} />
              <button className="button button-primary" disabled={busy || !reply.trim()}>Gửi</button>
            </form>
          </>
        )}
      </div>
    </Modal>
  )
}

function NewTopicModal({ taxonomy, onClose, onCreated, defaultType = "QUESTION" }) {
  const toast = useToast()
  const [form, setForm] = useState({ title: "", content: "", type: defaultType, facultyId: "", majorId: "", courseId: "", categoryId: "", resourceKind: "STUDY_MATERIAL", source: "" })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [submissionKey] = useState(uuid)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value, ...(key === "facultyId" ? { majorId: "" } : {}) }))
  const majors = (taxonomy?.majors || []).filter((m) => String(m.facultyId) === String(form.facultyId))
  const isResource = form.type === "RESOURCE"

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    if (isResource && !file) {
      toast("Bài chia sẻ tài liệu cần kèm một tệp.", "error")
      return
    }
    setBusy(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        facultyId: form.facultyId || null,
        majorId: form.majorId || null,
        courseId: form.courseId || null,
        categoryId: form.categoryId || null,
        resourceKind: isResource ? form.resourceKind : null,
        source: form.source.trim() || null,
      }
      const created = isResource ? await createForumTopicWithAttachment(payload, file, submissionKey) : await createForumTopic(payload)
      toast("Đã đăng chủ đề.")
      onCreated(created)
    } catch (err) {
      toast(getApiErrorMessage(err, "Không thể đăng chủ đề."), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Đăng chủ đề mới" close={onClose} wide>
      <div className="form-grid">
        <label className="full">
          Tiêu đề
          <input value={form.title} onChange={set("title")} maxLength={180} placeholder="Viết tiêu đề rõ ràng, cụ thể" />
        </label>
        <label>
          Loại chủ đề
          <select value={form.type} onChange={set("type")}>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Danh mục
          <select value={form.categoryId} onChange={set("categoryId")}>
            <option value="">Không chọn</option>
            {(taxonomy?.categories || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Khoa
          <select value={form.facultyId} onChange={set("facultyId")}>
            <option value="">Không chọn</option>
            {(taxonomy?.faculties || []).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <label>
          Chuyên ngành
          <select value={form.majorId} onChange={set("majorId")} disabled={!form.facultyId}>
            <option value="">Không chọn</option>
            {majors.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="full">
          Môn học
          <select value={form.courseId} onChange={set("courseId")}>
            <option value="">Không chọn</option>
            {(taxonomy?.courses || []).map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
            ))}
          </select>
        </label>
        {isResource && (
          <>
            <label>
              Loại tài liệu
              <select value={form.resourceKind} onChange={set("resourceKind")}>
                {Object.entries(RESOURCE_KIND).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Nguồn tài liệu
              <input value={form.source} onChange={set("source")} maxLength={500} placeholder="Giảng viên, giáo trình..." />
            </label>
            <label className="full">
              Tệp đính kèm
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </>
        )}
        <label className="full">
          Nội dung
          <textarea rows={6} value={form.content} onChange={set("content")} maxLength={30000} placeholder="Mô tả chi tiết vấn đề hoặc nội dung chia sẻ..." />
        </label>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button disabled={busy || !form.title.trim() || !form.content.trim()} onClick={submit}>{busy ? "Đang đăng..." : "Đăng chủ đề"}</Button>
      </div>
    </Modal>
  )
}

export default function ForumPage() {
  const splat = useParams()["*"] || ""
  const topicId = splat.match(/^topics\/(\d+)/)?.[1]
  const routeFilter = splat.match(/^(categories|faculties|majors)\/(\d+)/)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [tab, setTab] = useState("newest")
  const [faculty, setFaculty] = useState(routeFilter?.[1] === "faculties" ? routeFilter[2] : "")
  const [category, setCategory] = useState(routeFilter?.[1] === "categories" ? routeFilter[2] : "")
  const [major, setMajor] = useState(routeFilter?.[1] === "majors" ? routeFilter[2] : "")
  const [sort, setSort] = useState("newest")
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const { data: taxonomy } = useAsync(() => getForumTaxonomy(), [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const params = useMemo(
    () => ({
      q: debounced,
      type: tab === "DISCUSSION" || tab === "RESOURCE" ? tab : "",
      facultyId: faculty || undefined,
      categoryId: category || undefined,
      majorId: major || undefined,
      sort,
      page,
      size: 15,
    }),
    [debounced, tab, faculty, category, major, sort, page],
  )
  const { data, loading, error, reload } = useAsync(() => getForumTopics(params), [JSON.stringify(params)])
  const items = (data?.items || []).filter((t) => tab !== "unanswered" || t.replyCount === 0)
  const facultyName = (taxonomy?.faculties || []).find((f) => String(f.id) === String(faculty))?.name

  return (
    <div className="forum-page">
      <header className="forum-header">
        <div>
          <span className="eyebrow">Không gian học tập</span>
          <h1>Hỏi đáp, thảo luận và chia sẻ tài liệu</h1>
          <p>Kết nối kiến thức giữa các khoa, tìm lời giải từ cộng đồng sinh viên CMC.</p>
        </div>
        <Button icon="plus" onClick={() => setCreating(true)}>Đăng chủ đề</Button>
      </header>
      <div className="forum-toolbar panel">
        <label>
          <Icon name="search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm câu hỏi, môn học hoặc tài liệu..." />
        </label>
        <select className="toolbar-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0) }}>
          <option value="">Mọi danh mục</option>
          {(taxonomy?.categories || []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="toolbar-select" value={faculty} onChange={(e) => { setFaculty(e.target.value); setMajor(""); setPage(0) }}>
          <option value="">Tất cả khoa</option>
          {(taxonomy?.faculties || []).map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select className="toolbar-select" value={major} disabled={!faculty} onChange={(e) => { setMajor(e.target.value); setPage(0) }}>
          <option value="">{faculty ? "Tất cả chuyên ngành" : "Chọn khoa trước"}</option>
          {(taxonomy?.majors || []).filter((m) => String(m.facultyId) === String(faculty)).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select className="toolbar-select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0) }}>
          <option value="newest">Mới nhất</option>
          <option value="popular">Xem nhiều</option>
        </select>
      </div>
      <div className="forum-layout">
        <main className="topic-section">
          <div className="topic-tabs">
            {TABS.map(([key, label]) => (
              <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setPage(0) }}>{label}</button>
            ))}
          </div>
          <div className="topic-list">
            {loading && <Loading label="Đang tải chủ đề..." />}
            {error && <ErrorBlock message={error} onRetry={reload} />}
            {!loading && !error && items.length === 0 && (
              <EmptyState title="Không tìm thấy chủ đề" copy="Thử dùng từ khóa khác hoặc bỏ bớt bộ lọc." />
            )}
            {!loading &&
              items.map((t) => (
                <article className="topic-row" key={t.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/forum/topics/${t.id}`)}>
                  <div className={`topic-type ${t.type === "RESOURCE" ? "resource" : ""}`}>
                    <Icon name={t.type === "RESOURCE" ? "file" : "forum"} />
                  </div>
                  <div className="topic-main">
                    <div>
                      <span>{TYPE_LABEL[t.type] || t.type}</span>
                      {(t.faculty || t.category) && <span>{t.faculty || t.category}</span>}
                    </div>
                    <h3>{t.title}</h3>
                    <p>{t.authorName} · {timeAgo(t.createdAt)}</p>
                  </div>
                  <div className="topic-stats">
                    <strong>{t.type === "RESOURCE" ? "Tệp" : t.replyCount}</strong>
                    <span>{t.type === "RESOURCE" ? "Đính kèm" : "Trả lời"}</span>
                  </div>
                  <Icon name="chevron" />
                </article>
              ))}
          </div>
          {data && data.totalPages > 1 && (
            <div className="pager">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button>
              <span>Trang {page + 1}/{data.totalPages}</span>
              <Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button>
            </div>
          )}
        </main>
        <aside className="forum-aside">
          <section className="panel">
            <h3>Khám phá theo khoa</h3>
            {(taxonomy?.faculties || []).length === 0 && <p className="aside-empty">Chưa có khoa nào.</p>}
            {(taxonomy?.faculties || []).map((f, i) => (
              <button key={f.id} onClick={() => { setFaculty(String(f.id) === String(faculty) ? "" : String(f.id)); setPage(0) }}>
                <span className={`faculty f${i % 4}`}>{f.name[0]}</span>
                <span style={{ fontWeight: String(f.id) === String(faculty) ? 700 : 400 }}>{f.name}</span>
                <Icon name="chevron" />
              </button>
            ))}
            {facultyName && <p className="aside-empty" style={{ marginTop: 8 }}>Đang lọc theo: {facultyName}</p>}
          </section>
          <section className="rule-card">
            <Icon name="check" />
            <div>
              <h3>Quy định cộng đồng</h3>
              <p>Viết tiêu đề rõ ràng, ghi nguồn tài liệu và trao đổi tôn trọng.</p>
            </div>
          </section>
        </aside>
      </div>
      {topicId && <TopicDetail topicId={topicId} meId={user?.userId} onClose={() => navigate("/forum")} onChanged={reload} />}
      {creating && (
        <NewTopicModal
          taxonomy={taxonomy}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false)
            reload()
            if (created?.id) navigate(`/forum/topics/${created.id}`)
          }}
        />
      )}
    </div>
  )
}
