import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { friendApi } from '../api/friendApi'
import { groupApi } from '../api/groupApi'
import { conversationApi } from '../api/conversationApi'
import Avatar from '../components/Avatar'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import './NotificationsPage.styles.css'

function formatNotificationDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function NotificationMark({ type }) {
  return <span className={`notifications-mark notifications-mark--${type}`} aria-hidden="true">{type === 'friend' ? '♙' : '◎'}</span>
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [friendRequests, setFriendRequests] = useState([])
  const [groupNotifications, setGroupNotifications] = useState([])
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const loadNotifications = () => {
    setError('')
    Promise.all([friendApi.received(), groupApi.notifications()])
      .then(([friends, groups]) => {
        setFriendRequests(friends.data || [])
        setGroupNotifications(groups.data || [])
      })
      .catch((err) => setError(err.response?.data?.message || 'Không thể tải thông báo. Vui lòng thử lại.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadNotifications() }, [])

  const items = useMemo(() => [
    ...friendRequests.map((request) => ({
      id: `friend-${request.id}`,
      type: 'friend',
      createdAt: request.createdAt,
      unread: true,
      request,
    })),
    ...groupNotifications.map((notification) => ({
      id: `group-${notification.id}`,
      type: 'group',
      createdAt: notification.createdAt,
      unread: !notification.read,
      notification,
    })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [friendRequests, groupNotifications])

  const visibleItems = tab === 'unread' ? items.filter((item) => item.unread) : items
  const unreadCount = items.filter((item) => item.unread).length

  const respondToFriendRequest = async (request, accept) => {
    setBusyId(`friend-${request.id}`)
    setActionError('')
    try {
      if (accept) {
        await friendApi.accept(request.id)
        setFriendRequests((current) => current.filter((item) => item.id !== request.id))
        window.dispatchEvent(new Event('cmctalk-conversations-updated'))
        try {
          const { data } = await conversationApi.getOrCreatePrivate(request.senderId)
          navigate(`/chat/${data.conversationId}`)
        } catch (err) {
          setActionError(err.response?.data?.message || 'Lời mời đã được chấp nhận nhưng không thể mở cuộc trò chuyện.')
        }
      } else {
        await friendApi.reject(request.id)
        setFriendRequests((current) => current.filter((item) => item.id !== request.id))
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể xử lý lời mời. Vui lòng thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  const markRead = async (notification) => {
    if (notification.read) {
      navigate(`/groups/${notification.groupId}`)
      return
    }
    setBusyId(`group-${notification.id}`)
    setActionError('')
    try {
      await groupApi.markNotificationRead(notification.id)
      setGroupNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))
      navigate(`/groups/${notification.groupId}`)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể cập nhật thông báo. Vui lòng thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  const respondToGroupInvite = async (notification, approved) => {
    setBusyId(`group-${notification.id}`)
    setActionError('')
    try {
      await groupApi.respondInvite(notification.referenceId, approved)
      setGroupNotifications((current) => current.filter((item) => item.id !== notification.id))
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể xử lý lời mời vào nhóm. Vui lòng thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  const markAllRead = async () => {
    const unreadGroups = groupNotifications.filter((item) => !item.read)
    setBusyId('mark-all')
    setActionError('')
    try {
      await Promise.all(unreadGroups.map((item) => groupApi.markNotificationRead(item.id)))
      setGroupNotifications((current) => current.map((item) => ({ ...item, read: true })))
      setMenuOpen(false)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="notifications-page">
      <div className="notifications-content">
        <header className="notifications-header">
          <div>
            <span className="notifications-eyebrow">CMC TALK · CẬP NHẬT MỚI</span>
            <h1>Thông báo</h1>
            <p>Cập nhật lời mời kết bạn và hoạt động trong các nhóm của bạn.</p>
          </div>
          <div className="notifications-menu-wrap">
            <button
              type="button"
              className="notifications-menu-trigger"
              aria-label="Tùy chọn thông báo"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >···</button>
            {menuOpen && (
              <div className="notifications-menu">
                <button type="button" disabled={busyId === 'mark-all' || !groupNotifications.some((item) => !item.read)} onClick={markAllRead}>
                  Đánh dấu thông báo nhóm đã đọc
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('cmctalk-open-settings')) }}>
                  Cài đặt thông báo
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="notifications-toolbar">
          <div className="notifications-tabs" role="tablist" aria-label="Lọc thông báo">
            <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Tất cả</button>
            <button type="button" role="tab" aria-selected={tab === 'unread'} className={tab === 'unread' ? 'active' : ''} onClick={() => setTab('unread')}>Chưa đọc{unreadCount > 0 && <span>{unreadCount}</span>}</button>
          </div>
          <span className="notifications-count">{items.length} thông báo</span>
        </div>

        {actionError && <div className="notifications-action-error" role="alert">{actionError}</div>}
        {loading && <div className="notifications-state"><LoadingState label="Đang tải thông báo..." /></div>}
        {!loading && error && <div className="notifications-state"><ErrorState title="Không tải được thông báo" message={error} onRetry={() => { setLoading(true); loadNotifications() }} /></div>}
        {!loading && !error && visibleItems.length === 0 && (
          <div className="notifications-empty">
            <span aria-hidden="true">✓</span>
            <strong>{tab === 'unread' ? 'Bạn đã xem hết thông báo mới' : 'Chưa có thông báo nào'}</strong>
            <p>Khi có lời mời kết bạn hoặc hoạt động mới trong nhóm, thông báo sẽ xuất hiện ở đây.</p>
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <section className="notifications-list" aria-label="Danh sách thông báo">
            {visibleItems.map((item) => {
              if (item.type === 'friend') {
                const request = item.request
                const busy = busyId === item.id
                return (
                  <article className={`notification-card ${item.unread ? 'is-unread' : ''}`} key={item.id}>
                    <Avatar src={request.senderAvatar} name={request.senderDisplayName} size={52} />
                    <NotificationMark type="friend" />
                    <div className="notification-copy">
                      <p><strong>{request.senderDisplayName}</strong> đã gửi cho bạn lời mời kết bạn.</p>
                      <time>{formatNotificationDate(request.createdAt)}</time>
                      <div className="notification-actions">
                        <button type="button" className="ui-button ui-button--primary notification-accept" disabled={busy} onClick={() => respondToFriendRequest(request, true)}>Xác nhận</button>
                        <button type="button" className="ui-button ui-button--quiet notification-dismiss" disabled={busy} onClick={() => respondToFriendRequest(request, false)}>Xóa</button>
                      </div>
                    </div>
                    {item.unread && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
                  </article>
                )
              }

              const notification = item.notification
              const busy = busyId === item.id
              const isInvite = notification.type === 'INVITE'
              return (
                <article className={`notification-card ${item.unread ? 'is-unread' : ''}`} key={item.id}>
                  <NotificationMark type="group" />
                  <div className="notification-copy">
                    <p><strong>{notification.groupName}</strong> {notification.message}</p>
                    <time>{formatNotificationDate(notification.createdAt)}</time>
                    {isInvite && (
                      <div className="notification-actions">
                        <button type="button" className="ui-button ui-button--primary notification-accept" disabled={busy} onClick={() => respondToGroupInvite(notification, true)}>Tham gia</button>
                        <button type="button" className="ui-button ui-button--quiet notification-dismiss" disabled={busy} onClick={() => respondToGroupInvite(notification, false)}>Từ chối</button>
                      </div>
                    )}
                  </div>
                  {!isInvite && <button type="button" className="notification-open" disabled={busy} onClick={() => markRead(notification)}>Mở nhóm</button>}
                  {item.unread && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}
