import axiosClient from './axiosClient'

export const marketplaceApi = {
  list: (params = {}) => axiosClient.get('/api/marketplace', { params }),
  recommendations: (params = {}) => axiosClient.get('/api/marketplace/recommendations', { params }),
  searchHistory: () => axiosClient.get('/api/marketplace/search-history'),
  get: (listingId) => axiosClient.get(`/api/marketplace/${listingId}`),
  create: (payload) => axiosClient.post('/api/marketplace', payload),
  update: (listingId, payload) => axiosClient.put(`/api/marketplace/${listingId}`, payload),
  remove: (listingId) => axiosClient.delete(`/api/marketplace/${listingId}`),
  markSold: (listingId) => axiosClient.post(`/api/marketplace/${listingId}/sold`),
  toggleSaved: (listingId) => axiosClient.post(`/api/marketplace/${listingId}/save`),
  toggleFollow: (sellerId) => axiosClient.post(`/api/marketplace/sellers/${sellerId}/follow`),
  share: (listingId) => axiosClient.post(`/api/marketplace/${listingId}/share`),
  report: (listingId, payload) => axiosClient.post(`/api/marketplace/${listingId}/report`, payload),
  uploadImages: (files) => {
    const data = new FormData()
    files.forEach((file) => data.append('files', file))
    return axiosClient.post('/api/marketplace/images', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
