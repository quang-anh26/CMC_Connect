import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { BASE_URL } from '../api/axiosClient'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

/**
 * One shared STOMP connection for the whole app (plan section 6: realtime via WebSocket/STOMP).
 * Authenticates the CONNECT frame with the JWT Access Token (see StompAuthChannelInterceptor
 * on the backend). Exposes subscribe/publish helpers to pages/components.
 */
export function SocketProvider({ children }) {
  const { user } = useAuth()
  const clientRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [callSignal, setCallSignal] = useState(null)
  const [callRequest, setCallRequest] = useState(null)

  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('accessToken')
    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      onConnect: () => {
        setConnected(true)
        client.subscribe('/user/queue/call', (message) => setCallSignal(JSON.parse(message.body)))
        client.subscribe('/user/queue/errors', (message) => {
          const error = JSON.parse(message.body)
          window.dispatchEvent(new CustomEvent('cmctalk-server-error', {
            detail: error.message || 'Không thể thực hiện thao tác.',
          }))
        })
        client.subscribe('/user/queue/block-status', (message) => {
          window.dispatchEvent(new CustomEvent('cmctalk-block-status-changed', {
            detail: JSON.parse(message.body),
          }))
        })
      },
      onDisconnect: () => {
        setConnected(false)
        setCallSignal(null)
      },
      onStompError: () => setConnected(false),
    })
    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
      setConnected(false)
      setCallSignal(null)
    }
  }, [user])

  const subscribe = useCallback((destination, callback) => {
    if (!clientRef.current || !connected) return () => {}
    const sub = clientRef.current.subscribe(destination, (message) => {
      callback(JSON.parse(message.body))
    })
    return () => sub.unsubscribe()
  }, [connected])

  const publish = useCallback((destination, body) => {
    if (!clientRef.current || !connected) return
    clientRef.current.publish({ destination, body: JSON.stringify(body) })
  }, [connected])

  return (
    <SocketContext.Provider value={{
      connected,
      subscribe,
      publish,
      callSignal,
      clearCallSignal: () => setCallSignal(null),
      callRequest,
      startCall: (conversationInfo, callType) => setCallRequest({ ...conversationInfo, requestedCallType: callType }),
      clearCallRequest: () => setCallRequest(null),
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
