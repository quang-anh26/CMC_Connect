import axiosClient from './axiosClient'

export const feedApi = {
  list: () => axiosClient.get('/api/feed'),
  create: (payload) => axiosClient.post('/api/feed', payload),
  like: (postId) => axiosClient.post(`/api/feed/${postId}/like`),
  react: (postId, reactionType) => axiosClient.post(`/api/feed/${postId}/reaction`, null, { params: { reactionType } }),
  comment: (postId, content, parentCommentId = null) => axiosClient.post(`/api/feed/${postId}/comments`, { content, parentCommentId }),
  share: (postId, content = '') => axiosClient.post(`/api/feed/${postId}/share`, { content }),
  remove: (postId) => axiosClient.delete(`/api/feed/${postId}`),
}
