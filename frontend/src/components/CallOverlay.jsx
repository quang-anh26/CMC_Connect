import React, { useEffect, useRef, useState } from 'react'
import { Avatar } from './ui'
import { Icon } from './Icon'
import { messageApi } from '../api/messageApi'
import { getApiErrorMessage } from '../utils/apiError'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { conversationApi } from '../api/conversationApi'
import { showDesktopNotification, startRingtone, startTitleFlash, stopRingtone } from '../utils/callAlert'
import '../styles/call-group.css'

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

/** Một ô người tham gia trong cuộc gọi nhóm. */
function RemoteTile({ item, video, onBlocked }) {
  const mediaRef = useRef(null)
  useEffect(() => {
    const el = mediaRef.current
    if (!el || !item.stream) return
    el.srcObject = item.stream
    const played = el.play?.()
    if (played && played.catch) played.catch(() => onBlocked?.())
  }, [item.stream])
  return (
    <div className="call-tile">
      {video ? (
        <video ref={mediaRef} autoPlay playsInline />
      ) : (
        <>
          <Avatar name={item.name} src={item.avatar} size="lg" />
          <audio ref={mediaRef} autoPlay playsInline />
        </>
      )}
      <span>{item.name}</span>
    </div>
  )
}

export default function CallOverlay({ conversationInfo, conversations = [], visible, onClose }) {
  const { publish, connected, callSignal, clearCallSignal } = useSocket()
  const { user } = useAuth()
  const myUsername = user?.username || ''
  const [callState, setCallState] = useState('idle')
  const [callType, setCallType] = useState('audio')
  const [caller, setCaller] = useState(null)
  const [callConversation, setCallConversation] = useState(conversationInfo || null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [remotePeers, setRemotePeers] = useState([]) // cuộc gọi nhóm: [{ username, name, avatar, stream }]
  const [isGroup, setIsGroup] = useState(false)
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
  // --- cuộc gọi nhóm ---
  const callStateRef = useRef('idle')
  const isGroupRef = useRef(false)
  const groupIdRef = useRef(null)
  const groupPeersRef = useRef(new Map()) // username -> { peer, pending, name, avatar }
  const earlyCandidatesRef = useRef(new Map()) // candidate đến trước khi tạo peer
  const incomingLabelRef = useRef('')

  useEffect(() => {
    publishRef.current = publish
    connectedRef.current = connected
  }, [publish, connected])

  const updateCallState = (next) => {
    callStateRef.current = next
    setCallState(next)
  }

  const activeConversation = conversationInfo || callConversation
  const isGroupConversation = activeConversation?.type === 'GROUP'
  const groupMode = isGroup || isGroupConversation
  const callerUsername = typeof caller === 'string' ? caller : caller?.username
  const targetUsername = activeConversation?.otherUserUsername || callerUsername || callSignal?.fromUsername
  const targetName = (groupMode ? (activeConversation?.name || caller?.groupName) : null)
    || activeConversation?.name || caller?.displayName || callerUsername || 'Người dùng'

  incomingLabelRef.current = groupMode
    ? `${caller?.displayName || 'Một thành viên'} (nhóm ${targetName})`
    : targetName

  useEffect(() => {
    if (!conversationInfo) return
    setCallConversation(conversationInfo)
    callConversationRef.current = conversationInfo
  }, [conversationInfo])

  // Cuộc gọi đến khi đang ở trang khác: danh sách trò chuyện có thể chưa được tải -> tự tải để biết tên/ảnh và lưu nhật ký
  useEffect(() => {
    if (callState !== 'incoming' || callConversation) return undefined
    let alive = true
    const pick = (list) => (list || []).find((item) => (
      isGroupRef.current
        ? String(item.conversationId) === String(groupIdRef.current)
        : item.otherUserUsername === callerUsername
    ))
    ;(async () => {
      let match = pick(conversations)
      if (!match) {
        try {
          const { data } = await conversationApi.list()
          match = pick(data)
        } catch { /* không bắt buộc */ }
      }
      if (alive && match) {
        setCallConversation(match)
        callConversationRef.current = match
      }
    })()
    return () => { alive = false }
  }, [callState, callConversation, callerUsername, conversations])

  // Cuộc gọi đến: đổ chuông, nhấp nháy tiêu đề và hiện thông báo hệ điều hành khi đang ở tab/cửa sổ khác
  useEffect(() => {
    if (callState !== 'incoming') return undefined
    const label = incomingLabelRef.current || 'Có người'
    startRingtone()
    const stopFlash = startTitleFlash(`📞 ${label} đang gọi...`)
    const notification = showDesktopNotification(
      `${label} đang gọi bạn`,
      'Mở CMC Talk để nghe máy hoặc từ chối.',
      { tag: 'cmctalk-call', requireInteraction: true },
    )
    return () => {
      stopRingtone()
      stopFlash()
      notification?.close?.()
    }
  }, [callState])

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
    if (!groupMode) {
      if (callType === 'video' && remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream
      }
      if (callType === 'audio' && remoteAudioRef.current && remoteStream) {
        const audio = remoteAudioRef.current
        audio.srcObject = remoteStream
        audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true))
      }
    }
  }, [remoteStream, callState, callType, groupMode, remotePeers.length])

  useEffect(() => {
    if (callState !== 'connected' || !connectedAtRef.current) return undefined
    const updateDuration = () => {
      setElapsedSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000))
    }
    updateDuration()
    const timer = window.setInterval(updateDuration, 1000)
    return () => window.clearInterval(timer)
  }, [callState])

  /* ---------- gửi tín hiệu ---------- */
  // Gửi cho 1 người: cuộc gọi nhóm đi qua /app/call.group (server kiểm tra thành viên), 1-1 đi qua /app/call.signal
  const sendTo = (username, payload) => {
    if (!connectedRef.current || !username) return false
    if (isGroupRef.current) {
      publishRef.current('/app/call.group', { ...payload, conversationId: Number(groupIdRef.current), toUsername: username })
    } else {
      publishRef.current('/app/call.signal', { ...payload, toUsername: username })
    }
    return true
  }
  // Gửi cho mọi thành viên khác trong nhóm
  const broadcastGroup = (payload) => {
    if (!connectedRef.current || !groupIdRef.current) return false
    publishRef.current('/app/call.group', { ...payload, conversationId: Number(groupIdRef.current) })
    return true
  }
  const sendSignal = (payload) => sendTo(targetUsername, payload)

  /* ---------- dọn dẹp ---------- */
  const cleanup = () => {
    peerRef.current?.close()
    peerRef.current = null
    pendingCandidatesRef.current = []
    groupPeersRef.current.forEach((entry) => { try { entry.peer.close() } catch { /* ignore */ } })
    groupPeersRef.current.clear()
    earlyCandidatesRef.current.clear()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    connectedAtRef.current = null
    isInitiatorRef.current = false
    isGroupRef.current = false
    groupIdRef.current = null
    setIsGroup(false)
    setRemotePeers([])
    setRemoteStream(null)
    setElapsedSeconds(0)
    setAudioBlocked(false)
    setCaller(null)
    setCallConversation(null)
    callConversationRef.current = null
    updateCallState('idle')
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
    if (isGroupRef.current) {
      // Còn người khác trong cuộc gọi -> chỉ "rời"; chỉ còn mình -> "kết thúc" để tắt chuông của người chưa nghe
      broadcastGroup({ type: groupPeersRef.current.size === 0 ? 'group-end' : 'group-leave' })
    } else {
      sendSignal({ type: 'end' })
    }
    cleanup()
    onClose?.()
    return saveLog
  }

  /* ---------- 1-1 ---------- */
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

  /* ---------- Nhóm: quản lý các kết nối (mesh) ---------- */
  const createGroupPeer = (username, meta = {}) => {
    const existing = groupPeersRef.current.get(username)
    if (existing) { try { existing.peer.close() } catch { /* ignore */ } }
    const peer = new RTCPeerConnection(rtcConfig)
    const entry = {
      peer,
      pending: earlyCandidatesRef.current.get(username) || [],
      name: meta.name || existing?.name || username,
      avatar: meta.avatar ?? existing?.avatar,
    }
    earlyCandidatesRef.current.delete(username)
    groupPeersRef.current.set(username, entry)

    const fallback = new MediaStream()
    peer.ontrack = (event) => {
      let stream = event.streams[0]
      if (!stream) {
        fallback.addTrack(event.track)
        stream = fallback
      }
      setRemotePeers((list) => (
        list.some((x) => x.username === username)
          ? list.map((x) => (x.username === username ? { ...x, stream } : x))
          : [...list, { username, name: entry.name, avatar: entry.avatar, stream }]
      ))
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) sendTo(username, { type: 'candidate', candidate: event.candidate })
    }
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') {
        setError(`Không kết nối được âm thanh với ${entry.name} (có thể cần máy chủ TURN).`)
        try { peer.restartIce() } catch { /* ignore */ }
      }
    }
    const local = localStreamRef.current
    if (local) local.getTracks().forEach((track) => peer.addTrack(track, local))
    return entry
  }

  const removeGroupPeer = (username) => {
    const entry = groupPeersRef.current.get(username)
    if (entry) { try { entry.peer.close() } catch { /* ignore */ } }
    groupPeersRef.current.delete(username)
    earlyCandidatesRef.current.delete(username)
    setRemotePeers((list) => list.filter((x) => x.username !== username))
  }

  const flushEntry = async (entry) => {
    const pending = entry.pending
    entry.pending = []
    for (const candidate of pending) {
      try { await entry.peer.addIceCandidate(candidate) } catch { /* bỏ qua */ }
    }
  }

  const markConnected = () => {
    if (!connectedAtRef.current) connectedAtRef.current = Date.now()
    updateCallState('connected')
  }

  const inGroupCall = (conversationId) => (
    isGroupRef.current
    && String(groupIdRef.current) === String(conversationId)
    && ['calling', 'connected'].includes(callStateRef.current)
  )

  const startGroupCall = async (type) => {
    const conversationId = activeConversation?.conversationId
    if (!conversationId || callStateRef.current !== 'idle') return
    try {
      setError('')
      setCallType(type)
      callTypeRef.current = type
      callConversationRef.current = activeConversation
      isInitiatorRef.current = true
      isGroupRef.current = true
      groupIdRef.current = conversationId
      setIsGroup(true)
      callLogSavedRef.current = false
      connectedAtRef.current = null
      if (!connected) throw new Error('Máy chủ cuộc gọi chưa kết nối. Vui lòng thử lại.')
      if (typeof RTCPeerConnection === 'undefined') throw new Error('Trình duyệt không hỗ trợ WebRTC.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true })
      localStreamRef.current = stream
      broadcastGroup({ type: 'group-ring', callType: type, groupName: activeConversation?.name || 'Nhóm' })
      updateCallState('calling')
    } catch (err) {
      cleanup()
      setError(err?.name === 'Error' && err.message.startsWith('Máy chủ')
        ? err.message
        : mediaErrorMessage(err, type, 'Không thể bắt đầu cuộc gọi nhóm'))
    }
  }

  const acceptGroupCall = async () => {
    try {
      if (!connected) throw new Error('Máy chủ cuộc gọi chưa kết nối. Vui lòng thử lại.')
      if (typeof RTCPeerConnection === 'undefined') throw new Error('Trình duyệt không hỗ trợ WebRTC.')
      isInitiatorRef.current = false
      const stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true })
      localStreamRef.current = stream
      connectedAtRef.current = Date.now()
      updateCallState('connected')
      // Báo cho mọi người: những ai đang trong cuộc gọi sẽ gửi offer cho mình
      broadcastGroup({ type: 'group-join', callType })
    } catch (err) {
      cleanup()
      setError(err?.name === 'Error' && err.message.startsWith('Máy chủ')
        ? err.message
        : mediaErrorMessage(err, callType, 'Không thể tham gia cuộc gọi nhóm'))
    }
  }

  const handleGroupSignal = async (signal) => {
    const from = signal.fromUsername
    const cid = signal.conversationId
    const meta = { name: signal.fromDisplayName, avatar: signal.fromAvatar }

    switch (signal.type) {
      case 'group-ring': {
        if (callStateRef.current !== 'idle') return // đang bận
        const match = conversations.find((c) => String(c.conversationId) === String(cid))
        if (match) {
          setCallConversation(match)
          callConversationRef.current = match
        }
        isGroupRef.current = true
        groupIdRef.current = cid
        setIsGroup(true)
        callTypeRef.current = signal.callType || 'audio'
        setCallType(signal.callType || 'audio')
        setCaller({ username: from, group: true, groupName: signal.groupName, conversationId: cid, displayName: signal.fromDisplayName })
        updateCallState('incoming')
        break
      }
      case 'group-join': {
        if (!inGroupCall(cid)) return
        const entry = createGroupPeer(from, meta)
        const offer = await entry.peer.createOffer()
        await entry.peer.setLocalDescription(offer)
        sendTo(from, { type: 'offer', callType: callTypeRef.current, offer })
        markConnected()
        break
      }
      case 'offer': {
        if (!inGroupCall(cid) || !signal.offer) return
        let entry = groupPeersRef.current.get(from)
        if (entry && entry.peer.signalingState === 'have-local-offer') {
          // Hai bên cùng gửi offer một lúc: bên có username lớn hơn bỏ qua, bên nhỏ hơn rollback rồi nhận offer
          if (myUsername > from) return
          await entry.peer.setLocalDescription({ type: 'rollback' })
        } else {
          entry = createGroupPeer(from, meta)
        }
        await entry.peer.setRemoteDescription(new RTCSessionDescription(signal.offer))
        await flushEntry(entry)
        const answer = await entry.peer.createAnswer()
        await entry.peer.setLocalDescription(answer)
        sendTo(from, { type: 'answer', answer })
        markConnected()
        break
      }
      case 'answer': {
        const entry = groupPeersRef.current.get(from)
        if (!entry || !signal.answer || entry.peer.signalingState !== 'have-local-offer') return
        await entry.peer.setRemoteDescription(new RTCSessionDescription(signal.answer))
        await flushEntry(entry)
        break
      }
      case 'candidate': {
        if (!signal.candidate) return
        const candidate = new RTCIceCandidate(signal.candidate)
        const entry = groupPeersRef.current.get(from)
        if (!entry) {
          const list = earlyCandidatesRef.current.get(from) || []
          list.push(candidate)
          earlyCandidatesRef.current.set(from, list)
        } else if (entry.peer.remoteDescription) {
          try { await entry.peer.addIceCandidate(candidate) } catch { /* bỏ qua */ }
        } else {
          entry.pending.push(candidate)
        }
        break
      }
      case 'group-leave': {
        if (inGroupCall(cid)) removeGroupPeer(from)
        break
      }
      case 'group-end': {
        // Người gọi đã tắt khi chưa ai nghe -> tắt chuông cho ai chưa nhấc máy
        if (callStateRef.current === 'incoming' && String(groupIdRef.current) === String(cid)) {
          cleanup()
          onClose?.()
        } else if (inGroupCall(cid)) {
          removeGroupPeer(from)
        }
        break
      }
      default:
        break
    }
  }

  /* ---------- Bắt đầu / nhận cuộc gọi 1-1 ---------- */
  const startCall = async (type) => {
    if (callState !== 'idle') return
    if (isGroupConversation) return startGroupCall(type)
    if (!targetUsername) return
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
      updateCallState('calling')
    } catch (err) {
      cleanup()
      setError(err?.name === 'Error' && err.message.startsWith('Máy chủ')
        ? err.message
        : mediaErrorMessage(err, type, 'Không thể bắt đầu cuộc gọi'))
    }
  }

  useEffect(() => {
    if (!visible) return
    if (!isGroupConversation && !targetUsername) {
      setError('Không tìm thấy người nhận cuộc gọi.')
      return
    }
    if (!connected) {
      setError('Đang kết nối máy chủ cuộc gọi...')
      return
    }
    if (callState === 'idle') startCall(conversationInfo?.requestedCallType || 'audio')
  }, [visible, targetUsername, connected, isGroupConversation])

  const acceptCall = async () => {
    if (isGroupRef.current) return acceptGroupCall()
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
      updateCallState('connected')
    } catch (err) {
      cleanup()
      setError(err?.name === 'Error' && err.message.startsWith('Máy chủ')
        ? err.message
        : mediaErrorMessage(err, callType, 'Không thể nhận cuộc gọi'))
    }
  }

  /* ---------- Nhận tín hiệu (xử lý tuần tự) ---------- */
  useEffect(() => {
    if (!callSignal) return undefined
    const signal = callSignal
    clearCallSignal()
    signalChainRef.current = signalChainRef.current.then(async () => {
      try {
        if (signal.group) {
          await handleGroupSignal(signal)
          return
        }
        // Đang trong cuộc gọi nhóm thì bỏ qua tín hiệu 1-1 (chỉ báo bận nếu có người gọi tới)
        if (isGroupRef.current) {
          if (signal.type === 'offer' && signal.fromUsername) {
            publishRef.current('/app/call.signal', { type: 'reject', toUsername: signal.fromUsername })
          }
          return
        }
        if (signal.type === 'offer') {
          if (!signal.offer || !signal.fromUsername) throw new Error('Thiếu dữ liệu cuộc gọi đến')
          if (callStateRef.current !== 'idle') {
            // Đang bận cuộc gọi khác
            publishRef.current('/app/call.signal', { type: 'reject', toUsername: signal.fromUsername })
            return
          }
          const matchingConversation = conversations.find((item) => item.otherUserUsername === signal.fromUsername)
          if (matchingConversation) {
            setCallConversation(matchingConversation)
            callConversationRef.current = matchingConversation
          }
          pendingCandidatesRef.current = []
          callTypeRef.current = signal.callType || 'audio'
          setCaller({ username: signal.fromUsername, offer: signal.offer, displayName: signal.fromDisplayName, avatar: signal.fromAvatar })
          setCallType(signal.callType || 'audio')
          updateCallState('incoming')
        } else if (signal.type === 'answer' && peerRef.current && signal.answer) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal.answer))
          await flushPendingCandidates(peerRef.current)
          connectedAtRef.current = Date.now()
          updateCallState('connected')
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

  const resumeAudio = () => {
    document.querySelectorAll('.call-overlay audio, .call-overlay video').forEach((el) => {
      const played = el.play?.()
      if (played && played.catch) played.catch(() => {})
    })
    setAudioBlocked(false)
  }

  if (callState === 'idle' && !error && !visible) return null

  const waitingGroup = groupMode && remotePeers.length === 0
  const statusText = callState === 'incoming'
    ? (groupMode ? 'Cuộc gọi nhóm đến' : 'Cuộc gọi đến')
    : callState === 'connected'
      ? 'Đang trò chuyện'
      : callState === 'calling'
        ? (groupMode ? 'Đang gọi các thành viên...' : 'Đang đổ chuông...')
        : 'Đang chuẩn bị cuộc gọi...'
  const kindLabel = `${groupMode ? 'Nhóm · ' : ''}${callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}`
  const incomingTitle = groupMode
    ? `${caller?.displayName || 'Một thành viên'} đang gọi nhóm ${targetName}`
    : `${targetName} đang gọi`
  const participantCount = remotePeers.length + (callState === 'connected' ? 1 : 0)

  return (
    <div className={`call-overlay ${callType === 'video' ? 'is-video' : 'is-audio'}`}>
      <div className="call-card">
        <header className="call-topbar">
          <div>
            <strong>{callState === 'incoming' ? incomingTitle : targetName}</strong>
            <span>{statusText}{groupMode && callState === 'connected' ? ` · ${participantCount} người` : ''}</span>
          </div>
          <span className="call-kind">{kindLabel}</span>
        </header>

        {groupMode ? (
          <div className={`call-group-stage ${callType === 'video' ? 'is-video' : 'is-audio'}`} data-count={remotePeers.length + (callType === 'video' ? 1 : 0)}>
            {callType === 'video' && callState !== 'incoming' && (
              <div className="call-tile self">
                <video ref={localVideoRef} autoPlay muted playsInline />
                <span>Bạn</span>
              </div>
            )}
            {remotePeers.map((item) => (
              <RemoteTile key={item.username} item={item} video={callType === 'video'} onBlocked={() => setAudioBlocked(true)} />
            ))}
            {(waitingGroup || callState === 'incoming') && (
              <div className="call-group-wait">
                <Avatar src={activeConversation?.avatar} name={targetName} size="lg" />
                <strong>{targetName}</strong>
                <span>
                  {callState === 'incoming'
                    ? 'Bấm "Nghe máy" để tham gia cuộc gọi nhóm'
                    : callState === 'calling'
                      ? 'Đang đổ chuông, chờ thành viên tham gia...'
                      : 'Hiện chưa có ai khác trong cuộc gọi'}
                </span>
              </div>
            )}
            {audioBlocked && (
              <button type="button" className="call-audio-enable" onClick={resumeAudio}>Bật âm thanh</button>
            )}
          </div>
        ) : callType === 'video' ? (
          <div className="call-video-stage">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <video ref={localVideoRef} autoPlay muted playsInline />
          </div>
        ) : (
          <div className="call-audio-stage">
            <Avatar src={activeConversation?.avatar || caller?.avatar} name={targetName} size="lg" />
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
                if (!isGroupRef.current) sendSignal({ type: 'reject' })
                cleanup()
              }}>
                <Icon name="phone" size={22} />
                <span>Từ chối</span>
              </button>
            </>
          ) : (
            <button type="button" className="call-hangup" aria-label={groupMode ? 'Rời cuộc gọi' : 'Kết thúc cuộc gọi'} title={groupMode ? 'Rời cuộc gọi' : 'Kết thúc cuộc gọi'} onClick={finish}>
              <span className="call-phone-icon"><Icon name="phone" size={25} /></span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}