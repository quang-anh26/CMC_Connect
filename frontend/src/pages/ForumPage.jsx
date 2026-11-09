import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { BookOpenIcon, SearchIcon, TopicIcon } from '../components/Icons'
import {
  bookmarkForumTopic,
  createForumTopicWithAttachment,
  deleteForumTopic,
  downloadForumAttachment,
  getForumTaxonomy,
  getForumTopic,
  getForumTopics,
  replyForumTopic,
  reportForumTopic,
  updateForumTopic,
} from '../api/forumApi'
import { useAuth } from '../context/AuthContext'
import './ForumPage.css'

const PAGE_SIZE = 12
const MAX_FILE_SIZE = 50 * 1024 * 1024
const RESOURCE_TYPES = [
  { value: 'CURRICULUM', label: 'Giáo trình' },
  { value: 'STUDY_MATERIAL', label: 'Tài liệu học tập' },
  { value: 'EXAM', label: 'Đề thi' },
  { value: 'LECTURE', label: 'Bài giảng' },
  { value: 'REFERENCE', label: 'Tài liệu tham khảo' },
]
// Các loại bài đăng dành cho sinh viên (đã gộp các loại gần giống nhau).
// Giá trị cũ KNOWLEDGE / EXPERIENCE vẫn còn trong dữ liệu cũ nên được gộp vào DISCUSSION khi hiển thị và lọc.
const POST_TYPES = [
  {
    value: 'RESOURCE',
    label: 'Tài liệu',
    description: 'Giáo trình, slide, đề thi, bài giảng… kèm tệp đính kèm.',
    titleLabel: 'Tên tài liệu',
    titlePlaceholder: 'Nhập tên giáo trình, đề thi hoặc tài liệu',
    contentLabel: 'Mô tả tài liệu',
    contentPlaceholder: 'Mô tả nội dung, môn học hoặc cách sử dụng tài liệu...',
    footer: 'Hãy chia sẻ tài liệu bạn có quyền sử dụng và ghi rõ nguồn.',
    submit: 'Chia sẻ tài liệu',
  },
  {
    value: 'QUESTION',
    label: 'Hỏi đáp',
    description: 'Hỏi bài tập, kiến thức hoặc cách học một môn học.',
    titleLabel: 'Câu hỏi',
    titlePlaceholder: 'Tóm tắt câu hỏi của bạn',
    contentLabel: 'Nội dung chi tiết',
    contentPlaceholder: 'Nêu rõ môn học, bối cảnh và điều bạn đã thử...',
    footer: 'Chọn đúng khoa và ngành để người biết câu trả lời dễ tìm thấy bạn.',
    submit: 'Đăng câu hỏi',
  },
  {
    value: 'PROJECT',
    label: 'Đồ án & nhóm',
    description: 'Tìm đồng đội, chia sẻ tiến độ và kinh nghiệm làm đồ án.',
    titleLabel: 'Tiêu đề',
    titlePlaceholder: 'Ví dụ: Cần thêm thành viên cho đồ án môn ...',
    contentLabel: 'Nội dung',
    contentPlaceholder: 'Mô tả đề tài, số người cần tìm, kỹ năng mong muốn và cách liên hệ...',
    footer: 'Chỉ đăng nội dung liên quan đến đồ án, bài tập lớn của môn học.',
    submit: 'Đăng bài',
  },
  {
    value: 'DISCUSSION',
    label: 'Thảo luận & kinh nghiệm',
    description: 'Trao đổi kiến thức, phương pháp học, kinh nghiệm thi cử, thực tập.',
    titleLabel: 'Tiêu đề',
    titlePlaceholder: 'Tóm tắt nội dung bạn muốn trao đổi hoặc chia sẻ',
    contentLabel: 'Nội dung',
    contentPlaceholder: 'Thêm bối cảnh, nội dung chi tiết hoặc kinh nghiệm của bạn...',
    footer: 'Chọn khoa và chuyên ngành phù hợp để cộng đồng dễ tìm thấy bài đăng.',
    submit: 'Đăng bài',
  },
]
const TOPIC_TYPES = [
  { value: '', label: 'Tất cả' },
  ...POST_TYPES.map(({ value, label }) => ({ value, label })),
]
const LEGACY_TYPES = { KNOWLEDGE: 'DISCUSSION', EXPERIENCE: 'DISCUSSION' }
const DEFAULT_POST_TYPE = 'RESOURCE'

function normalizeType(value) {
  return LEGACY_TYPES[value] || value || ''
}

function findPostType(value) {
  return POST_TYPES.find((item) => item.value === normalizeType(value))
}

function getErrorMessage(error) {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.response?.data?.detail
    || error?.response?.data?.title
    || 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.'
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN')
}

function typeLabel(value) {
  return findPostType(value)?.label || value
}

function resourceKindLabel(value) {
  return RESOURCE_TYPES.find((item) => item.value === value)?.label || ''
}

function formatFileSize(size) {
  if (!size) return 'Tệp đính kèm'
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
}

function createSubmissionKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${((8 + Math.floor(Math.random() * 4)).toString(16))}${hex().slice(1)}-${hex()}${hex()}${hex()}`
}

function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  return (
    <div className="forum-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <div className="forum-modal" role="alertdialog" aria-modal="true" aria-labelledby="forum-modal-title" aria-describedby="forum-modal-message">
        <span className="forum-modal-icon" aria-hidden="true">!</span>
        <h2 id="forum-modal-title">{title}</h2>
        <p id="forum-modal-message">{message}</p>
        <div className="forum-modal-actions">
          <button className="forum-button forum-button-secondary" type="button" onClick={onCancel} disabled={busy} autoFocus>Hủy</button>
          <button className="forum-button forum-button-danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang xóa...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ForumHeader({ title = 'Diễn đàn học tập', description }) {
  return (
    <header className="forum-hero">
      <div className="forum-hero-copy">
        <span className="forum-eyebrow">STUDY FORUM · CMC</span>
        <h1>{title}</h1>
        <p>{description || 'Hỏi đáp, thảo luận và chia sẻ tài liệu học tập trong cộng đồng sinh viên CMC.'}</p>
      </div>
      <div className="forum-hero-actions">
        <Link className="forum-button forum-button-primary" to="/forum/new">
          <span aria-hidden="true">＋</span> Đăng bài
        </Link>
      </div>
    </header>
  )
}

function TopicCard({ topic, saved, onBookmark }) {
  return (
    <article className="forum-topic-card">
      <Avatar
        src={topic.authorAvatar}
        name={topic.authorName}
        size={44}
        className="forum-topic-avatar"
      />
      <div className="forum-topic-content">
        <div className="forum-topic-meta">
          <span className={`forum-type-badge forum-type-${normalizeType(topic.type).toLowerCase()}`}>
            {typeLabel(topic.type)}
          </span>
          {topic.resourceKind && (
            <span className="forum-topic-kind">{resourceKindLabel(topic.resourceKind)}</span>
          )}
          {topic.category && (
            <Link className="forum-topic-category" to={`/forum/categories/${topic.categoryId}`}>
              {topic.category}
            </Link>
          )}
          {topic.faculty && (
            <Link className="forum-topic-category" to={`/forum/faculties/${topic.facultyId}`}>
              {topic.faculty}
            </Link>
          )}
          {topic.major && (
            <Link className="forum-topic-category" to={`/forum/majors/${topic.majorId}`}>
              {topic.major}
            </Link>
          )}
        </div>
        <h3><Link to={`/forum/topics/${topic.id}`}>{topic.title}</Link></h3>
        <p className="forum-topic-excerpt">{topic.content}</p>
        <div className="forum-topic-byline">
          <strong>{topic.authorName}</strong>
          <span aria-hidden="true">·</span>
          <time dateTime={topic.createdAt}>{formatDate(topic.createdAt)}</time>
        </div>
      </div>
      <div className="forum-topic-actions">
        <div className="forum-topic-stats" aria-label="Thống kê chủ đề">
          <span title="Lượt xem"><span aria-hidden="true">◉</span> {topic.viewCount || 0}</span>
          <span title="Câu trả lời"><span aria-hidden="true">↩</span> {topic.replyCount || 0}</span>
        </div>
        <button
          className={`forum-bookmark-button${saved ? ' is-saved' : ''}`}
          type="button"
          onClick={() => onBookmark(topic.id, !saved)}
          aria-pressed={saved}
        >
          {saved ? 'Đã lưu' : 'Lưu'}
        </button>
      </div>
    </article>
  )
}

function ForumSidebar({ topics, showPopular = true }) {
  const popular = [...topics].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4)

  return (
    <aside className="forum-sidebar">
      <section className="forum-sidebar-card">
        <div className="forum-sidebar-heading">
          <h2>Duyệt nhanh</h2>
          <Link to="/forum/categories">Khám phá</Link>
        </div>
        <div className="forum-sidebar-categories">
          {POST_TYPES.map((item, index) => (
            <Link key={item.value} to={`/forum?type=${item.value}`}>
              <span className="forum-category-number">{String(index + 1).padStart(2, '0')}</span>
              <span>{item.label}</span>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      </section>

      {showPopular && <TopicSidebarCard title="Được quan tâm" topics={popular} empty="Chưa có chủ đề nổi bật." />}

      <section className="forum-sidebar-card forum-guidelines">
        <BookOpenIcon size={20} />
        <h2>Cùng xây dựng cộng đồng tốt</h2>
        <p>Chỉ đăng nội dung liên quan đến học tập và môn học, đặt tiêu đề rõ ràng và ghi nguồn khi chia sẻ tài liệu.</p>
        <Link to="/forum/rules">Xem hướng dẫn cộng đồng <span aria-hidden="true">→</span></Link>
      </section>
    </aside>
  )
}

function TopicSidebarCard({ title, topics, empty }) {
  return (
    <section className="forum-sidebar-card">
      <h2>{title}</h2>
      {topics.length ? (
        <ul className="forum-sidebar-topic-list">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link to={`/forum/topics/${topic.id}`}>{topic.title}</Link>
              <span>{topic.replyCount || 0} trả lời · {topic.viewCount || 0} lượt xem</span>
            </li>
          ))}
        </ul>
      ) : <p className="forum-sidebar-empty">{empty}</p>}
    </section>
  )
}

function ForumLinkGrid({ items, label }) {
  return (
    <section className="forum-category-grid" aria-label={label}>
      {items.map((item, index) => (
        <Link className="forum-category-card" key={item.key} to={item.to}>
          <span className={`forum-category-icon forum-category-icon-${index % 5}`} aria-hidden="true">
            {index === 0 ? <TopicIcon size={20} /> : <BookOpenIcon size={20} />}
          </span>
          <span className="forum-category-card-copy">
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </span>
          <span className="forum-category-arrow" aria-hidden="true">↗</span>
        </Link>
      ))}
    </section>
  )
}

function ForumFilters({
  q, type, facultyId, majorId, sort, faculties, majors, onChange, onSearch,
}) {
  return (
    <form className="forum-filters" onSubmit={onSearch}>
      <label className="forum-search-input">
        <SearchIcon size={18} />
        <span className="forum-sr-only">Tìm theo tiêu đề hoặc nội dung</span>
        <input
          value={q}
          onChange={(event) => onChange('q', event.target.value)}
          placeholder="Tìm chủ đề, câu hỏi, tài liệu..."
        />
      </label>
      <label className="forum-filter-select">
        <span className="forum-sr-only">Lọc theo khoa</span>
        <select value={facultyId} onChange={(event) => onChange('facultyId', event.target.value)}>
          <option value="">Tất cả khoa</option>
          {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
        </select>
      </label>
      <label className="forum-filter-select">
        <span className="forum-sr-only">Lọc theo chuyên ngành</span>
        <select
          value={majorId}
          onChange={(event) => onChange('majorId', event.target.value)}
          disabled={!facultyId}
        >
          <option value="">{facultyId ? 'Tất cả chuyên ngành' : 'Chọn khoa trước'}</option>
          {majors.filter((major) => String(major.facultyId) === String(facultyId))
            .map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
        </select>
      </label>
      <label className="forum-filter-select">
        <span className="forum-sr-only">Sắp xếp chủ đề</span>
        <select value={sort} onChange={(event) => onChange('sort', event.target.value)}>
          <option value="newest">Mới nhất</option>
          <option value="popular">Được xem nhiều</option>
        </select>
      </label>
      <button className="forum-button forum-button-primary forum-search-submit" type="submit">Tìm kiếm</button>
      <input type="hidden" name="type" value={type} />
    </form>
  )
}

export default function ForumPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    topicId,
    categoryId: routeCategoryId,
    facultyId: routeFacultyId,
    majorId: routeMajorId,
  } = useParams()
  const { user } = useAuth()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const [topics, setTopics] = useState([])
  const [categories, setCategories] = useState([])
  const [faculties, setFaculties] = useState([])
  const [majors, setMajors] = useState([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [type, setType] = useState(normalizeType(searchParams.get('type')))
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('categoryId') || '')
  const [facultyFilter, setFacultyFilter] = useState(searchParams.get('facultyId') || '')
  const [majorFilter, setMajorFilter] = useState(searchParams.get('majorId') || '')
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState(null)
  const [reply, setReply] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedMajor, setSelectedMajor] = useState('')
  const [postType, setPostType] = useState(DEFAULT_POST_TYPE)
  const submissionKey = useRef(null)

  const isNew = location.pathname === '/forum/new' || location.pathname === '/forum/share-resource'
  const isResourceForm = postType === 'RESOURCE'
  const currentPostType = findPostType(postType) || POST_TYPES[0]
  const isDetail = Boolean(topicId)
  const isCategoryIndex = location.pathname === '/forum/categories' && !routeCategoryId
  const isCourseRoute = location.pathname.startsWith('/forum/courses')
  const isRulePage = location.pathname === '/forum/rules'
  const isModerationRoute = location.pathname === '/forum/admin' || location.pathname === '/forum/moderation'
  const activeCategoryId = routeCategoryId || categoryFilter
  const majorFromRoute = majors.find((major) => String(major.id) === routeMajorId)
  const activeFacultyId = routeFacultyId || facultyFilter || majorFromRoute?.facultyId || ''
  const activeMajorId = routeMajorId || majorFilter

  useEffect(() => {
    setQ(searchParams.get('q') || '')
    setType(normalizeType(searchParams.get('type')))
    setCategoryFilter(searchParams.get('categoryId') || '')
    setFacultyFilter(searchParams.get('facultyId') || '')
    setMajorFilter(searchParams.get('majorId') || '')
    setSort(searchParams.get('sort') || 'newest')
    setPage(0)
  }, [searchParams])

  // Form đăng bài chung: /forum/share-resource (đường dẫn cũ) hoặc ?type=... chọn sẵn loại bài.
  useEffect(() => {
    if (!isNew) return
    const requested = findPostType(searchParams.get('type'))?.value
    setPostType(location.pathname === '/forum/share-resource' ? 'RESOURCE' : requested || DEFAULT_POST_TYPE)
  }, [isNew, location.pathname, searchParams])

  const loadTaxonomy = useCallback(async () => {
    try {
      const taxonomy = await getForumTaxonomy()
      setCategories(taxonomy.categories || [])
      setFaculties(taxonomy.faculties || [])
      setMajors(taxonomy.majors || [])
      setError('')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }, [])

  const loadTopics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getForumTopics({
        q: location.pathname === '/forum/search' ? q.trim() : '',
        type,
        categoryId: activeCategoryId || undefined,
        facultyId: activeFacultyId || undefined,
        majorId: activeMajorId || undefined,
        sort,
        page,
        size: PAGE_SIZE,
      })
      setTopics(data.items || [])
      setTotalPages(data.totalPages || 0)
      setTotalElements(data.totalElements || 0)
    } catch (requestError) {
      setTopics([])
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [activeCategoryId, activeFacultyId, activeMajorId, location.pathname, page, q, sort, type])

  useEffect(() => {
    loadTaxonomy()
  }, [loadTaxonomy])

  useEffect(() => {
    if (!isNew && !isDetail && !isCategoryIndex && !isCourseRoute && !isRulePage && !isModerationRoute) {
      loadTopics()
    }
  }, [isCategoryIndex, isCourseRoute, isDetail, isModerationRoute, isNew, isRulePage, loadTopics])

  useEffect(() => {
    if (!isDetail) {
      setDetail(null)
      return undefined
    }
    let active = true
    setDetailLoading(true)
    setError('')
    getForumTopic(topicId)
      .then((data) => {
        if (active) setDetail(data)
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => { active = false }
  }, [isDetail, topicId])

  async function handleBookmark(id, saved) {
    setError('')
    try {
      await bookmarkForumTopic(id, saved)
      setSavedIds((current) => {
        const next = new Set(current)
        if (saved) next.add(id)
        else next.delete(id)
        return next
      })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  function handleFilterChange(field, value) {
    setPage(0)
    if (field === 'q') setQ(value)
    if (field === 'categoryId') {
      setCategoryFilter(value)
      if (routeCategoryId) {
        navigate(value ? `/forum/categories/${value}` : '/forum')
      }
    }
    if (field === 'facultyId') {
      setFacultyFilter(value)
      setMajorFilter('')
      if (routeFacultyId || routeMajorId) navigate(value ? `/forum/faculties/${value}` : '/forum')
    }
    if (field === 'majorId') {
      setMajorFilter(value)
      if (routeMajorId) navigate(value ? `/forum/majors/${value}` : activeFacultyId ? `/forum/faculties/${activeFacultyId}` : '/forum')
    }
    if (field === 'sort') setSort(value)
  }

  function handleSearch(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (type) params.set('type', type)
    if (activeCategoryId) params.set('categoryId', activeCategoryId)
    if (activeFacultyId) params.set('facultyId', activeFacultyId)
    if (activeMajorId) params.set('majorId', activeMajorId)
    if (sort !== 'newest') params.set('sort', sort)
    params.set('page', '0')
    navigate(`/forum/search?${params.toString()}`)
  }

  async function handleCreateTopic(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const file = form.get('file')
    const topicType = postType
    if (!form.get('facultyId')) {
      setError('Chọn khoa trước khi đăng bài.')
      setBusy(false)
      return
    }
    if (isResourceForm && (!file || !file.size)) {
      setError('Bài đăng loại Tài liệu bắt buộc phải có tệp đính kèm.')
      setBusy(false)
      return
    }
    if (file?.size > MAX_FILE_SIZE) {
      setError('Tệp đính kèm vượt quá giới hạn 50 MB.')
      setBusy(false)
      return
    }
    try {
      if (!submissionKey.current) {
        submissionKey.current = createSubmissionKey()
      }
      const created = await createForumTopicWithAttachment({
        title: form.get('title').trim(),
        content: form.get('content').trim(),
        type: topicType,
        resourceKind: isResourceForm ? form.get('resourceKind') : null,
        facultyId: form.get('facultyId'),
        majorId: form.get('majorId') || null,
        source: isResourceForm ? (form.get('source') || '').trim() || null : null,
      }, file?.size ? file : null, submissionKey.current)
      navigate(`/forum/topics/${created.id}`)
    } catch (requestError) {
      setError(`Bài viết chưa được đăng. ${getErrorMessage(requestError)} Bạn có thể thử lại mà không tạo bài trùng.`)
    } finally {
      setBusy(false)
    }
  }

  async function handleReply(event) {
    event.preventDefault()
    if (!detail || !reply.trim()) return
    setBusy(true)
    setError('')
    try {
      await replyForumTopic(detail.id, reply.trim())
      setReply('')
      setDetail(await getForumTopic(detail.id))
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleEdit(event) {
    event.preventDefault()
    if (!detail) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const updated = await updateForumTopic(detail.id, {
        title: form.get('title').trim(),
        content: form.get('content').trim(),
        type: detail.type === 'RESOURCE' ? 'RESOURCE' : form.get('type'),
        resourceKind: detail.resourceKind || null,
        categoryId: detail.categoryId || null,
        courseId: detail.courseId || null,
        facultyId: detail.facultyId || null,
        majorId: detail.majorId || null,
        source: form.get('source').trim() || null,
      })
      setDetail((current) => ({ ...current, ...updated }))
      setEditing(false)
      setNotice('Chủ đề đã được cập nhật.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!detail) return
    setBusy(true)
    setError('')
    try {
      await deleteForumTopic(detail.id)
      setConfirmingDelete(false)
      navigate('/forum')
    } catch (requestError) {
      setConfirmingDelete(false)
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleReport(event) {
    event.preventDefault()
    if (!detail || !reportReason.trim()) return
    setBusy(true)
    setError('')
    try {
      await reportForumTopic(detail.id, reportReason.trim())
      setReporting(false)
      setReportReason('')
      setNotice('Cảm ơn bạn đã gửi báo cáo. Nội dung sẽ được xem xét.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(attachment) {
    setError('')
    try {
      const blob = await downloadForumAttachment(attachment.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = attachment.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  if (isModerationRoute || isCourseRoute) return <Navigate to="/forum" replace />

  const title = routeCategoryId
    ? categories.find((category) => String(category.id) === routeCategoryId)?.name || 'Chuyên mục'
    : routeFacultyId
        ? faculties.find((faculty) => String(faculty.id) === routeFacultyId)?.name || 'Khoa'
        : routeMajorId
          ? majors.find((major) => String(major.id) === routeMajorId)?.name || 'Chuyên ngành'
          : 'Diễn đàn học tập'

  return (
    <div className="forum-page">
      <div className="forum-page-inner">
        <nav className="forum-breadcrumb" aria-label="Điều hướng">
          <Link to="/forum">Cộng đồng học tập</Link>
          <span aria-hidden="true">/</span>
          {isDetail ? <Link to="/forum">Diễn đàn</Link> : <span>{isNew ? 'Đăng bài' : title}</span>}
          {isDetail && <><span aria-hidden="true">/</span><span>Chi tiết chủ đề</span></>}
        </nav>

        {isNew ? (
          <>
            <ForumHeader
              title="Đăng bài mới"
              description="Chia sẻ tài liệu, đặt câu hỏi, tìm nhóm đồ án hoặc trao đổi kinh nghiệm học tập cùng sinh viên CMC."
            />
            <section className="forum-panel forum-editor-panel">
              <div className="forum-section-heading">
                <h2>Thông tin bài đăng</h2>
                <p>Bài đăng sẽ xuất hiện ngay sau khi đăng. Chỉ đăng nội dung liên quan đến học tập và môn học.</p>
              </div>
              {error && <div className="forum-alert forum-alert-error" role="alert">{error}</div>}
              {notice && <div className="forum-alert forum-alert-success" role="status">{notice}</div>}
              <form className="forum-editor-form" onSubmit={handleCreateTopic}>
                <fieldset className="forum-type-picker">
                  <legend>Bạn muốn đăng gì?</legend>
                  <div className="forum-type-options">
                    {POST_TYPES.map((item) => (
                      <label
                        key={item.value}
                        className={`forum-type-option${postType === item.value ? ' is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={item.value}
                          checked={postType === item.value}
                          onChange={() => setPostType(item.value)}
                        />
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="forum-form-row forum-form-row-two">
                  <label className="forum-field">
                    <span>Khoa</span>
                    <select
                      name="facultyId"
                      value={selectedFaculty}
                      required
                      onChange={(event) => {
                        setSelectedFaculty(event.target.value)
                        setSelectedMajor('')
                      }}
                    >
                      <option value="">Chọn khoa</option>
                      {faculties.map((faculty) => (
                        <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="forum-field">
                    <span>Chuyên ngành <small>(không bắt buộc)</small></span>
                    <select
                      name="majorId"
                      value={selectedMajor}
                      disabled={!selectedFaculty}
                      onChange={(event) => setSelectedMajor(event.target.value)}
                    >
                      <option value="">{selectedFaculty ? 'Chọn chuyên ngành' : 'Chọn khoa trước'}</option>
                      {majors.filter((major) => String(major.facultyId) === String(selectedFaculty))
                        .map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
                      {selectedFaculty && !majors.some((major) => String(major.facultyId) === String(selectedFaculty))
                        && <option value="" disabled>Chưa có chuyên ngành cụ thể</option>}
                    </select>
                  </label>
                </div>
                {isResourceForm && (
                  <div className="forum-form-row forum-form-row-two">
                    <label className="forum-field">
                      <span>Loại tài liệu</span>
                      <select name="resourceKind" required defaultValue="STUDY_MATERIAL">
                        {RESOURCE_TYPES.map((resourceType) => (
                          <option key={resourceType.value} value={resourceType.value}>{resourceType.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="forum-field">
                      <span>Nguồn tài liệu <small>(không bắt buộc)</small></span>
                      <input name="source" maxLength={500} placeholder="Link hoặc thông tin trích dẫn nguồn" />
                    </label>
                  </div>
                )}
                <label className="forum-field">
                  <span>{currentPostType.titleLabel}</span>
                  <input
                    name="title"
                    required
                    maxLength={180}
                    placeholder={currentPostType.titlePlaceholder}
                  />
                </label>
                <label className="forum-field">
                  <span>{currentPostType.contentLabel}</span>
                  <textarea
                    name="content"
                    required
                    maxLength={30000}
                    rows={9}
                    placeholder={currentPostType.contentPlaceholder}
                  />
                </label>
                <label className="forum-field">
                  <span>Tệp đính kèm {isResourceForm ? '(bắt buộc)' : '(không bắt buộc)'} <small>(PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, MP4 · tối đa 50 MB)</small></span>
                  <input
                    name="file"
                    type="file"
                    required={isResourceForm}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.mp4"
                  />
                </label>
                <div className="forum-form-footer">
                  <p>{currentPostType.footer}</p>
                  <div className="forum-form-actions">
                    <Link className="forum-button forum-button-secondary" to="/forum">Hủy</Link>
                    <button className="forum-button forum-button-primary" type="submit" disabled={busy}>
                      {busy ? 'Đang đăng...' : currentPostType.submit}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </>
        ) : isDetail ? (
          <section className="forum-detail-layout">
            <main className="forum-detail-main">
              {detailLoading ? <div className="forum-panel forum-loading">Đang tải chủ đề...</div> : null}
              {error && !detailLoading && <div className="forum-alert forum-alert-error" role="alert">{error}</div>}
              {notice && <div className="forum-alert forum-alert-success" role="status">{notice}</div>}
              {detail && (
                <>
                  <article className="forum-panel forum-detail-card">
                    <div className="forum-detail-topline">
                      <span className={`forum-type-badge forum-type-${normalizeType(detail.type).toLowerCase()}`}>{typeLabel(detail.type)}</span>
                      {detail.category && <Link to={`/forum/categories/${detail.categoryId}`}>{detail.category}</Link>}
                      {detail.faculty && <Link to={`/forum/faculties/${detail.facultyId}`}>{detail.faculty}</Link>}
                      {detail.major && <Link to={`/forum/majors/${detail.majorId}`}>{detail.major}</Link>}
                      <time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time>
                    </div>
                    {detail.resourceKind && (
                      <span className="forum-type-badge forum-type-resource">
                        {RESOURCE_TYPES.find((item) => item.value === detail.resourceKind)?.label || 'Tài liệu học tập'}
                      </span>
                    )}
                    {editing ? (
                      <form className="forum-editor-form forum-edit-form" onSubmit={handleEdit}>
                        <label className="forum-field">
                          <span>Tiêu đề</span>
                          <input name="title" defaultValue={detail.title} required maxLength={180} />
                        </label>
                        <div className="forum-form-row">
                          {detail.type === 'RESOURCE' ? (
                            <div className="forum-field">
                              <span>Loại bài đăng</span>
                              <strong className="forum-field-static">{typeLabel(detail.type)}</strong>
                            </div>
                          ) : (
                            <label className="forum-field">
                              <span>Loại bài đăng</span>
                              <select name="type" defaultValue={normalizeType(detail.type)}>
                                {POST_TYPES.filter((item) => item.value !== 'RESOURCE').map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                        <label className="forum-field">
                          <span>Nội dung</span>
                          <textarea name="content" defaultValue={detail.content} required maxLength={30000} rows={9} />
                        </label>
                        <label className="forum-field">
                          <span>Nguồn tài liệu</span>
                          <input name="source" defaultValue={detail.source || ''} maxLength={500} />
                        </label>
                        <div className="forum-form-actions">
                          <button className="forum-button forum-button-secondary" type="button" onClick={() => setEditing(false)}>Hủy</button>
                          <button className="forum-button forum-button-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h1 className="forum-detail-title">{detail.title}</h1>
                        <div className="forum-author-line">
                          <Avatar src={detail.authorAvatar} name={detail.authorName} size={42} />
                          <div>
                            <strong>{detail.authorName}</strong>
                            <span>Thành viên cộng đồng · {formatDate(detail.createdAt)}</span>
                          </div>
                          {detail.authorId === user?.userId && (
                            <div className="forum-owner-actions">
                              <button type="button" onClick={() => setEditing(true)}>Chỉnh sửa</button>
                              <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy}>Xóa</button>
                            </div>
                          )}
                        </div>
                        <div className="forum-detail-content">{detail.content}</div>
                        {detail.source && <p className="forum-source"><strong>Nguồn:</strong> {detail.source}</p>}
                        {!!detail.attachments?.length && (
                          <div className="forum-attachments">
                            <h2>Tệp đính kèm</h2>
                            {detail.attachments.map((attachment) => (
                              <button key={attachment.id} type="button" onClick={() => handleDownload(attachment)}>
                                <span aria-hidden="true">↧</span>
                                <span>{attachment.name}</span>
                                <small>{(attachment.extension || attachment.name.split('.').pop()).toUpperCase()} · {formatFileSize(attachment.size)}</small>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="forum-detail-toolbar">
                          <button type="button" onClick={() => handleBookmark(detail.id, !savedIds.has(detail.id))}>
                            {savedIds.has(detail.id) ? 'Đã lưu chủ đề' : '☆ Lưu chủ đề'}
                          </button>
                          <span>{detail.viewCount || 0} lượt xem</span>
                          <button type="button" onClick={() => setReporting((current) => !current)}>Báo cáo</button>
                        </div>
                        {reporting && (
                          <form className="forum-report-form" onSubmit={handleReport}>
                            <label className="forum-field">
                              <span>Lý do báo cáo</span>
                              <textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} required maxLength={500} rows={3} />
                            </label>
                            <button className="forum-button forum-button-secondary" type="submit" disabled={busy}>Gửi báo cáo</button>
                          </form>
                        )}
                      </>
                    )}
                  </article>

                  {!editing && (
                    <section className="forum-panel forum-replies">
                      <div className="forum-section-heading">
                        <h2>Thảo luận <span>{detail.replies?.length || 0}</span></h2>
                        <p>Cùng nhau trao đổi để tìm câu trả lời tốt nhất.</p>
                      </div>
                      <form className="forum-reply-form" onSubmit={handleReply}>
                        <Avatar name={user?.displayName || user?.username} size={38} />
                        <label className="forum-field">
                          <span className="forum-sr-only">Nội dung trả lời</span>
                          <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Viết câu trả lời hoặc chia sẻ góc nhìn của bạn..." required maxLength={10000} rows={3} />
                        </label>
                        <button className="forum-button forum-button-primary" type="submit" disabled={busy || !reply.trim()}>
                          {busy ? 'Đang gửi...' : 'Gửi trả lời'}
                        </button>
                      </form>
                      <div className="forum-reply-list">
                        {detail.replies?.map((item) => (
                          <article className="forum-reply" key={item.id}>
                            <Avatar src={item.authorAvatar} name={item.author} size={38} />
                            <div>
                              <div className="forum-reply-meta"><strong>{item.author}</strong><time>{formatDate(item.createdAt)}</time></div>
                              <p>{item.content}</p>
                            </div>
                          </article>
                        ))}
                        {!detail.replies?.length && <p className="forum-empty-inline">Chưa có câu trả lời. Hãy bắt đầu cuộc thảo luận.</p>}
                      </div>
                    </section>
                  )}
                </>
              )}
            </main>
            <ForumSidebar topics={[]} showPopular={false} />
            {confirmingDelete && (
              <ConfirmDialog
                title="Xóa bài đăng?"
                message="Bài đăng sẽ bị xóa khỏi diễn đàn và bạn không thể hoàn tác thao tác này."
                confirmLabel="Xóa bài"
                busy={busy}
                onConfirm={handleDelete}
                onCancel={() => setConfirmingDelete(false)}
              />
            )}
          </section>
        ) : isCategoryIndex ? (
          <>
            <ForumHeader title="Khám phá diễn đàn" description="Tìm đúng nơi để hỏi đáp, chia sẻ tài liệu và học cùng nhau theo loại bài, khoa hoặc ngành." />
            <section className="forum-panel forum-categories-panel">
              <div className="forum-section-heading">
                <h2>Theo loại bài đăng</h2>
                <p>Chọn loại nội dung bạn đang cần.</p>
              </div>
              <ForumLinkGrid
                label="Loại bài đăng"
                items={POST_TYPES.map((item) => ({
                  key: item.value,
                  to: `/forum?type=${item.value}`,
                  title: item.label,
                  description: item.description,
                }))}
              />
            </section>
            <section className="forum-panel forum-categories-panel">
              <div className="forum-section-heading">
                <h2>Theo khoa và chuyên ngành</h2>
                <p>Xem bài đăng của khoa hoặc chuyên ngành bạn đang học.</p>
              </div>
              <div className="forum-faculty-list">
                {faculties.map((faculty) => {
                  const facultyMajors = majors.filter((major) => String(major.facultyId) === String(faculty.id))
                  return (
                    <article className="forum-faculty-item" key={faculty.id}>
                      <h3><Link to={`/forum/faculties/${faculty.id}`}>{faculty.name}</Link></h3>
                      {!!facultyMajors.length && (
                        <ul>
                          {facultyMajors.map((major) => (
                            <li key={major.id}><Link to={`/forum/majors/${major.id}`}>{major.name}</Link></li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )
                })}
                {!faculties.length && <p className="forum-empty-inline">Danh sách khoa đang được khởi tạo. Vui lòng tải lại sau ít phút.</p>}
              </div>
            </section>
          </>
        ) : isRulePage ? (
          <section className="forum-panel forum-rules">
            <ForumHeader title="Hướng dẫn cộng đồng" description="Một cộng đồng học tập hữu ích bắt đầu từ sự tôn trọng và chia sẻ có trách nhiệm." />
            <h2>Quy định diễn đàn</h2>
            <ul>
              <li>Chỉ đăng nội dung liên quan đến học tập, đồ án và định hướng học tập; bài không phù hợp có thể bị gỡ.</li>
              <li>Trao đổi lịch sự, tập trung vào nội dung và tôn trọng sự khác biệt.</li>
              <li>Đặt tiêu đề rõ ràng, cung cấp đủ bối cảnh khi đặt câu hỏi.</li>
              <li>Trích dẫn nguồn và chỉ chia sẻ tài liệu bạn có quyền sử dụng.</li>
              <li>Không đăng thông tin cá nhân, nội dung spam hoặc nội dung vi phạm pháp luật.</li>
            </ul>
          </section>
        ) : (
          <>
            <ForumHeader title={title} />
            <div className="forum-home-layout">
              <main className="forum-main-column">
                <section className="forum-panel forum-topics-panel">
                  <nav className="forum-topic-tabs" aria-label="Lọc loại bài đăng">
                    {TOPIC_TYPES.map((item) => {
                      const params = new URLSearchParams(location.search)
                      if (item.value) params.set('type', item.value)
                      else params.delete('type')
                      params.delete('page')
                      return (
                        <Link
                          key={item.value || 'all'}
                          className={type === item.value ? 'is-active' : ''}
                          to={`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                    <Link className={isCategoryIndex ? 'is-active' : ''} to="/forum/categories">Khám phá</Link>
                  </nav>
                  <div className="forum-topics-body">
                    <ForumFilters
                      q={q}
                      type={type}
                      facultyId={activeFacultyId}
                      majorId={activeMajorId}
                      sort={sort}
                      faculties={faculties}
                      majors={majors}
                      onChange={handleFilterChange}
                      onSearch={handleSearch}
                    />
                    <div className="forum-section-heading forum-topics-heading">
                      <div>
                        <span className="forum-section-kicker">{location.pathname === '/forum/search' ? 'TÌM KIẾM' : 'CỘNG ĐỒNG CMC'}</span>
                        <h2>{location.pathname === '/forum/search' ? 'Kết quả tìm kiếm' : type ? typeLabel(type) : 'Bài đăng mới nhất'}</h2>
                      </div>
                      <span className="forum-result-count">{totalElements} bài đăng</span>
                    </div>
                    {error && <div className="forum-alert forum-alert-error" role="alert">{error}</div>}
                    {notice && <div className="forum-alert forum-alert-success" role="status">{notice}</div>}
                    {loading ? (
                      <div className="forum-loading" role="status"><span className="forum-spinner" /> Đang tải chủ đề...</div>
                    ) : topics.length ? (
                      <div className="forum-topic-list">
                        {topics.map((topic) => (
                          <TopicCard
                            key={topic.id}
                            topic={topic}
                            saved={savedIds.has(topic.id)}
                            onBookmark={handleBookmark}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="forum-empty-state">
                        <span className="forum-empty-icon"><BookOpenIcon size={25} /></span>
                        <h3>Chưa có chủ đề phù hợp</h3>
                        <p>Thử đổi từ khóa hoặc bộ lọc, hoặc đăng bài đầu tiên để khởi động cuộc trò chuyện.</p>
                        <Link className="forum-button forum-button-primary" to={`/forum/new${type ? `?type=${type}` : ''}`}>Đăng bài</Link>
                      </div>
                    )}
                    <div className="forum-pagination">
                      <button type="button" disabled={page <= 0 || loading} onClick={() => setPage((value) => value - 1)}>←</button>
                      <span>Trang {totalPages ? page + 1 : 0} / {totalPages || 0}</span>
                      <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>→</button>
                    </div>
                  </div>
                </section>
              </main>
              <ForumSidebar topics={topics} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
