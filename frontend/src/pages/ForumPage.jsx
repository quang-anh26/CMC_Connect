<<<<<<< HEAD
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
=======
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRightIcon,
  BookOpenIcon,
  FileIcon,
  FolderIcon,
  FriendsIcon,
  SearchIcon,
  TopicIcon,
} from '../components/Icons'
import './ForumPage.css'

const topicTypes = [
  { value: '', label: 'Tất cả chủ đề', tab: 'Tất cả chủ đề' },
  { value: 'QUESTION', label: 'Hỏi đáp', tab: 'Hỏi đáp' },
  { value: 'DISCUSSION', label: 'Thảo luận', tab: 'Thảo luận' },
  { value: 'RESOURCE', label: 'Chia sẻ tài liệu', tab: 'Chia sẻ tài liệu' },
]

const suggestedCategories = [
  'Lập trình',
  'Cơ sở ngành',
  'Đồ án và bài tập',
  'Kỹ năng học tập',
  'Tài liệu chung',
]

function getPage(pathname) {
  if (pathname === '/forum/new') return 'new'
  if (pathname === '/forum/admin') return 'admin'
  if (pathname === '/forum/moderation') return 'moderation'
  if (pathname === '/forum/search') return 'search'
  if (pathname === '/forum/categories') return 'category-list'
  if (pathname === '/forum/courses') return 'course-list'
  if (/^\/forum\/topics\/[^/]+$/.test(pathname)) return 'topic'
  if (/^\/forum\/categories\/[^/]+$/.test(pathname)) return 'category'
  if (/^\/forum\/courses\/[^/]+$/.test(pathname)) return 'course'
  return 'home'
}

function BackendNotice() {
  return (
    <div className="forum-connection-notice" role="status">
      <span className="forum-connection-indicator" aria-hidden="true" />
      <p><strong>Giao diện Forum</strong> — API, dữ liệu và lưu trữ tài liệu chưa được kết nối. Thao tác hiện chưa được lưu.</p>
    </div>
  )
}

function EmptyForumState({ title, children, icon: Icon = BookOpenIcon, compact = false }) {
  return (
    <div className={`forum-empty-state${compact ? ' is-compact' : ''}`}>
      <span className="forum-empty-icon"><Icon size={compact ? 20 : 24} /></span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
>>>>>>> origin/main
      </div>
    </div>
  )
}

<<<<<<< HEAD
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
=======
function TopicTabs({ location }) {
  const activeType = new URLSearchParams(location.search).get('type') || ''
  const isCategoryPage = location.pathname === '/forum/categories'

  return (
    <nav className="forum-tabs" aria-label="Lọc chủ đề Forum">
      {topicTypes.map((type) => (
        <Link
          key={type.value || 'all'}
          to={type.value ? `/forum?type=${type.value}` : '/forum'}
          className={`forum-tab${!isCategoryPage && activeType === type.value ? ' active' : ''}`}
          aria-current={!isCategoryPage && activeType === type.value ? 'page' : undefined}
        >
          {type.tab}
        </Link>
      ))}
      <Link
        to="/forum/categories"
        className={`forum-tab${isCategoryPage ? ' active' : ''}`}
        aria-current={isCategoryPage ? 'page' : undefined}
      >
        Danh mục
      </Link>
    </nav>
  )
}

function ForumHelpSidebar() {
  return (
    <aside className="forum-aside" aria-label="Thông tin Forum">
      <section className="forum-aside-section forum-info-card">
        <div className="forum-aside-title">
          <span className="forum-aside-icon is-resource"><FileIcon size={17} /></span>
          <h2>Chia sẻ tài liệu</h2>
        </div>
        <p>Chọn tài liệu có nguồn rõ ràng, ghi thông tin môn học và mô tả ngắn nội dung trước khi chia sẻ.</p>
        <Link to="/forum/new?type=RESOURCE">Tạo bài chia sẻ <ArrowRightIcon size={15} /></Link>
      </section>
      <section className="forum-aside-section forum-info-card">
        <div className="forum-aside-title">
          <span className="forum-aside-icon is-question"><TopicIcon size={17} /></span>
          <h2>Đặt câu hỏi hiệu quả</h2>
        </div>
        <ul>
          <li>Viết tiêu đề cụ thể, nêu rõ vấn đề.</li>
          <li>Thêm bối cảnh và điều bạn đã thử.</li>
          <li>Không đăng thông tin cá nhân hoặc nội dung vi phạm.</li>
        </ul>
        <Link to="/forum/new?type=QUESTION">Đặt câu hỏi <ArrowRightIcon size={15} /></Link>
      </section>
      <section className="forum-aside-section forum-info-card">
        <div className="forum-aside-title">
          <span className="forum-aside-icon is-community"><FriendsIcon size={17} /></span>
          <h2>Quy định cộng đồng</h2>
        </div>
        <p>Tôn trọng người học khác, trích dẫn nguồn và chỉ chia sẻ tài liệu bạn có quyền sử dụng.</p>
      </section>
      <section className="forum-aside-section forum-info-card forum-popular-card">
        <div className="forum-aside-title">
          <span className="forum-aside-icon is-category"><FolderIcon size={17} /></span>
          <h2>Danh mục được quan tâm</h2>
        </div>
        <p>Danh mục nổi bật sẽ xuất hiện khi Forum có dữ liệu thực tế.</p>
        <span className="forum-aside-empty">Chưa có dữ liệu</span>
>>>>>>> origin/main
      </section>
    </aside>
  )
}

<<<<<<< HEAD
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
=======
function ForumHeader({ isCategoryPage = false }) {
  return (
    <header className="forum-page-header">
      <div className="forum-header-copy">
        <span className="forum-hero-mark" aria-hidden="true"><BookOpenIcon size={31} /></span>
        <div>
          <span className="forum-eyebrow">STUDY FORUM · CMC</span>
          <h1>{isCategoryPage ? 'Danh mục học tập' : 'Forum chia sẻ tài liệu học tập'}</h1>
          <p>Không gian trao đổi kiến thức, hỏi đáp và chia sẻ tài liệu dành cho sinh viên Đại học CMC.</p>
        </div>
      </div>
      {!isCategoryPage && (
        <div className="forum-header-actions">
          <Link className="forum-primary-button" to="/forum/new">
            Tạo chủ đề <span aria-hidden="true">+</span>
          </Link>
          <Link className="forum-secondary-button forum-share-button" to="/forum/new?type=RESOURCE">
            <FileIcon size={15} /> Chia sẻ tài liệu
          </Link>
        </div>
      )}
    </header>
  )
}

function ForumFilters({ location, navigate }) {
  const params = new URLSearchParams(location.search)
  const [query, setQuery] = useState(params.get('q') || '')
  const [topicType, setTopicType] = useState(params.get('type') || '')

  const submitSearch = (event) => {
    event.preventDefault()
    const nextParams = new URLSearchParams()
    if (query.trim()) nextParams.set('q', query.trim())
    if (topicType) nextParams.set('type', topicType)
    const search = nextParams.toString()
    navigate(`/forum/search${search ? `?${search}` : ''}`)
  }

  return (
    <form className="forum-search-form" onSubmit={submitSearch}>
      <label className="forum-search-field">
        <SearchIcon size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm câu hỏi, tài liệu, chủ đề..."
          aria-label="Tìm kiếm Forum"
        />
      </label>
      <label className="forum-filter-field">
        <span className="sr-only">Lọc theo loại nội dung</span>
        <select value={topicType} onChange={(event) => setTopicType(event.target.value)}>
          {topicTypes.map((type) => <option key={type.value || 'all'} value={type.value}>{type.label}</option>)}
        </select>
      </label>
      <label className="forum-filter-field">
        <span className="sr-only">Lọc theo danh mục</span>
        <select disabled defaultValue="">
          <option value="">Danh mục</option>
        </select>
      </label>
      <label className="forum-filter-field">
        <span className="sr-only">Lọc theo môn học</span>
        <select disabled defaultValue="">
          <option value="">Môn học</option>
        </select>
      </label>
      <label className="forum-filter-field">
        <span className="sr-only">Lọc theo tag</span>
        <select disabled defaultValue="">
          <option value="">Tag</option>
        </select>
      </label>
      <label className="forum-filter-field forum-sort-field">
        <span className="sr-only">Sắp xếp chủ đề</span>
        <select disabled defaultValue="latest">
          <option value="latest">Mới nhất</option>
        </select>
      </label>
      <button type="submit" className="forum-search-submit">Tìm kiếm</button>
>>>>>>> origin/main
    </form>
  )
}

<<<<<<< HEAD
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
=======
function TopicList({ isSearch = false, query = '' }) {
  return (
    <section className="forum-topic-list" aria-label="Danh sách chủ đề">
      <div className="forum-topic-list-heading">
        <span>Chủ đề</span>
        <span>Trả lời</span>
        <span>Lượt xem</span>
        <span>Hoạt động</span>
      </div>
      <EmptyForumState title={isSearch ? 'Chưa có kết quả tìm kiếm' : 'Chưa có chủ đề'} icon={TopicIcon} compact>
        {isSearch && query
          ? `Kết quả cho “${query}” sẽ hiển thị khi API tìm kiếm Forum được kết nối.`
          : 'Danh sách chủ đề sẽ hiển thị tại đây sau khi backend Forum được tích hợp. Chưa có chủ đề hoặc số liệu nào được tạo sẵn.'}
      </EmptyForumState>
    </section>
  )
}

function ForumHome({ location, navigate }) {
  const search = new URLSearchParams(location.search)
  const query = search.get('q') || ''

  return (
    <>
      <TopicTabs location={location} />
      <section className="forum-content-section">
        <div className="forum-list-title">
          <div>
            <h2>{location.pathname === '/forum/search' ? 'Kết quả tìm kiếm' : 'Chủ đề mới nhất'}</h2>
            <p>{location.pathname === '/forum/search' ? 'Tìm trong câu hỏi, thảo luận và tài liệu' : 'Trao đổi mới nhất từ cộng đồng học tập'}</p>
          </div>
          <span className="forum-data-status">Chưa có dữ liệu</span>
        </div>
        <ForumFilters key={`${location.pathname}${location.search}`} location={location} navigate={navigate} />
        <TopicList isSearch={location.pathname === '/forum/search'} query={query} />
        <div className="forum-pagination">
          <span>Chưa có kết quả để phân trang</span>
          <button type="button" disabled aria-label="Trang trước">‹</button>
          <button type="button" disabled aria-label="Trang sau">›</button>
        </div>
      </section>
    </>
  )
}

function CategoryDirectory() {
  return (
    <>
      <TopicTabs location={{ pathname: '/forum/categories', search: '' }} />
      <section className="forum-content-section">
        <div className="forum-list-title">
          <div>
            <h2>Cấu trúc danh mục</h2>
            <p>Nhóm nội dung có thể được quản trị viên cấu hình trong Forum.</p>
          </div>
          <span className="forum-data-status">Chưa được cấu hình</span>
        </div>
        <div className="forum-suggested-categories">
          <div className="forum-category-legacy">
            <div className="forum-suggested-note">
              Đây là gợi ý cấu trúc, không phải dữ liệu danh mục đã được tạo hoặc khoa/ngành chính thức của CMC.
            </div>
            {suggestedCategories.map((category, index) => (
              <div className="forum-category-row" key={category}>
                <span className="forum-category-index">{String(index + 1).padStart(2, '0')}</span>
                <strong>{category}</strong>
                <span className="forum-category-state">Gợi ý · chưa cấu hình</span>
              </div>
            ))}
          </div>
          <div className="forum-category-desktop-tree">
            <div className="forum-category-tree-heading">
              <BookOpenIcon size={18} />
              <div>
                <strong>Danh mục gợi ý</strong>
                <span>Chưa được cấu hình trong hệ thống</span>
              </div>
            </div>
            <div className="forum-category-tree" role="list" aria-label="Các nhóm nội dung gợi ý">
              {suggestedCategories.map((category) => (
                <div className="forum-category-node" role="listitem" key={category}>
                  <span className="forum-category-node-marker" aria-hidden="true" />
                  <span>{category}</span>
                </div>
              ))}
            </div>
            <p className="forum-category-tree-note">
              Đây là gợi ý cấu trúc, không phải dữ liệu danh mục đã được tạo hoặc khoa/ngành chính thức của CMC.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

const topicTypeOptions = [
  { value: 'QUESTION', label: 'Câu hỏi học tập', description: 'Nêu vấn đề và nhận câu trả lời từ cộng đồng.', icon: TopicIcon },
  { value: 'DISCUSSION', label: 'Thảo luận', description: 'Trao đổi quan điểm và kiến thức theo chủ đề.', icon: BookOpenIcon },
  { value: 'RESOURCE', label: 'Chia sẻ tài liệu', description: 'Giới thiệu giáo trình, bài tập hoặc tài liệu tham khảo.', icon: FileIcon },
]

function CreateTopicPage({ location }) {
  const initialType = new URLSearchParams(location.search).get('type')
  const [topicType, setTopicType] = useState(topicTypeOptions.some((type) => type.value === initialType) ? initialType : 'QUESTION')

  return (
    <section className="forum-content-section forum-editor-panel">
      <div className="forum-list-title">
        <div>
          <h2>Tạo chủ đề mới</h2>
          <p>Chọn loại nội dung phù hợp để cộng đồng dễ tìm và trao đổi.</p>
        </div>
        <Link to="/forum" className="forum-back-link">Quay lại Forum</Link>
      </div>
      <BackendNotice />
      <form className="forum-editor-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="forum-topic-type-fieldset">
          <legend>Loại nội dung</legend>
          <div className="forum-topic-type-options">
            {topicTypeOptions.map(({ value, label, description, icon: Icon }) => (
              <label className={topicType === value ? 'selected' : ''} key={value}>
                <input
                  type="radio"
                  name="topicType"
                  value={value}
                  checked={topicType === value}
                  onChange={() => setTopicType(value)}
                />
                <Icon size={20} />
                <span className="forum-topic-type-copy"><strong>{label}</strong><small>{description}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="forum-form-field">
          <span>Tiêu đề</span>
          <input type="text" maxLength={180} placeholder="Ví dụ: Làm thế nào để phân tích độ phức tạp thuật toán?" />
        </label>
        <label className="forum-form-field">
          <span>Nội dung</span>
          <textarea rows={7} placeholder="Mô tả câu hỏi hoặc chia sẻ của bạn..." />
        </label>
        <div className="forum-editor-grid">
          <label className="forum-form-field">
            <span>Danh mục</span>
            <select disabled defaultValue="">
              <option value="">Danh mục chưa được cấu hình</option>
            </select>
          </label>
          <label className="forum-form-field">
            <span>Môn học (không bắt buộc)</span>
            <select disabled defaultValue="">
              <option value="">Chưa có dữ liệu môn học</option>
            </select>
          </label>
        </div>
        <label className="forum-form-field">
          <span>Tag</span>
          <input type="text" disabled placeholder="Tag sẽ có sau khi được quản trị viên cấu hình" />
        </label>
        {topicType === 'RESOURCE' && (
          <label className="forum-form-field forum-upload-field">
            <span>Tài liệu đính kèm</span>
            <input type="file" disabled />
            <small>Upload chưa khả dụng: chưa có API, lưu trữ riêng tư và chính sách file được phê duyệt.</small>
          </label>
        )}
        <div className="forum-form-actions">
          <Link className="forum-secondary-button" to="/forum">Hủy</Link>
          <button type="submit" className="forum-primary-button" disabled title="Chưa có API Forum">Chưa thể đăng</button>
        </div>
      </form>
    </section>
  )
}

function ForumUnavailablePage({ page, location }) {
  const search = new URLSearchParams(location.search)
  const query = search.get('q')
  const titles = {
    category: 'Danh mục học tập',
    'course-list': 'Môn học',
    course: 'Chủ đề theo môn học',
    topic: 'Chi tiết chủ đề',
    search: 'Tìm kiếm Forum',
    moderation: 'Kiểm duyệt nội dung',
    admin: 'Quản trị Forum',
  }
  const isModeration = page === 'moderation'
  const isAdmin = page === 'admin'
  const title = isModeration
    ? 'Chưa có hàng đợi kiểm duyệt'
    : isAdmin
      ? 'Chưa có dữ liệu quản trị'
      : page === 'topic'
        ? 'Không thể tải chủ đề'
        : page === 'search'
          ? 'Chưa có kết quả tìm kiếm'
          : 'Chưa có dữ liệu để hiển thị'
  const detail = page === 'search' && query
    ? `Tìm kiếm “${query}” sẽ hoạt động khi Forum API được kết nối.`
    : isModeration || isAdmin
      ? 'Các thao tác quản trị và phân quyền moderator cần API cùng backend authorization; giao diện hiện không cấp hay thực thi quyền.'
      : page === 'topic'
        ? 'Chi tiết, câu trả lời, accepted answer và báo cáo nội dung chưa thể tải hoặc gửi khi chưa có API Forum.'
        : 'Dữ liệu danh mục, môn học và chủ đề sẽ được nạp sau khi Forum backend sẵn sàng; hiện không có dữ liệu chính thức được tạo sẵn.'

  return (
    <section className="forum-content-section forum-unavailable-panel">
      <div className="forum-list-title">
        <div>
          <h2>{titles[page]}</h2>
          <p>Nội dung sẽ xuất hiện khi module Forum được kết nối.</p>
        </div>
        {isAdmin && <span className="forum-data-status">Admin UI</span>}
      </div>
      <BackendNotice />
      <EmptyForumState title={title} icon={isModeration ? TopicIcon : BookOpenIcon} compact>{detail}</EmptyForumState>
      {(isAdmin || isModeration) && (
        <div className="forum-admin-shortcuts">
          {['Danh mục', 'Môn học', 'Tag', 'Moderator theo danh mục', 'Báo cáo'].map((label) => (
            <button type="button" key={label} disabled title="Chưa có API quản trị Forum">{label}</button>
          ))}
        </div>
      )}
      {page === 'topic' && (
        <div className="forum-detail-actions">
          <button type="button" disabled>Báo cáo nội dung</button>
          <button type="button" disabled>Trả lời</button>
          <button type="button" disabled>Chọn câu trả lời được chấp nhận</button>
        </div>
      )}
      <Link to="/forum" className="forum-back-link">Quay lại trang chủ Forum</Link>
    </section>
  )
}

export default function ForumPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const page = getPage(location.pathname)
  const isCategoryPage = page === 'category-list' || page === 'category'
  const pageTitle = {
    home: 'Diễn đàn học tập',
    search: 'Tìm kiếm',
    new: 'Tạo chủ đề',
    'category-list': 'Danh mục',
    category: 'Chi tiết danh mục',
    'course-list': 'Môn học',
    course: 'Chi tiết môn học',
    topic: 'Chi tiết chủ đề',
    moderation: 'Kiểm duyệt',
    admin: 'Quản trị Forum',
  }[page] || 'Diễn đàn học tập'

  return (
    <div className="forum-page">
      <div className="forum-layout">
        <main className="forum-main">
          <div className="forum-breadcrumb">
            <span>FMESS-CMCU</span><span aria-hidden="true">/</span><strong>{pageTitle}</strong>
          </div>
          <div className="forum-columns">
            <div className="forum-main-column">
              {page === 'home' || page === 'search'
                ? (
                  <>
                    <ForumHeader />
                    <BackendNotice />
                    <ForumHome location={location} navigate={navigate} />
                  </>
                )
                : isCategoryPage
                  ? (
                    <>
                      <ForumHeader isCategoryPage />
                      <BackendNotice />
                      <CategoryDirectory />
                    </>
                  )
                  : page === 'new'
                    ? <CreateTopicPage location={location} />
                    : (
                      <>
                        <ForumHeader />
                        <ForumUnavailablePage page={page} location={location} />
                      </>
                    )}
            </div>
            {page !== 'new' && <ForumHelpSidebar />}
          </div>
        </main>
>>>>>>> origin/main
      </div>
    </div>
  )
}
