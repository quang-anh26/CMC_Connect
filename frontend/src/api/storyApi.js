import axiosClient from './axiosClient'

export const storyApi = {
  list: () => axiosClient.get('/api/stories'),
  create: (payload) => axiosClient.post('/api/stories', payload),
  delete: (storyId) => axiosClient.delete(`/api/stories/${storyId}`),
  interactions: (storyId) => axiosClient.get(`/api/stories/${storyId}/interactions`),
  react: (storyId, reactionType) => axiosClient.post(`/api/stories/${storyId}/reaction`, null, { params: { reactionType } }),
  comment: (storyId, content) => axiosClient.post(`/api/stories/${storyId}/comments`, { content }),
  deleteComment: (storyId, commentId) => axiosClient.delete(`/api/stories/${storyId}/comments/${commentId}`),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return axiosClient.post('/api/stories/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
