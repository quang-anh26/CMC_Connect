import axiosClient from './axiosClient'

export const messageApi = {
  send: (payload) => axiosClient.post('/api/messages', payload),
  history: (conversationId, page = 0) =>
    axiosClient.get(`/api/messages/conversation/${conversationId}`, { params: { page } }),
  edit: (messageId, content) => axiosClient.put(`/api/messages/${messageId}`, { content }),
  recall: (messageId) => axiosClient.post(`/api/messages/${messageId}/recall`),
  react: (messageId, conversationId, emoji) =>
    axiosClient.post(`/api/messages/${messageId}/reaction`, { messageId, conversationId, emoji }),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return axiosClient.post('/api/messages/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
