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
      </div>
    </div>
  )
}

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
      </section>
    </aside>
  )
}

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
    </form>
  )
}

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
      </div>
    </div>
  )
}
