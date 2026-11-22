import axiosClient from './axiosClient'

export const feedApi = {
  list: () => axiosClient.get('/api/feed'),
  get: (postId) => axiosClient.get(`/api/feed/${postId}`),
  create: (payload) => axiosClient.post('/api/feed', payload),
  update: (postId, content) => axiosClient.put(`/api/feed/${postId}`, { content }),
  updatePrivacy: (postId, privacy) => axiosClient.put(`/api/feed/${postId}/privacy`, { privacy }),
  notInterested: (authorId) => axiosClient.post(`/api/feed/authors/${authorId}/not-interested`),
  like: (postId) => axiosClient.post(`/api/feed/${postId}/like`),
  react: (postId, reactionType) => axiosClient.post(`/api/feed/${postId}/reaction`, null, { params: { reactionType } }),
  comment: (postId, content, parentCommentId = null) => axiosClient.post(`/api/feed/${postId}/comments`, { content, parentCommentId }),
  removeComment: (postId, commentId) => axiosClient.delete(`/api/feed/${postId}/comments/${commentId}`),
  share: (postId, content = '') => axiosClient.post(`/api/feed/${postId}/share`, { content }),
  remove: (postId) => axiosClient.delete(`/api/feed/${postId}`),
}
