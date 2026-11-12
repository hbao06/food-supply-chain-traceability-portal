const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, code, details, retryAfter) {
    super(code || 'API request failed')
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
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

  const retryAfterHeader = response.headers?.get?.('Retry-After')
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) || retryAfterHeader : undefined

  let data
  try {
    data = await response.json()
  } catch {
    if ([502, 503, 504].includes(response.status)) {
      throw new ApiError(response.status, 'API_UNAVAILABLE', undefined, retryAfter)
    }
    throw new ApiError(response.status, 'INVALID_RESPONSE', undefined, retryAfter)
  }
  if (!response.ok) throw new ApiError(response.status, data?.code, data?.details, retryAfter)
  return data
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: (token) => request('/users/me', { token }),
  updateMe: (token, body) => request('/users/me', { method: 'PATCH', token, body: JSON.stringify(body) }),
  listBatches: (token, { status, q, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (q && q.trim()) params.set('q', q.trim())
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/batches${query ? `?${query}` : ''}`, { token })
  },
  getBatch: (token, batchId) => request(`/batches/${batchId}`, { token }),
  createBatch: (token, body) => request('/batches', { method: 'POST', token, body: JSON.stringify(body) }),
  updateBatch: (token, batchId, body) => request(`/batches/${batchId}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
  getBatchQr: (token, batchId) => request(`/batches/${batchId}/qr`, { token }),
  listEvents: (token, batchId) => request(`/batches/${batchId}/events`, { token }),
  createEvent: (token, batchId, body) =>
    request(`/batches/${batchId}/events`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
  getTimeline: (token, batchId) => request(`/batches/${batchId}/timeline`, { token }),
  traceByToken: (qrToken) => request(`/trace/${encodeURIComponent(qrToken)}`),
  traceByCode: (batchCode) => request(`/trace/code/${encodeURIComponent(batchCode)}`),
}

const messages = {
  NETWORK_ERROR: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
  API_UNAVAILABLE: 'API hệ thống chưa chạy. Vui lòng khởi động backend rồi thử lại.',
  INVALID_RESPONSE: 'Phản hồi từ máy chủ không hợp lệ.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_PENDING: 'Tài khoản đang chờ duyệt.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khóa.',
  EMAIL_EXISTS: 'Email đã được sử dụng.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  NO_ORGANIZATION: 'Tài khoản chưa thuộc đơn vị nào nên chưa thể thao tác.',
  BATCH_NOT_EDITABLE: 'Lô đã chuyển sang trạng thái tiếp theo trong chuỗi cung ứng, không thể chỉnh sửa.',
  INVALID_SEQUENCE: 'Sự kiện không đúng thứ tự hợp lệ của chuỗi cung ứng.',
  ALREADY_EXISTS: 'Sự kiện này đã được ghi nhận trước đó cho lô hàng.',
  NOT_FOUND: 'Không tìm thấy lô hàng hoặc bạn không có quyền truy cập.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này đối với vai trò hiện tại.',
  TOO_MANY_REQUESTS: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
}

export function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Đã xảy ra lỗi. Vui lòng thử lại.'
  return messages[error.code] || (error.status >= 500
    ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
    : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
}
