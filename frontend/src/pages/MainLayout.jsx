import React, { useEffect } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import AppTopBar from '../components/AppTopBar'
import Sidebar from '../components/Sidebar'
import CallOverlay from '../components/CallOverlay'
import { useSocket } from '../context/SocketContext'

export default function MainLayout() {
  const { conversationId } = useParams()
  const location = useLocation()
  const { callRequest, clearCallRequest } = useSocket()
  const isSocialPage = location.pathname.startsWith('/feed') || location.pathname.startsWith('/events') || location.pathname.startsWith('/groups') || location.pathname.startsWith('/notifications') || location.pathname.startsWith('/video') || location.pathname.startsWith('/saved') || location.pathname.startsWith('/friends')
  const shellClass = isSocialPage ? 'feed-shell' : 'nav-overlay-shell'

  useEffect(() => {
    const showServerError = (event) => window.alert(event.detail)
    window.addEventListener('cmctalk-server-error', showServerError)
    return () => window.removeEventListener('cmctalk-server-error', showServerError)
  }, [])

  return (
    <div className="app-frame">
      <AppTopBar />
      <div className={`app-shell ${shellClass}`}>
        {!isSocialPage && <Sidebar activeConversationId={conversationId} />}
        <Outlet />
        <CallOverlay
          conversationInfo={callRequest}
          visible={Boolean(callRequest)}
          onClose={clearCallRequest}
        />
      </div>
    </div>
  )
}
