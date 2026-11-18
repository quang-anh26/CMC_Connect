import React, { useEffect, useRef, useState } from 'react'
import { Avatar } from './ui'
import { Icon } from './Icon'
import { messageApi } from '../api/messageApi'
import { getApiErrorMessage } from '../utils/apiError'
import { useSocket } from '../context/SocketContext'

// STUN chỉ đủ khi 2 máy cùng mạng / NAT dễ. Khác mạng (4G, wifi công ty...) cần TURN.
// Thêm vào frontend/.env: VITE_TURN_URL=turn:ip-hoac-domain:3478  VITE_TURN_USER=...  VITE_TURN_PASS=...
const iceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]
if (import.meta.env.VITE_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_TURN_URL.split(','),
    username: import.meta.env.VITE_TURN_USER,
    credential: import.meta.env.VITE_TURN_PASS,
  })
}
const rtcConfig = { iceServers }

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  const hours = Math.floor(minutes / 60)
  const displayMinutes = minutes % 60
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(displayMinutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(displayMinutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function reportCallLogError(error) {
  window.dispatchEvent(new CustomEvent('cmctalk-server-error', {
    detail: getApiErrorMessage(error, 'Không thể lưu nhật ký cuộc gọi vào đoạn chat.'),
  }))
}

export default function CallOverlay({ conversationInfo, conversations = [], visible, onClose }) {
  const { publish, connected, callSignal, clearCallSignal } = useSocket()
  const [callState, setCallState] = useState('idle')
  const [callType, setCallType] = useState('audio')
  const [caller, setCaller] = useState(null)
  const [callConversation, setCallConversation] = useState(conversationInfo || null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [error, setError] = useState('')
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const connectedAtRef = useRef(null)
  const callTypeRef = useRef('audio')
  const callConversationRef = useRef(conversationInfo || null)
  const isInitiatorRef = useRef(false)
  const callLogSavedRef = useRef(false)
  const publishRef = useRef(publish)
  const connectedRef = useRef(connected)
  const signalChainRef = useRef(Promise.resolve())

  useEffect(() => {
    publishRef.current = publish
    connectedRef.current = connected
  }, [publish, connected])

  const activeConversation = conversationInfo || callConversation
  const callerUsername = typeof caller === 'string' ? caller : caller?.username
  const targetUsername = activeConversation?.otherUserUsername || callerUsername || callSignal?.fromUsername
  const targetName = activeConversation?.name || callerUsername || 'Người dùng'

  useEffect(() => {
    if (!conversationInfo) return
    setCallConversation(conversationInfo)
    callConversationRef.current = conversationInfo
  }, [conversationInfo])

  useEffect(() => {
    if (callConversation || !callerUsername) return
    const matchingConversation = conversations.find((item) => item.otherUserUsername === callerUsername)
    if (!matchingConversation) return
    setCallConversation(matchingConversation)
    callConversationRef.current = matchingConversation
  }, [callConversation, callerUsername, conversations])

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
    if (callType === 'video' && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
    if (callType === 'audio' && remoteAudioRef.current && remoteStream) {
      const audio = remoteAudioRef.current
      audio.srcObject = remoteStream
      audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true))
    }
  }, [remoteStream, callState, callType])

  useEffect(() => {
    if (callState !== 'connected' || !connectedAtRef.current) return undefined
    const updateDuration = () => {
      setElapsedSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000))
    }
    updateDuration()
    const timer = window.setInterval(updateDuration, 1000)
    return () => window.clearInterval(timer)
  }, [callState])

  const sendSignal = (payload) => {
    if (!connected || !targetUsername) return false
    publish('/app/call.signal', { ...payload, toUsername: targetUsername })
    return true
  }

  const cleanup = () => {
    peerRef.current?.close()
    peerRef.current = null
    pendingCandidatesRef.current = []
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    connectedAtRef.current = null
    isInitiatorRef.current = false
    setRemoteStream(null)
    setElapsedSeconds(0)
    setAudioBlocked(false)
    setCaller(null)
    setCallConversation(null)
    callConversationRef.current = null
    setCallState('idle')
    setError('')
  }

  const saveCallLog = async () => {
    if (!isInitiatorRef.current || callLogSavedRef.current) return
    callLogSavedRef.current = true
    const conversationId = callConversationRef.current?.conversationId
    if (!conversationId) {
      reportCallLogError(new Error('Không tìm thấy đoạn chat để lưu nhật ký cuộc gọi.'))
      return
    }

    const connectedAt = connectedAtRef.current
    const durationSeconds = connectedAt ? Math.floor((Date.now() - connectedAt) / 1000) : 0
    const content = `CALL_LOG:${JSON.stringify({
      status: connectedAt ? 'COMPLETED' : 'MISSED',
      callType: callTypeRef.current,
      durationSeconds,
    })}`
    try {
      await messageApi.send({
        conversationId: Number(conversationId),
        content,
        messageType: 'SYSTEM',
      })
    } catch (err) {
      reportCallLogError(err)
    }
  }

  const finish = () => {
    const saveLog = saveCallLog()
    sendSignal({ type: 'end' })
    cleanup()
    onClose?.()
    return saveLog
  }

  const createPeer = (remoteUsername) => {
    const peer = new RTCPeerConnection(rtcConfig)
    const stream = new MediaStream()
    peer.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStream(event.streams[0])
      } else {
        stream.addTrack(event.track)
        setRemoteStream(stream)
      }
    }
    peer.onicecandidate = (event) => {
      if (event.candidate && connectedRef.current) {
        publishRef.current('/app/call.signal', { toUsername: remoteUsername, type: 'candidate', candidate: event.candidate })
      }
    }
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') {
        setError('Không thiết lập được đường truyền âm thanh (có thể cần máy chủ TURN).')
        try { peer.restartIce() } catch { /* ignore */ }
      }
    }
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        setError(`Kết nối cuộc gọi ${peer.connectionState === 'failed' ? 'thất bại' : 'bị ngắt'}.`)
      }
    }
    peerRef.current = peer
    return peer
  }

  const mediaErrorMessage = (err, type, action) => {
    if (!window.isSecureContext) return 'Cuộc gọi cần HTTPS để trình duyệt cho phép dùng camera/micro.'
    if (!navigator.mediaDevices?.getUserMedia) return 'Trình duyệt không hỗ trợ truy cập camera/micro.'
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      return type === 'video' ? 'Hãy cấp quyền camera và micro để gọi video.' : 'Hãy cấp quyền micro để gọi thoại.'
    }
    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      return type === 'video' ? 'Không tìm thấy camera hoặc micro.' : 'Không tìm thấy micro.'
    }
    if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
      return 'Camera hoặc micro đang được ứng dụng khác sử dụng.'
    }
    return `${action}: ${err?.message || 'lỗi WebRTC'}.`
  }

  const flushPendingCandidates = async (peer) => {
    const pending = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const candidate of pending) {
      try { await peer.addIceCandidate(candidate) } catch { /* bỏ qua candidate lỗi */ }
    }
  }

  const startCall = async (type) => {
    if (!targetUsername || callState !== 'idle') return
    try {
      setError('')
      setCallType(type)
      callTypeRef.current = type
      callConversationRef.current = activeConversation
      isInitiatorRef.current = true
      callLogSavedRef.current = false
      connectedAtRef.current = null
      pendingCandidatesRef.current = []
      if (!connected) throw new Error('Máy chủ cuộc gọi chưa kết nối. Vui lòng thử lại.')
      if (typeof RTCPeerConnection === 'undefined') throw new Error('Trình duyệt không hỗ trợ WebRTC.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true })
      localStreamRef.current = stream
      const peer = createPeer(targetUsername)
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      if (!sendSignal({ type: 'offer', callType: type, offer })) {
        throw new Error('Không gửi được tín hiệu gọi. Hãy kiểm tra kết nối mạng rồi thử lại.')
      }
      setCallState('calling')
    } catch (err) {
      cleanup()
      setError(err?.name === 'Error' && err.message.startsWith('Máy chủ')
        ? err.message
        : mediaErrorMessage(err, type, 'Không thể bắt đầu cuộc gọi'))
    }
  }

  useEffect(() => {
    if (!visible) return
    if (!targetUsername) {
      setError('Không tìm thấy người nhận cuộc gọi.')
      return
    }
    if (!connected) {
      setError('Đang kết nối máy chủ cuộc gọi...')
      return
    }
    if (callState === 'idle') startCall(conversationInfo?.requestedCallType || 'audio')
  }, [visible, targetUsername, connected])

  const acceptCall = async () => {
    try {
      if (!connected) throw new Error('Máy chủ cuộc gọi chưa kết nối. Vui lòng thử lại.')
      if (!caller?.username || !caller?.offer) throw new Error('Thông tin cuộc gọi đến không hợp lệ.')
      if (typeof RTCPeerConnection === 'undefined') throw new Error('Trình duyệt không hỗ trợ WebRTC.')
      callTypeRef.current = callType
      isInitiatorRef.current = false
      // KHÔNG xoá pendingCandidatesRef ở đây: các candidate đến trước khi bấm "Nghe máy" đang nằm trong đó.
      const stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true })
      localStreamRef.current = stream
      const peer = createPeer(caller.username)
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      await peer.setRemoteDescription(new RTCSessionDescription(caller.offer))
      await flushPendingCandidates(peer)
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      if (!sendSignal({ type: 'answer', answer })) {
        throw new Error('Không gửi được tín hiệu nhận cuộc gọi. Hãy kiểm tra kết nối mạng rồi thử lại.')
      }
      connectedAtRef.current = Date.now()
      setCallState('connected')
    } catch (err) {
      cleanup()
      setError(err?.name === 'Error' && err.message.startsWith('Máy chủ')
        ? err.message
        : mediaErrorMessage(err, callType, 'Không thể nhận cuộc gọi'))
    }
  }

  useEffect(() => {
    if (!callSignal) return undefined
    const signal = callSignal
    clearCallSignal()
    // Xử lý tuần tự từng tín hiệu để candidate không chạy trước khi setRemoteDescription xong.
    signalChainRef.current = signalChainRef.current.then(async () => {
      try {
        if (signal.type === 'offer') {
          if (!signal.offer || !signal.fromUsername) throw new Error('Thiếu dữ liệu cuộc gọi đến')
          const matchingConversation = conversations.find((item) => item.otherUserUsername === signal.fromUsername)
          if (matchingConversation) {
            setCallConversation(matchingConversation)
            callConversationRef.current = matchingConversation
          }
          pendingCandidatesRef.current = []
          callTypeRef.current = signal.callType || 'audio'
          setCaller({ username: signal.fromUsername, offer: signal.offer })
          setCallType(signal.callType || 'audio')
          setCallState('incoming')
        } else if (signal.type === 'answer' && peerRef.current && signal.answer) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal.answer))
          await flushPendingCandidates(peerRef.current)
          connectedAtRef.current = Date.now()
          setCallState('connected')
        } else if (signal.type === 'candidate' && signal.candidate) {
          const candidate = new RTCIceCandidate(signal.candidate)
          if (peerRef.current?.remoteDescription) {
            try { await peerRef.current.addIceCandidate(candidate) } catch { /* bỏ qua */ }
          } else {
            pendingCandidatesRef.current.push(candidate)
          }
        } else if (signal.type === 'end' || signal.type === 'reject') {
          const saveLog = isInitiatorRef.current ? saveCallLog() : null
          cleanup()
          if (saveLog) await saveLog
          onClose?.()
        }
      } catch {
        setError('Kết nối cuộc gọi bị gián đoạn.')
      }
    })
    return undefined
  }, [callSignal])

  useEffect(() => cleanup, [])

  if (callState === 'idle' && !error && !visible) return null

  const statusText = callState === 'incoming'
    ? 'Cuộc gọi đến'
    : callState === 'connected'
      ? 'Đang trò chuyện'
      : callState === 'calling'
        ? 'Đang đổ chuông...'
        : 'Đang chuẩn bị cuộc gọi...'

  return (
    <div className={`call-overlay ${callType === 'video' ? 'is-video' : 'is-audio'}`}>
      <div className="call-card">
        <header className="call-topbar">
          <div>
            <strong>{callState === 'incoming' ? `${targetName} đang gọi` : targetName}</strong>
            <span>{statusText}</span>
          </div>
          <span className="call-kind">{callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}</span>
        </header>

        {callType === 'video' ? (
          <div className="call-video-stage">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <video ref={localVideoRef} autoPlay muted playsInline />
          </div>
        ) : (
          <div className="call-audio-stage">
            <Avatar src={activeConversation?.avatar} name={targetName} size="lg" />
            <strong>{targetName}</strong>
            <audio ref={remoteAudioRef} autoPlay playsInline />
            {audioBlocked && (
              <button type="button" className="call-audio-enable" onClick={() => {
                remoteAudioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => {
                  setError('Không thể phát âm thanh cuộc gọi. Hãy kiểm tra âm lượng và quyền trình duyệt.')
                })
              }}>
                Bật âm thanh
              </button>
            )}
          </div>
        )}

        <div className="call-live-status">
          <span className={callState === 'connected' ? 'is-live' : ''}>{callState === 'connected' ? 'Đã kết nối' : statusText}</span>
          {callState === 'connected' && <strong>{formatDuration(elapsedSeconds)}</strong>}
        </div>
        {error && <div className="call-error">{error}</div>}

        <div className="call-actions">
          {callState === 'incoming' ? (
            <>
              <button type="button" className="call-accept" aria-label="Nghe máy" title="Nghe máy" onClick={acceptCall}>
                <Icon name="phone" size={22} />
                <span>Nghe máy</span>
              </button>
              <button type="button" className="call-reject" aria-label="Từ chối cuộc gọi" title="Từ chối cuộc gọi" onClick={() => {
                sendSignal({ type: 'reject' })
                cleanup()
              }}>
                <Icon name="phone" size={22} />
                <span>Từ chối</span>
              </button>
            </>
          ) : (
            <button type="button" className="call-hangup" aria-label="Kết thúc cuộc gọi" title="Kết thúc cuộc gọi" onClick={finish}>
              <span className="call-phone-icon"><Icon name="phone" size={25} /></span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}