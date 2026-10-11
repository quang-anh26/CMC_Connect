import axiosClient from './axiosClient'

export const conversationApi = {
  list: () => axiosClient.get('/api/conversations'),
  requests: () => axiosClient.get('/api/conversations/requests'),
  archived: () => axiosClient.get('/api/conversations/archived'),
  setArchived: (conversationId, archived) =>
    axiosClient.post(`/api/conversations/${conversationId}/archive`, null, { params: { archived } }),
  updateDetails: (conversationId, payload) =>
    axiosClient.put(`/api/conversations/${conversationId}/details`, payload),
  getOrCreatePrivate: (otherUserId) => axiosClient.post(`/api/conversations/private/${otherUserId}`),
  createGroup: (payload) => axiosClient.post('/api/conversations/group', payload),
  addMember: (conversationId, memberId) =>
    axiosClient.post(`/api/conversations/${conversationId}/members/${memberId}`),
  removeMember: (conversationId, memberId) =>
    axiosClient.delete(`/api/conversations/${conversationId}/members/${memberId}`),
  leave: (conversationId) => axiosClient.post(`/api/conversations/${conversationId}/leave`),
}
