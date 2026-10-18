import axiosClient from './axiosClient'

export const authApi = {
  // Đăng ký 3 bước: gửi mã -> xác thực mã (nhận verificationToken) -> tạo tài khoản
  sendRegisterCode: (email) => axiosClient.post('/api/auth/register/send-code', { email }),
  verifyRegisterCode: (email, code) => axiosClient.post('/api/auth/register/verify-code', { email, code }),
  register: (payload) => axiosClient.post('/api/auth/register', payload),
  login: (payload) => axiosClient.post('/api/auth/login', payload),
  refresh: (refreshToken) => axiosClient.post('/api/auth/refresh', { refreshToken }),
  logout: () => axiosClient.post('/api/auth/logout'),
}
