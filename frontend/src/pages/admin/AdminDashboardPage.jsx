import React, { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../api/adminApi'
import { useAuth } from '../../context/AuthContext'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import { getApiErrorMessage } from '../../utils/apiError'

export default function AdminDashboardPage() {
  const { logout } = useAuth()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')

  const loadUsers = useCallback(async (keyword) => {
    setListError('')
    try {
      const res = await adminApi.users(keyword)
      setUsers(res.data)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Không tải được danh sách người dùng.'))
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboard, list] = await Promise.all([adminApi.dashboard(), adminApi.users('')])
      setStats(dashboard.data)
      setUsers(list.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không tải được dữ liệu quản trị.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const toggleLock = async (u) => {
    try {
      if (u.status === 'LOCKED') await adminApi.unlock(u.userId)
      else await adminApi.lock(u.userId)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Không thể cập nhật trạng thái tài khoản.'))
      return
    }
    loadUsers(q)
  }

  return (
    <div className="admin-shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Admin Dashboard</h2>
        <button className="icon-btn" onClick={logout}>Đăng xuất</button>
      </div>

      {loading ? (
        <LoadingState variant="skeleton" lines={4} skeletonHeight={56} label="Đang tải dữ liệu quản trị..." />
      ) : error ? (
        <ErrorState title="Không tải được trang quản trị" message={error} onRetry={loadAll} />
      ) : (
        <>
          {stats && (
            <div className="admin-stats">
              <div className="stat-card"><div className="num">{stats.totalUsers}</div><div className="label">Tổng người dùng</div></div>
              <div className="stat-card"><div className="num">{stats.onlineUsers}</div><div className="label">Đang online</div></div>
              <div className="stat-card"><div className="num">{stats.lockedUsers}</div><div className="label">Tài khoản bị khóa</div></div>
              <div className="stat-card"><div className="num">{stats.messagesToday}</div><div className="label">Tin nhắn hôm nay</div></div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <input
              placeholder="Tìm theo username / tên..."
              value={q}
              onChange={(e) => { setQ(e.target.value); loadUsers(e.target.value) }}
              className="admin-search"
            />
          </div>

          {listError ? (
            <ErrorState compact message={listError} onRetry={() => loadUsers(q)} />
          ) : users.length === 0 ? (
            <EmptyState icon="👤" title="Không tìm thấy người dùng" description="Thử từ khóa khác." />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th><th>Username</th><th>Tên hiển thị</th><th>Vai trò</th><th>Trạng thái</th><th>Online</th><th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId}>
                    <td>{u.userId}</td>
                    <td>{u.username}</td>
                    <td>{u.displayName}</td>
                    <td>{u.role}</td>
                    <td>
                      <span className={u.status === 'LOCKED' ? 'badge-locked' : 'badge-active'}>{u.status}</span>
                    </td>
                    <td>{u.online ? '🟢' : '⚪'}</td>
                    <td>
                      <button className="icon-btn" onClick={() => toggleLock(u)}>
                        {u.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
