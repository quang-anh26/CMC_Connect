// Chuyển lỗi axios thành thông báo tiếng Việt thân thiện cho người dùng.
export function getApiErrorMessage(err, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') {
  if (!err?.response) {
    return 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
  }
  const data = err.response.data
  if (data?.message) return data.message
  if (data && typeof data === 'object') {
    const first = Object.values(data).find((v) => typeof v === 'string')
    if (first) return first
  }
  return fallback
}

// Lỗi validation của backend có dạng { tenTruong: 'thông báo' } -> dùng để hiện lỗi dưới từng ô.
export function getFieldErrors(err) {
  const data = err?.response?.data
  if (err?.response?.status === 400 && data && typeof data === 'object' && !data.message) {
    return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string'))
  }
  return {}
}
