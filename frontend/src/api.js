const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, code, details) {
    super(code || 'API request failed')
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, { token, ...options } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR')
  }

  let data
  try {
    data = await response.json()
  } catch {
    if ([502, 503, 504].includes(response.status)) {
      throw new ApiError(response.status, 'API_UNAVAILABLE')
    }
    throw new ApiError(response.status, 'INVALID_RESPONSE')
  }
  if (!response.ok) throw new ApiError(response.status, data?.code, data?.details)
  return data
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: (token) => request('/users/me', { token }),
  updateMe: (token, body) => request('/users/me', { method: 'PATCH', token, body: JSON.stringify(body) }),
}

const messages = {
  NETWORK_ERROR: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
  API_UNAVAILABLE: 'API tài khoản chưa chạy. Vui lòng khởi động backend rồi thử lại.',
  INVALID_RESPONSE: 'Phản hồi từ máy chủ không hợp lệ.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_PENDING: 'Tài khoản đang chờ duyệt.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khóa.',
  EMAIL_EXISTS: 'Email đã được sử dụng.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
}

export function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Đã xảy ra lỗi. Vui lòng thử lại.'
  return messages[error.code] || (error.status >= 500
    ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
    : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
}
