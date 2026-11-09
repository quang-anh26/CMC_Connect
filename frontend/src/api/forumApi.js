import axiosClient from './axiosClient'

const root = '/api/forum'

export const getForumTaxonomy = async () => (await axiosClient.get(`${root}/taxonomy`)).data
export const getForumTopics = async (params = {}) => (await axiosClient.get(`${root}/topics`, { params })).data
export const getForumTopic = async (id) => (await axiosClient.get(`${root}/topics/${id}`)).data
export const createForumTopic = async (payload) => (await axiosClient.post(`${root}/topics`, payload)).data
export const createForumTopicWithAttachment = async (payload, file, submissionKey) => {
  const body = new FormData()
  body.append('submissionKey', submissionKey)
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') body.append(key, value)
  })
  if (file) body.append('file', file)
  return (await axiosClient.post(`${root}/topics/with-attachment`, body, {
    headers: { 'Content-Type': null },
  })).data
}
export const updateForumTopic = async (id, payload) => (await axiosClient.put(`${root}/topics/${id}`, payload)).data
export const deleteForumTopic = async (id) => axiosClient.delete(`${root}/topics/${id}`)
export const replyForumTopic = async (id, content) => (
  await axiosClient.post(`${root}/topics/${id}/replies`, { content })
).data
export const bookmarkForumTopic = async (id, saved) => (
  saved
    ? axiosClient.post(`${root}/topics/${id}/bookmark`)
    : axiosClient.delete(`${root}/topics/${id}/bookmark`)
)
export const reportForumTopic = async (topicId, reason) => (
  await axiosClient.post(`${root}/reports`, null, { params: { topicId, reason } })
).data
export const uploadForumAttachment = async (id, file) => {
  const body = new FormData()
  body.append('file', file)
  return (await axiosClient.post(`${root}/topics/${id}/attachments`, body, {
    headers: { 'Content-Type': null },
  })).data
}
export const downloadForumAttachment = async (id) => (
  await axiosClient.get(`${root}/attachments/${id}/download`, { responseType: 'blob' })
).data
