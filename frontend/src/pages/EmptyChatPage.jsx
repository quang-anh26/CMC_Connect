import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { conversationApi } from '../api/conversationApi'
import { MessengerLogo } from '../components/Icons'

export default function EmptyChatPage() {
  const navigate = useNavigate()

  useEffect(() => {
    conversationApi
      .list()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          // Auto-select first conversation (e.g. Alice) so user immediately enters chat
          navigate(`/chat/${res.data[0].conversationId}`, { replace: true })
        }
      })
      .catch(() => {})
  }, [navigate])

  return (
    <div className="chat-layout-wrapper">
      <div className="chat-area" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="chat-empty-welcome">
          <div className="chat-empty-orb">
            <MessengerLogo size={64} />
          </div>
          <p className="chat-empty-eyebrow">CMC TALK · KẾT NỐI MỖI NGÀY</p>
          <h2>
            Chào mừng bạn đến với CMC Talk
          </h2>
          <p>
            Chọn một cuộc trò chuyện từ danh sách bên trái hoặc sử dụng ô tìm kiếm để kết bạn và bắt đầu trò chuyện.
          </p>
        </div>
      </div>
    </div>
  )
}
