import React from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import NavRail from '../components/NavRail'
import Sidebar from '../components/Sidebar'
import CallOverlay from '../components/CallOverlay'
import { useSocket } from '../context/SocketContext'

export default function MainLayout() {
  const { conversationId } = useParams()
  const location = useLocation()
  const { callRequest, clearCallRequest } = useSocket()
  const isSocialPage = location.pathname.startsWith('/feed') || location.pathname.startsWith('/events') || location.pathname.startsWith('/groups') || location.pathname.startsWith('/explore') || location.pathname.startsWith('/video') || location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/saved')
  const shellClass = isSocialPage ? 'feed-shell' : 'nav-overlay-shell'
  return (
    <div className={`app-shell ${shellClass}`}>
      <NavRail />
      {!isSocialPage && <Sidebar activeConversationId={conversationId} />}
      <Outlet />
      <CallOverlay
        conversationInfo={callRequest}
        visible={Boolean(callRequest)}
        onClose={clearCallRequest}
      />
    </div>
  )
}
