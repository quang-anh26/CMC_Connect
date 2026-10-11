import axiosClient from './axiosClient'

export const savedApi = {
  list: (params = {}) => axiosClient.get('/api/saved', { params }),
  toggle: (contentType, contentId, collectionId) => axiosClient.post('/api/saved/toggle', { contentType, contentId, collectionId }),
  status: (contentType, contentId) => axiosClient.get('/api/saved/status', { params: { type: contentType, contentId } }),
  unsave: (savedItemId) => axiosClient.delete(`/api/saved/items/${savedItemId}`),
  collections: () => axiosClient.get('/api/saved/collections'),
  createCollection: (name) => axiosClient.post('/api/saved/collections', { name }),
  renameCollection: (collectionId, name) => axiosClient.put(`/api/saved/collections/${collectionId}`, { name }),
  deleteCollection: (collectionId) => axiosClient.delete(`/api/saved/collections/${collectionId}`),
  addToCollection: (savedItemId, collectionId) => axiosClient.put(`/api/saved/items/${savedItemId}/collection/${collectionId}`),
  removeFromCollection: (savedItemId) => axiosClient.delete(`/api/saved/items/${savedItemId}/collection`),
}
