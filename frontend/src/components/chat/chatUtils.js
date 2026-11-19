export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "🎉"]

export function systemMessageLabel(message, isMine, conversation) {
  const prefix = "CALL_LOG:"
  if (!message.content?.startsWith(prefix)) return message.content
  try {
    const call = JSON.parse(message.content.slice(prefix.length))
    const typeLabel = call.callType === "video" ? "cuộc gọi video" : "cuộc gọi thoại"
    if (call.status === "MISSED") {
      const callTypeLabel = call.callType === "video" ? "video" : "thoại"
      return isMine
        ? `Bạn đã gọi ${callTypeLabel} nhưng không được trả lời`
        : `Bạn đã bỏ lỡ ${typeLabel} từ ${message.senderDisplayName || conversation?.name || "người dùng"}`
    }
    if (call.status === "COMPLETED" && Number.isFinite(call.durationSeconds)) {
      const totalMinutes = Math.floor(call.durationSeconds / 60)
      const seconds = call.durationSeconds % 60
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      const duration = hours
        ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      return `Cuộc gọi ${call.callType === "video" ? "video" : "thoại"} · ${duration}`
    }
  } catch {
    return message.content
  }
  return message.content
}

export const CHAT_WALLPAPERS = [
  { id: "mountain-meadow", name: "Đồng cỏ", src: "/chat-themes/mountain-meadow.webp" },
  { id: "sunset", name: "Hoàng hôn", src: "/chat-themes/sunset.webp" },
  { id: "alpine-lake", name: "Hồ núi", src: "/chat-themes/alpine-lake.webp" },
  { id: "moonlight", name: "Ánh trăng", src: "/chat-themes/moonlight.jpg" },
]

export function isImageMessage(message) {
  if (!message) return false
  if (message.messageType === "IMAGE") return true
  if (message.messageType === "AUDIO" || message.messageType === "FILE" || message.messageType === "SYSTEM") return false
  const content = typeof message.content === "string" ? message.content.trim() : ""
  if (!content) return false
  return content.startsWith("/uploads/") || content.startsWith("http://") || content.startsWith("https://")
}

export function formatLastSeen(dateStr, now = Date.now()) {
  if (!dateStr) return "chưa rõ thời gian"
  const minutes = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 60000))
  if (minutes < 1) return "vừa xong"
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

export function formatListTime(dateStr) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua"
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays < 7) return ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][d.getDay()]
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
}

export const isMuted = (id) => localStorage.getItem(`cmctalk-muted-${id}`) === "true"
export const isMarkedUnread = (id) => localStorage.getItem(`cmctalk-unread-${id}`) === "true"
export const isUnread = (c) => (c.unreadCount || 0) > 0 || isMarkedUnread(c.conversationId)

// Cuộn trong khung chat, không để trình duyệt cuộn cả trang.
export function scrollToBottom(container, smooth = false) {
  if (!container) return
  container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" })
}
