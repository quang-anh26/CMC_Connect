import { useEffect } from 'react'
import { presenceApi } from '../api/presenceApi'

const HEARTBEAT_INTERVAL_MS = 30000
const ACTIVE_STATUS_KEY = 'messenger-active-status'

/**
 * Báo cho máy chủ biết người dùng đang online (heartbeat mỗi 30 giây).
 * Nếu người dùng tắt "Trạng thái hoạt động" trong Cài đặt thì gửi active=false để hiện offline.
 */
export default function usePresenceHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined

    const beat = () => {
      if (document.visibilityState === 'hidden') return
      const active = localStorage.getItem(ACTIVE_STATUS_KEY) !== 'OFF'
      presenceApi.heartbeat(active).catch(() => {})
    }

    beat()
    const timerId = window.setInterval(beat, HEARTBEAT_INTERVAL_MS)
    document.addEventListener('visibilitychange', beat)
    window.addEventListener('cmctalk-active-status-changed', beat)
    return () => {
      window.clearInterval(timerId)
      document.removeEventListener('visibilitychange', beat)
      window.removeEventListener('cmctalk-active-status-changed', beat)
    }
  }, [enabled])
}
