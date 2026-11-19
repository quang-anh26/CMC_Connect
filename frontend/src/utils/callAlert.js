// Âm báo, thông báo trình duyệt và nhấp nháy tiêu đề cho cuộc gọi đến / sự kiện.

let audioCtx = null
let ringTimer = null

/** Phát chuông "tút... tút..." lặp lại cho tới khi gọi stopRingtone(). */
export function startRingtone() {
    stopRingtone()
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    try {
        audioCtx = new AudioContextClass()
        audioCtx.resume?.()
    } catch {
        audioCtx = null
        return
    }
    const ring = () => {
        const ctx = audioCtx
        if (!ctx) return
        const now = ctx.currentTime
            ;[0, 0.55].forEach((offset) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = 'sine'
                osc.frequency.value = offset === 0 ? 880 : 740
                gain.gain.setValueAtTime(0, now + offset)
                gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.04)
                gain.gain.linearRampToValueAtTime(0, now + offset + 0.45)
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.start(now + offset)
                osc.stop(now + offset + 0.5)
            })
    }
    ring()
    ringTimer = window.setInterval(ring, 2400)
}

export function stopRingtone() {
    if (ringTimer) window.clearInterval(ringTimer)
    ringTimer = null
    if (audioCtx) {
        try { audioCtx.close() } catch { /* ignore */ }
        audioCtx = null
    }
}

/** Xin quyền thông báo trình duyệt ở lần bấm / gõ phím đầu tiên (trình duyệt yêu cầu có thao tác của người dùng). */
export function armNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'default') {
        return () => { }
    }
    const cleanup = () => {
        window.removeEventListener('click', ask)
        window.removeEventListener('keydown', ask)
    }
    function ask() {
        cleanup()
        try {
            const result = Notification.requestPermission()
            if (result && result.catch) result.catch(() => { })
        } catch { /* ignore */ }
    }
    window.addEventListener('click', ask)
    window.addEventListener('keydown', ask)
    return cleanup
}

/**
 * Hiện thông báo của hệ điều hành. Mặc định chỉ hiện khi tab đang bị ẩn / người dùng đang ở cửa sổ khác.
 * Trả về đối tượng Notification (hoặc null).
 */
export function showDesktopNotification(title, body, { tag, requireInteraction = false, onlyWhenHidden = true, onClick } = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) return null
    if (Notification.permission !== 'granted') return null
    if (onlyWhenHidden && !document.hidden) return null
    try {
        const notification = new Notification(title, { body, tag, requireInteraction, icon: '/favicon.png' })
        notification.onclick = () => {
            window.focus()
            notification.close()
            onClick?.()
        }
        return notification
    } catch {
        return null
    }
}

/** Nhấp nháy tiêu đề tab. Trả về hàm dừng. */
export function startTitleFlash(text) {
    const original = document.title
    let on = false
    const timer = window.setInterval(() => {
        on = !on
        document.title = on ? text : original
    }, 900)
    return () => {
        window.clearInterval(timer)
        document.title = original
    }
}