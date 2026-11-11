import axiosClient from './axiosClient'

export const friendApi = {
  send: (receiverId) => axiosClient.post('/api/friends/requests', { receiverId }),
  cancel: (id) => axiosClient.delete(`/api/friends/requests/${id}`),
  accept: (id) => axiosClient.post(`/api/friends/requests/${id}/accept`),
  reject: (id) => axiosClient.post(`/api/friends/requests/${id}/reject`),
  received: () => axiosClient.get('/api/friends/requests/received'),
  sent: () => axiosClient.get('/api/friends/requests/sent'),
  accepted: () => axiosClient.get('/api/friends/accepted'),
}
