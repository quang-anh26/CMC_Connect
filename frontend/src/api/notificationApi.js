import axiosClient from './axiosClient'

export const notificationApi = {
  list: () => axiosClient.get('/api/notifications'),
  unreadCount: () => axiosClient.get('/api/notifications/unread-count'),
  markRead: (id) => axiosClient.post(`/api/notifications/${id}/read`),
  markAllRead: () => axiosClient.post('/api/notifications/read-all'),
  remove: (id) => axiosClient.delete(`/api/notifications/${id}`),
}
