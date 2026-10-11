import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { conversationApi } from '../api/conversationApi'

export default function MessageRequestsPage() {
  const [requests, setRequests] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const loadRequests = () => {
      conversationApi.requests()
        .then((res) => mounted && setRequests(res.data || []))
        .catch(() => mounted && setRequests([]))
    }
    loadRequests()
    const timer = window.setInterval(loadRequests, 10000)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="chat-area">
      <div className="chat-header"><strong>Tin nhắn chờ</strong></div>
      <div className="friend-panel message-requests-panel">
        {requests.length === 0 ? (
          <p className="message-requests-empty">Chưa có tin nhắn chờ</p>
        ) : requests.map((request) => (
          <div key={request.conversationId} className="friend-request-row">
            <Avatar src={request.avatar} name={request.name} size={42} />
            <div className="message-request-info">
              <div className="message-request-name">{request.otherUserDisplayName || request.name || 'Người dùng'}</div>
              <div className="message-request-preview">{request.lastMessage || 'Đã gửi một tin nhắn'}</div>
            </div>
            <button
              type="button"
              className="btn-accept"
              onClick={() => navigate(`/chat/${request.conversationId}`)}
            >
              Trả lời
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}