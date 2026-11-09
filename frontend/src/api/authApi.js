import axiosClient from './axiosClient'

export const authApi = {
  // Đăng ký 3 bước: gửi mã -> xác thực mã (nhận verificationToken) -> tạo tài khoản
  sendRegisterCode: (email) => axiosClient.post('/api/auth/register/send-code', { email }),
  verifyRegisterCode: (email, code) => axiosClient.post('/api/auth/register/verify-code', { email, code }),
  register: (payload) => axiosClient.post('/api/auth/register', payload),
  // Quên mật khẩu: gửi mã -> xác thực mã (nhận resetToken + danh sách tài khoản) -> đặt mật khẩu mới
  sendForgotPasswordCode: (email) => axiosClient.post('/api/auth/forgot-password/send-code', { email }),
  verifyForgotPasswordCode: (email, code) => axiosClient.post('/api/auth/forgot-password/verify-code', { email, code }),
  resetPassword: (payload) => axiosClient.post('/api/auth/forgot-password/reset', payload),
  login: (payload) => axiosClient.post('/api/auth/login', payload),
  refresh: (refreshToken) => axiosClient.post('/api/auth/refresh', { refreshToken }),
  logout: () => axiosClient.post('/api/auth/logout'),
}
