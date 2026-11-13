import { BASE_URL } from "../api/axiosClient"

// URL ảnh/video backend trả về dạng "/uploads/xxx": nối với VITE_API_BASE_URL khi deploy tách domain.
export function mediaUrl(url) {
  if (!url) return ""
  if (/^(https?:|blob:|data:)/i.test(url)) return url
  return `${BASE_URL || ""}${url.startsWith("/") ? "" : "/"}${url}`
}

export function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return Array.from(parts[0])[0].toUpperCase()
  return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase()
}

export function timeAgo(value) {
  if (!value) return ""
  const date = new Date(value)
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 45) return "Vừa xong"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(1, minutes)} phút`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày`
  return date.toLocaleDateString("vi-VN")
}

export function clockTime(value) {
  if (!value) return ""
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
}

export function dayLabel(value) {
  if (!value) return ""
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Hôm nay"
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua"
  return date.toLocaleDateString("vi-VN")
}

export function monthShort(value) {
  return `THG ${new Date(value).getMonth() + 1}`
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}

export function isVideoUrl(url, mediaType) {
  if (mediaType) return String(mediaType).toUpperCase() === "VIDEO"
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url || "")
}

export function eventTimeRange(startsAt) {
  if (!startsAt) return ""
  return new Date(startsAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
}

// /api/friends/accepted trả về bản ghi kết bạn hai phía -> lấy ra "người bạn" (không phải mình).
export function friendOf(request, myId) {
  const iAmSender = String(request.senderId) === String(myId)
  return {
    id: iAmSender ? request.receiverId : request.senderId,
    name: (iAmSender ? request.receiverDisplayName : request.senderDisplayName) || (iAmSender ? request.receiverUsername : request.senderUsername) || "Người dùng",
    avatar: iAmSender ? request.receiverAvatar : request.senderAvatar,
  }
}
