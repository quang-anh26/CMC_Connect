import axiosClient, { BASE_URL } from './axiosClient'

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v', 'avi', 'mkv', 'mpeg', 'mpg', '3gp'])
const BROWSER_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg'])

function getFileExtension(file) {
  return file?.name?.split('.').pop()?.toLowerCase() || ''
}

function isVideoFile(file) {
  return Boolean(file && (file.type?.startsWith('video/') || VIDEO_EXTENSIONS.has(getFileExtension(file))))
}

function isBrowserPlayableVideo(file) {
  return Boolean(file && BROWSER_VIDEO_EXTENSIONS.has(getFileExtension(file)))
}

function resolveMediaUrl(url) {
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url
  return new URL(url, BASE_URL || window.location.origin).toString()
}

export const videoApi = {
  list: (params = {}) => axiosClient.get('/api/videos', { params }),
  resolveMediaUrl,
  isVideoFile,
  isBrowserPlayableVideo,
  upload: (file, onUploadProgress) => {
    const data = new FormData()
    data.append('file', file)
    return axiosClient.post('/api/videos/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    })
  },
  create: (payload) => axiosClient.post('/api/videos', payload),
  update: (postId, payload) => axiosClient.put(`/api/videos/${postId}`, payload),
  remove: (postId) => axiosClient.delete(`/api/videos/${postId}`),
  view: (postId) => axiosClient.post(`/api/videos/${postId}/views`),
  toggleSave: (postId) => axiosClient.post(`/api/videos/${postId}/save`),
  toggleFollow: (postId) => axiosClient.post(`/api/videos/${postId}/follow`),
  report: (postId, reason) => axiosClient.post(`/api/videos/${postId}/report`, { reason }),
}
