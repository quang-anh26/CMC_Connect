import axiosClient from './axiosClient'

export const presenceApi = {
  heartbeat: (active = true) => axiosClient.post('/api/presence/heartbeat', { active }),
  online: (ids) => axiosClient.get('/api/presence/online', { params: { ids: ids.join(',') } }),
}
