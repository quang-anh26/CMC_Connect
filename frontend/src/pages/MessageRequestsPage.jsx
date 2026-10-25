import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import { conversationApi } from '../api/conversationApi'
import { getApiErrorMessage } from '../utils/apiError'
import { MailIcon } from '../components/Icons'

export default function MessageRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)
  const navigate = useNavigate()

  // silent = true: lần tự làm mới mỗi 10 giây, không nháy trạng thái "đang tải"
  // và không đổi danh sách đang hiển thị thành màn hình lỗi nếu mạng chập chờn.
  const loadRequests = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const res = await conversationApi.requests()
      if (!mountedRef.current) return
      setRequests(res.data || [])
      setError('')
    } catch (err) {
      if (mountedRef.current && !silent) {
        setError(getApiErrorMessage(err, 'Không tải được danh sách tin nhắn chờ.'))
      }
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    loadRequests()
    const timer = window.setInterval(() => loadRequests(true), 10000)
    return () => {
      mountedRef.current = false
      window.clearInterval(timer)
    }
  }, [loadRequests])

  return (
    <div className="chat-area">
      <div className="chat-header"><strong>Tin nhắn chờ</strong></div>
      <div className="friend-panel message-requests-panel">
        {loading ? (
          <LoadingState variant="skeleton" lines={3} skeletonHeight={64} label="Đang tải tin nhắn chờ..." />
        ) : error && requests.length === 0 ? (
          <ErrorState title="Không tải được tin nhắn chờ" message={error} onRetry={() => loadRequests()} />
        ) : requests.length === 0 ? (
          <EmptyState icon={<MailIcon size={28} />} title="Chưa có tin nhắn chờ" description="Tin nhắn từ người chưa kết bạn sẽ xuất hiện ở đây." />
        ) : requests.map((request) => (
          <div key={request.conversationId} className="friend-request-row">
            <Avatar src={request.avatar} name={request.name} size={42} />
            <div className="message-request-info">
              <div className="message-request-name">{request.otherUserDisplayName || request.name || 'Người dùng'}</div>
              <div className="message-request-preview">{request.lastMessage || 'Đã gửi một tin nhắn'}</div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn-accept"
                onClick={() => navigate(`/chat/${request.conversationId}`)}
              >
                Trả lời
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
