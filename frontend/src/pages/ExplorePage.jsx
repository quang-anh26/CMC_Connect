import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { exploreApi } from '../api/exploreApi'
import { feedApi } from '../api/feedApi'
import { friendApi } from '../api/friendApi'
import { groupApi } from '../api/groupApi'
import { userApi } from '../api/userApi'
import { useAuth } from '../context/AuthContext'

const tabs = [
  ['all', 'Tất cả'], ['posts', 'Bài viết'], ['users', 'Người dùng'],
  ['groups', 'Nhóm'], ['pages', 'Trang'], ['videos', 'Video'], ['hashtags', 'Hashtag'],
]
const storage = {
  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`kapatalk-explore-${key}`)) || fallback } catch { return fallback }
  },
  write(key, value) {
    try { localStorage.setItem(`kapatalk-explore-${key}`, JSON.stringify(value)) } catch {}
  },
}
const hashtagsIn = (text = '') => [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1].toLocaleLowerCase())
const displayName = (user) => user.displayName || user.username || 'Người dùng'
const isVideo = (post) => post.mediaType === 'VIDEO'

export default function ExplorePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [sort, setSort] = useState('popular')
  const [feed, setFeed] = useState([])
  const [hasMorePosts, setHasMorePosts] = useState(false)
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(() => storage.read('history', []))
  const [hiddenPosts, setHiddenPosts] = useState(() => storage.read('hidden-posts', []))
  const [hiddenTopics, setHiddenTopics] = useState(() => storage.read('hidden-topics', []))
  const [interests, setInterests] = useState(() => storage.read('interests', []))
  const [interestInput, setInterestInput] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(0)
  const [openComments, setOpenComments] = useState(() => new Set())
  const [commentDrafts, setCommentDrafts] = useState({})
  const [postingCommentId, setPostingCommentId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setPage(0)
    const timeout = window.setTimeout(() => exploreApi.posts({ q: query.trim(), videos: tab === 'videos', popular: sort === 'popular', page: 0, size: 8 })
      .then(({ data }) => {
        if (active) {
          setFeed(data.content || [])
          setHasMorePosts(!data.last)
          setError('')
        }
      })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Không thể tải bài viết khám phá.') })
      .finally(() => { if (active) setLoading(false) }), 220)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [query, sort, tab])

  useEffect(() => {
    let active = true
    groupApi.list().then(({ data }) => { if (active) setGroups(data || []) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const keyword = query.trim()
    if (keyword.length < 2) {
      setUsers([])
      if (!keyword) groupApi.list().then(({ data }) => setGroups(data || [])).catch(() => {})
      return undefined
    }
    let active = true
    const timeout = window.setTimeout(() => {
      setSearching(true)
      Promise.all([userApi.search(keyword), groupApi.list({ search: keyword })])
        .then(([userResponse, groupResponse]) => {
          if (!active) return
          setUsers(userResponse.data || [])
          setGroups((current) => {
            const matches = groupResponse.data || []
            return keyword ? matches : current
          })
        })
        .catch((err) => { if (active) setNotice(err.response?.data?.message || 'Không thể tìm kiếm lúc này.') })
        .finally(() => { if (active) setSearching(false) })
    }, 260)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [query])

  const trends = useMemo(() => {
    const counts = new Map()
    feed.forEach((post) => hashtagsIn(`${post.content || ''} ${post.sharedPost?.content || ''}`).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }))
    return [...counts.entries()].filter(([tag]) => !hiddenTopics.includes(tag))
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [feed, hiddenTopics])

  const posts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    let result = feed.filter((post) => !hiddenPosts.includes(post.postId))
    if (keyword) result = result.filter((post) => `${post.content || ''} ${post.sharedPost?.content || ''} ${post.authorName || ''}`.toLocaleLowerCase().includes(keyword))
    if (tab === 'videos') result = result.filter(isVideo)
    const interestScore = (post) => interests.reduce((score, term) => score + (`${post.content || ''} ${post.authorName || ''}`.toLocaleLowerCase().includes(term.toLocaleLowerCase()) ? 2 : 0), 0)
    if (!keyword && sort === 'popular') result.sort((a, b) => (b.likeCount + b.shareCount * 2 + interestScore(b)) - (a.likeCount + a.shareCount * 2 + interestScore(a)))
    return result
  }, [feed, hiddenPosts, interests, query, sort, tab])

  const matchingUsers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    return users.filter((item) => item.status !== 'LOCKED' && item.userId !== user?.userId && (!keyword || `${item.displayName || ''} ${item.username || ''} ${item.bio || ''}`.toLocaleLowerCase().includes(keyword)))
  }, [query, user, users])
  const matchingGroups = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    return groups.filter((item) => !keyword || `${item.name || ''} ${item.description || ''} ${item.category || ''}`.toLocaleLowerCase().includes(keyword))
  }, [groups, query])

  const activeItems = useMemo(() => {
    if (tab === 'users') return matchingUsers
    if (tab === 'groups') return matchingGroups
    if (tab === 'hashtags') return trends.filter(([tag]) => !query || tag.includes(query.replace(/^#/, '').toLocaleLowerCase()))
    if (tab === 'pages') return []
    return posts
  }, [matchingGroups, matchingUsers, posts, query, tab, trends])
  const pageSize = 8
  const pageItems = activeItems.slice(page * pageSize, (page + 1) * pageSize)
  const postsHaveMore = hasMorePosts && (tab === 'all' || tab === 'posts' || tab === 'videos')

  const goToNextPage = async () => {
    if ((page + 1) * pageSize >= activeItems.length && hasMorePosts && (tab === 'all' || tab === 'posts' || tab === 'videos')) {
      setLoading(true)
      try {
        const { data } = await exploreApi.posts({ q: query.trim(), videos: tab === 'videos', popular: sort === 'popular', page: Math.floor(feed.length / pageSize), size: pageSize })
        setFeed((current) => [...current, ...(data.content || [])])
        setHasMorePosts(!data.last)
      } catch (err) {
        setNotice(err.response?.data?.message || 'Không thể tải thêm bài viết.')
        return
      } finally { setLoading(false) }
    }
    setPage((value) => value + 1)
  }

  const searchFor = (value) => {
    const term = value.trim()
    if (!term) return
    setSuggestionsOpen(false)
    setQuery(term)
    setPage(0)
    const next = [term, ...history.filter((item) => item.toLocaleLowerCase() !== term.toLocaleLowerCase())].slice(0, 8)
    setHistory(next)
    storage.write('history', next)
  }
  const toggleComments = (postId) => {
    setOpenComments((current) => {
      const next = new Set(current)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }
  const submitComment = async (event, postId) => {
    event.preventDefault()
    const content = (commentDrafts[postId] || '').trim()
    if (!content || postingCommentId === postId) return
    setPostingCommentId(postId)
    try {
      const { data } = await feedApi.comment(postId, content)
      setFeed((current) => current.map((post) => post.postId === postId ? data : post))
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
    } catch (err) {
      setNotice(err.response?.data?.message || 'Không thể gửi bình luận.')
    } finally {
      setPostingCommentId(null)
    }
  }
  const hidePost = (postId) => {
    const next = [...new Set([...hiddenPosts, postId])]
    setHiddenPosts(next)
    storage.write('hidden-posts', next)
  }
  const hideTopic = (tag) => {
    const next = [...new Set([...hiddenTopics, tag])]
    setHiddenTopics(next)
    storage.write('hidden-topics', next)
  }
  const addInterest = (event) => {
    event.preventDefault()
    const value = interestInput.trim().replace(/^#/, '')
    if (!value) return
    const next = [...new Set([...interests, value])]
    setInterests(next)
    storage.write('interests', next)
    setInterestInput('')
  }
  const removeInterest = (value) => {
    const next = interests.filter((item) => item !== value)
    setInterests(next)
    storage.write('interests', next)
  }
  const submitSearch = (event) => { event.preventDefault(); searchFor(query) }

  const visibleTypes = (type) => tab === type || (tab === 'all' && type === 'posts')
  const showUserResults = tab === 'users' || (tab === 'all' && Boolean(query.trim()))
  const searchSuggestions = query.trim().length >= 2
    ? [...matchingUsers.slice(0, 3).map((item) => ({ label: displayName(item), meta: 'Người dùng' })),
      ...matchingGroups.slice(0, 2).map((item) => ({ label: item.name, meta: 'Nhóm' })),
      ...trends.filter(([tag]) => tag.includes(query.replace(/^#/, '').toLocaleLowerCase())).slice(0, 3).map(([tag]) => ({ label: `#${tag}`, meta: 'Hashtag' }))]
    : []

  return (
    <main className="explore-page">
      <header className="explore-header">
        <div className="explore-title"><span className="explore-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Khám phá</h1><p>Tìm những cuộc trò chuyện và cộng đồng đáng để quan tâm.</p></div>
        <form className="explore-search" onSubmit={submitSearch} onFocus={() => setSuggestionsOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false) }} role="search">
          <span className="explore-search-icon" aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); setPage(0) }} onKeyDown={(event) => { if (event.key === 'Enter') searchFor(query) }} placeholder="Tìm người, bài viết, nhóm, video, hashtag" aria-label="Tìm kiếm khám phá" />
          {query && <button type="button" className="explore-clear" onClick={() => { setQuery(''); setUsers([]); setPage(0); setSuggestionsOpen(false) }} aria-label="Xóa tìm kiếm">×</button>}
          <button className="explore-search-submit" type="submit">Tìm kiếm</button>
          {suggestionsOpen && searchSuggestions.length > 0 && <div className="explore-suggestions" role="listbox" aria-label="Gợi ý tìm kiếm">
            {searchSuggestions.map((item) => <button type="button" key={`${item.meta}-${item.label}`} onClick={() => searchFor(item.label)}><span>{item.label}</span><small>{item.meta}</small></button>)}
            {searching && <span className="explore-suggestion-loading">Đang tìm...</span>}
          </div>}
        </form>
        {!query.trim() && history.length > 0 && <div className="explore-history"><span>Tìm gần đây</span>{history.slice(0, 5).map((term) => <button type="button" key={term} onClick={() => searchFor(term)}>{term}</button>)}<button className="explore-history-clear" type="button" onClick={() => { setHistory([]); storage.write('history', []) }}>Xóa</button></div>}
        <nav className="explore-tabs" role="tablist" aria-label="Lọc kết quả khám phá">
          {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'selected' : ''} onClick={() => { setTab(value); setPage(0) }}>{label}</button>)}
        </nav>
      </header>

      <div className="explore-content">
        <div className="explore-primary-column">
          {visibleTypes('hashtags') && trends.length > 0 && <section className="explore-section explore-trends">
            <div className="explore-section-heading"><div><span className="explore-eyebrow">ĐANG ĐƯỢC NHẮC ĐẾN</span><h2>Xu hướng</h2></div><span className="explore-live-mark"><i /> Từ bài viết mới</span></div>
            <div className="explore-trend-list">{trends.slice(0, 6).map(([tag, count], index) => <button type="button" className="explore-trend" key={tag} onClick={() => { setTab('hashtags'); searchFor(`#${tag}`) }}><span className="explore-trend-rank">0{index + 1}</span><span className="explore-trend-copy"><strong>#{tag}</strong><small>{count} bài viết</small></span><span aria-hidden="true">↗</span></button>)}</div>
          </section>}

          {visibleTypes('posts') && tab !== 'videos' && <section className="explore-section">
            <div className="explore-section-heading"><div><span className="explore-eyebrow">DÀNH CHO BẠN</span><h2>{query ? 'Bài viết phù hợp' : 'Nội dung nổi bật'}</h2></div><div className="explore-post-sort" role="group" aria-label="Sắp xếp bài viết"><button type="button" className={sort === 'popular' ? 'selected' : ''} onClick={() => setSort('popular')}>Phổ biến</button><button type="button" className={sort === 'latest' ? 'selected' : ''} onClick={() => setSort('latest')}>Mới nhất</button></div></div>
            {loading ? <div className="explore-state"><span className="explore-spinner" />Đang tải nội dung...</div>
              : error && feed.length === 0 ? <div className="explore-state explore-error"><strong>Không tải được nội dung</strong><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Thử lại</button></div>
                : pageItems.filter((item) => item.postId).length === 0 && (tab === 'all' || tab === 'posts') ? <div className="explore-state"><strong>Chưa có bài viết phù hợp</strong><span>Thử tìm kiếm bằng từ khóa khác hoặc khám phá xu hướng.</span></div>
                  : <div className="explore-post-list">{pageItems.filter((item) => item.postId).map((post) => <article className="explore-post" key={post.postId}>
                    <div className="explore-post-author"><Link to={`/feed/profile/${post.authorId}`} className="explore-avatar">{post.authorAvatar ? <img src={post.authorAvatar} alt="" /> : (post.authorName || '?').slice(0, 1)}</Link><div><Link to={`/feed/profile/${post.authorId}`} className="explore-author-name">{post.authorName}</Link><time>{post.createdAt ? new Date(post.createdAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Mới đây'}</time></div><button type="button" className="explore-post-menu" title="Không quan tâm" aria-label="Không quan tâm bài viết" onClick={() => hidePost(post.postId)}>···</button></div>
                    {post.content && <p className="explore-post-text">{post.content}</p>}
                    {post.sharedPost && <div className="explore-shared-post"><span>Chia sẻ bài viết của {post.sharedPost.authorName}</span><p>{post.sharedPost.content}</p></div>}
                    {post.imageUrl && (isVideo(post) ? <video className="explore-post-media" src={post.imageUrl} controls preload="metadata" /> : <img className="explore-post-media" src={post.imageUrl} alt="Ảnh trong bài viết" loading="lazy" />)}
                    <div className="explore-post-stats"><span>{post.likeCount || 0} lượt thích</span><span>{post.comments?.length || 0} bình luận</span><span>{post.shareCount || 0} lượt chia sẻ</span></div>
                    <div className="explore-post-actions"><button type="button" onClick={async () => { try { const { data } = await exploreApi.like(post.postId); setFeed((current) => current.map((item) => item.postId === post.postId ? data : item)) } catch { setNotice('Không thể cập nhật lượt thích.') } }}>{post.likedByViewer ? '♥ Đã thích' : '♡ Thích'}</button><button type="button" aria-expanded={openComments.has(post.postId)} onClick={() => toggleComments(post.postId)}>Bình luận</button><button type="button" onClick={async () => { try { await exploreApi.share(post.postId); setNotice('Đã chia sẻ bài viết.') } catch { setNotice('Không thể chia sẻ bài viết.') } }}>Chia sẻ</button></div>
                    {openComments.has(post.postId) && <section className="explore-comments" aria-label={`Bình luận bài viết của ${post.authorName}`}>
                      {(post.comments || []).map((comment) => <div className="explore-comment" key={comment.commentId}><span className="explore-comment-avatar">{comment.authorAvatar ? <img src={comment.authorAvatar} alt="" /> : (comment.authorName || '?').slice(0, 1)}</span><div><strong>{comment.authorName}</strong><p>{comment.content}</p></div></div>)}
                      <form className="explore-comment-compose" onSubmit={(event) => submitComment(event, post.postId)}><input value={commentDrafts[post.postId] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.postId]: event.target.value }))} placeholder="Viết bình luận..." maxLength={1000} aria-label="Viết bình luận" /><button type="submit" disabled={postingCommentId === post.postId || !(commentDrafts[post.postId] || '').trim()}>{postingCommentId === post.postId ? 'Đang gửi...' : 'Gửi'}</button></form>
                    </section>}
                  </article>)}</div>}
          </section>}

          {showUserResults && <section className="explore-section">
            <div className="explore-section-heading"><div><span className="explore-eyebrow">KẾT NỐI MỚI</span><h2>{tab === 'all' ? 'Người dùng phù hợp' : 'Người dùng'}</h2></div></div>
            {query.length < 2 ? <div className="explore-state"><strong>Tìm người bạn muốn kết nối</strong><span>Nhập ít nhất 2 ký tự để tìm kiếm tài khoản.</span></div>
              : matchingUsers.length === 0 ? <div className="explore-state"><strong>Không tìm thấy người dùng</strong><span>Thử một tên hoặc từ khóa khác.</span></div>
                : <div className="explore-people-grid">{pageItems.map((person) => <article className="explore-person" key={person.userId}><Link to={`/feed/profile/${person.userId}`} className="explore-person-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : displayName(person).slice(0, 1)}</Link><Link to={`/feed/profile/${person.userId}`} className="explore-author-name">{displayName(person)}</Link><span className="explore-person-handle">@{person.username}</span>{person.bio && <p>{person.bio}</p>}<button type="button" onClick={async () => { try { await friendApi.send(person.userId); setNotice(`Đã gửi lời mời đến ${displayName(person)}.`) } catch (err) { setNotice(err.response?.data?.message || 'Không thể gửi lời mời kết bạn.') } }}>Thêm bạn bè</button></article>)}</div>}
          </section>}

          {visibleTypes('groups') && <section className="explore-section">
            <div className="explore-section-heading"><div><span className="explore-eyebrow">CỘNG ĐỒNG</span><h2>Nhóm có thể bạn quan tâm</h2></div><Link to="/groups">Xem tất cả nhóm</Link></div>
            {matchingGroups.length === 0 ? <div className="explore-state"><strong>Chưa tìm thấy nhóm phù hợp</strong><span>{query ? 'Thử từ khóa khác.' : 'Nhóm công khai sẽ xuất hiện ở đây.'}</span></div>
              : <div className="explore-group-list">{pageItems.map((group) => <article className="explore-group" key={group.groupId}><Link className="explore-group-art" to={`/groups/${group.groupId}`}>{group.coverImage ? <img src={group.coverImage} alt="" /> : <span>{(group.name || 'N').slice(0, 1)}</span>}</Link><div className="explore-group-copy"><Link to={`/groups/${group.groupId}`} className="explore-author-name">{group.name}</Link><span>{group.category || 'Cộng đồng'} · {group.memberCount || 0} thành viên</span><p>{group.description || 'Chưa có mô tả.'}</p></div><button type="button" onClick={async () => { try { const { data } = await groupApi.join(group.groupId); setNotice(data.status === 'JOINED' ? `Bạn đã tham gia ${group.name}.` : `Đã gửi yêu cầu tham gia ${group.name}.`) } catch (err) { setNotice(err.response?.data?.message || 'Không thể tham gia nhóm.') } }}>{group.joined ? 'Đã tham gia' : 'Tham gia'}</button></article>)}</div>}
          </section>}

          {tab === 'all' && matchingGroups.length > 0 && <section className="explore-section explore-group-recommendations">
            <div className="explore-section-heading"><div><span className="explore-eyebrow">CỘNG ĐỒNG CÔNG KHAI</span><h2>Nhóm có thể bạn quan tâm</h2></div><Link to="/groups">Xem tất cả</Link></div>
            <div className="explore-group-list">{matchingGroups.slice(0, 3).map((group) => <article className="explore-group" key={group.groupId}><Link className="explore-group-art" to={`/groups/${group.groupId}`}>{group.coverImage ? <img src={group.coverImage} alt="" /> : <span>{(group.name || 'N').slice(0, 1)}</span>}</Link><div className="explore-group-copy"><Link to={`/groups/${group.groupId}`} className="explore-author-name">{group.name}</Link><span>{group.category || 'Cộng đồng'} · {group.memberCount || 0} thành viên</span><p>{group.description || 'Chưa có mô tả.'}</p></div><button type="button" onClick={async () => { try { const { data } = await groupApi.join(group.groupId); setNotice(data.status === 'JOINED' ? `Bạn đã tham gia ${group.name}.` : `Đã gửi yêu cầu tham gia ${group.name}.`) } catch (err) { setNotice(err.response?.data?.message || 'Không thể tham gia nhóm.') } }}>{group.joined ? 'Đã tham gia' : 'Tham gia'}</button></article>)}</div>
          </section>}

          {tab === 'pages' && <section className="explore-section"><div className="explore-section-heading"><div><span className="explore-eyebrow">KHÁM PHÁ</span><h2>Trang</h2></div></div><div className="explore-state"><strong>Trang chưa được hỗ trợ</strong><span>Nền tảng hiện chưa có loại nội dung Trang.</span></div></section>}

          {tab === 'hashtags' && <section className="explore-section"><div className="explore-section-heading"><div><span className="explore-eyebrow">CHỦ ĐỀ CỘNG ĐỒNG</span><h2>Hashtag phổ biến</h2></div></div>{pageItems.length === 0 ? <div className="explore-state"><strong>Chưa có hashtag phù hợp</strong><span>Hashtag được trích xuất từ nội dung bài viết hiện có.</span></div> : <div className="explore-hashtag-list">{pageItems.map(([tag, count]) => <div className="explore-hashtag" key={tag}><button type="button" onClick={() => searchFor(`#${tag}`)}><strong>#{tag}</strong><span>{count} bài viết</span></button><button type="button" title="Ẩn chủ đề" aria-label={`Ẩn hashtag ${tag}`} onClick={() => hideTopic(tag)}>Ẩn</button></div>)}</div>}</section>}

          {(tab === 'all' || tab === 'videos') && tab === 'videos' && <section className="explore-section"><div className="explore-section-heading"><div><span className="explore-eyebrow">VIDEO TỪ CỘNG ĐỒNG</span><h2>Video phổ biến</h2></div></div>{pageItems.length === 0 && !loading ? <div className="explore-state"><strong>Chưa có video phù hợp</strong><span>Video được tìm từ các bài viết có tệp media video.</span></div> : <div className="explore-post-list">{pageItems.filter((item) => item.postId).map((post) => <article className="explore-post" key={post.postId}><div className="explore-post-author"><Link to={`/feed/profile/${post.authorId}`} className="explore-avatar">{post.authorAvatar ? <img src={post.authorAvatar} alt="" /> : (post.authorName || '?').slice(0, 1)}</Link><div><Link to={`/feed/profile/${post.authorId}`} className="explore-author-name">{post.authorName}</Link><time>{post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : 'Mới đây'}</time></div></div>{post.content && <p className="explore-post-text">{post.content}</p>}<video className="explore-post-media" src={post.imageUrl} controls preload="metadata" /><div className="explore-post-stats"><span>{post.likeCount || 0} lượt thích</span><span>{post.shareCount || 0} lượt chia sẻ</span></div></article>)}</div>}</section>}

          {(activeItems.length > pageSize || postsHaveMore) && <div className="explore-pagination"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Trước</button><span>{page + 1} / {Math.max(Math.ceil(activeItems.length / pageSize), postsHaveMore ? page + 2 : 1)}</span><button type="button" disabled={loading || ((page + 1) * pageSize >= activeItems.length && !postsHaveMore)} onClick={goToNextPage}>Tiếp</button></div>}
        </div>

        <aside className="explore-aside">
          <section className="explore-aside-section"><div className="explore-section-heading"><div><span className="explore-eyebrow">CÁ NHÂN HÓA</span><h2>Sở thích</h2></div></div><p>Ưu tiên nội dung khớp với các chủ đề bạn quan tâm.</p><form className="explore-interest-form" onSubmit={addInterest}><input value={interestInput} onChange={(event) => setInterestInput(event.target.value)} placeholder="Thêm chủ đề" aria-label="Thêm sở thích" /><button type="submit" aria-label="Thêm sở thích">+</button></form><div className="explore-interest-list">{interests.map((item) => <span key={item}>{item}<button type="button" onClick={() => removeInterest(item)} aria-label={`Xóa sở thích ${item}`}>×</button></span>)}</div>{interests.length === 0 && <small>Chưa thêm chủ đề yêu thích.</small>}</section>
          <section className="explore-aside-section"><div className="explore-section-heading"><div><span className="explore-eyebrow">ĐANG NỔI BẬT</span><h2>Chủ đề thịnh hành</h2></div></div>{trends.length === 0 ? <p>Chưa có hashtag thịnh hành trong bài viết hiện tại.</p> : <div className="explore-aside-trends">{trends.slice(0, 5).map(([tag, count]) => <div key={tag}><button type="button" onClick={() => { setTab('hashtags'); searchFor(`#${tag}`) }}>#{tag}</button><small>{count} bài viết</small><button className="explore-topic-hide" type="button" onClick={() => hideTopic(tag)} aria-label={`Ẩn ${tag}`}>×</button></div>)}</div>}</section>
          <section className="explore-aside-section explore-data-note"><strong>Đề xuất từ hoạt động thật</strong><p>Nội dung nổi bật dựa trên lượt thích, chia sẻ và các sở thích bạn đã lưu.</p></section>
        </aside>
      </div>
      {notice && <div className="explore-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
    </main>
  )
}