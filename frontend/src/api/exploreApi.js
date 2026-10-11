import axiosClient from './axiosClient'

export const exploreApi = {
  posts: (params = {}) => axiosClient.get('/api/explore/posts', { params }),
  like: (postId) => axiosClient.post(`/api/feed/${postId}/like`),
  share: (postId) => axiosClient.post(`/api/feed/${postId}/share`, { content: '' }),
}