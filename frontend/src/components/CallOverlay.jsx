import React, { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import { useSocket } from '../context/SocketContext'

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export default function CallOverlay({ conversationInfo, visible, onClose }) {
  const { publish, connected, callSignal, clearCallSignal } = useSocket()
  const [callState, setCallState] = useState('idle')
  const [callType, setCallType] = useState('audio')
  const [caller, setCaller] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [error, setError] = useState('')
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  const callerUsername = typeof caller === 'string' ? caller : caller?.username
  const targetUsername = conversationInfo?.otherUserUsername || callerUsername || callSignal?.fromUsername
  const targetName = conversationInfo?.name || 'Người dùng'

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream, callState])

  const sendSignal = (payload) => {
    if (connected && targetUsername) publish('/app/call.signal', { ...payload, toUsername: targetUsername })
  }

  const cleanup = () => {
    peerRef.current?.close()
    peerRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    setRemoteStream(null)
    setCaller(null)
    setCallState('idle')
    setError('')
  }

  const finish = () => {
    sendSignal({ type: 'end' })
    cleanup()
    onClose?.()
  }

  const createPeer = (remoteUsername) => {
    const peer = new RTCPeerConnection(rtcConfig)
    const stream = new MediaStream()
    peer.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => stream.addTrack(track))
      setRemoteStream(stream)
    }
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        publish('/app/call.signal', { toUsername: remoteUsername, type: 'candidate', candidate: event.candidate })
      }
    }
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
        setError(`Kết nối cuộc gọi ${peer.connectionState === 'failed' ? 'thất bại' : 'bị ngắt'}.`)
      }
    }
    peerRef.current = peer
    return peer
  }

  const startCall = async (type) => {
    if (!targetUsername || callState !== 'idle') return
    try {
      setError('')
      setCallType(type)
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true })
      localStreamRef.current = stream
      const peer = createPeer(targetUsername)
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      sendSignal({ type: 'offer', callType: type, offer })
      setCallState('calling')
    } catch (err) {
      cleanup()
      setError(!window.isSecureContext
        ? 'Cuộc gọi cần HTTPS để trình duyệt cho phép dùng camera/micro.'
        : (err.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền camera/micro.' : `Không thể bắt đầu cuộc gọi: ${err.message || 'lỗi WebRTC'}`))
    }
  }

  useEffect(() => {
    if (visible && callState === 'idle' && targetUsername) {
      startCall(conversationInfo?.requestedCallType || 'audio')
    }
  }, [visible, targetUsername])

  const acceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true })
      localStreamRef.current = stream
      const peer = createPeer(caller.username)
      stream.getTracks().forEach((track) => peer.addTrack(track, stream))
      await peer.setRemoteDescription(new RTCSessionDescription(caller.offer))
      for (const candidate of pendingCandidatesRef.current) await peer.addIceCandidate(candidate)
      pendingCandidatesRef.current = []
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      sendSignal({ type: 'answer', answer })
      setCallState('connected')
    } catch (err) {
      cleanup()
      setError(!window.isSecureContext
        ? 'Cuộc gọi cần HTTPS để trình duyệt cho phép dùng camera/micro.'
        : `Không thể nhận cuộc gọi: ${err.message || 'lỗi WebRTC'}. Hãy cấp quyền camera/micro.`)
    }
  }

  useEffect(() => {
    if (!callSignal) return undefined
    const signal = callSignal
    clearCallSignal()
    ;(async () => {
      try {
        if (signal.type === 'offer') {
          if (!signal.offer || !signal.fromUsername) throw new Error('Thiếu dữ liệu cuộc gọi đến')
          setCaller({ username: signal.fromUsername, offer: signal.offer })
          setCallType(signal.callType || 'audio')
          setCallState('incoming')
        } else if (signal.type === 'answer' && peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal.answer))
          setCallState('connected')
        } else if (signal.type === 'candidate') {
          const candidate = new RTCIceCandidate(signal.candidate)
          if (peerRef.current?.remoteDescription) await peerRef.current.addIceCandidate(candidate)
          else pendingCandidatesRef.current.push(candidate)
        } else if (signal.type === 'end' || signal.type === 'reject') {
          cleanup()
        }
      } catch {
        setError('Kết nối cuộc gọi bị gián đoạn.')
      }
    })()
    return undefined
  }, [callSignal])

  useEffect(() => cleanup, [])

  if (callState === 'idle' && !error && !visible) {
    return null
  }

  return (
    <div className="call-overlay">
      <div className="call-card">
        <div className="call-card-title">
          <Avatar src={conversationInfo?.avatar} name={targetName} size={48} />
          <div><strong>{callState === 'incoming' ? `${targetName} đang gọi` : targetName}</strong><span>{callState === 'connected' ? 'Đã kết nối' : callState === 'calling' ? 'Đang gọi...' : 'Cuộc gọi đến'}</span></div>
        </div>
        {callType === 'video' && <div className="call-video-stage"><video ref={remoteVideoRef} autoPlay playsInline /><video ref={localVideoRef} autoPlay muted playsInline /></div>}
        {error && <div className="call-error">{error}</div>}
        <div className="call-actions">
          {callState === 'incoming' && <><button type="button" className="call-accept" onClick={acceptCall}>Nhận</button><button type="button" className="call-reject" onClick={() => { sendSignal({ type: 'reject' }); cleanup() }}>Từ chối</button></>}
          {callState !== 'incoming' && <button type="button" className="call-reject" onClick={finish}>Kết thúc</button>}
        </div>
      </div>
    </div>
  )
}