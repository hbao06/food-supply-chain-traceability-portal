const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, code, details, retryAfter, serverMessage) {
    super(code || 'API request failed')
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
    this.serverMessage = serverMessage
  }
}

async function request(path, { token, ...options } = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const maxAttempts = method === 'GET' ? 2 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        continue
      }
      throw new ApiError(0, 'NETWORK_ERROR')
    }

    const retryAfterHeader = response.headers?.get?.('Retry-After')
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) || retryAfterHeader : undefined

    let data
    try {
      data = await response.json()
    } catch {
      if ([502, 503, 504].includes(response.status)) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 300))
          continue
        }
        throw new ApiError(response.status, 'API_UNAVAILABLE', undefined, retryAfter)
      }
      throw new ApiError(response.status, 'INVALID_RESPONSE', undefined, retryAfter)
    }
    if (!response.ok) throw new ApiError(response.status, data?.code, data?.details, retryAfter, data?.message)
    return data
  }
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: (token) => request('/users/me', { token }),
  updateMe: (token, body) => request('/users/me', { method: 'PATCH', token, body: JSON.stringify(body) }),

  listBatches: (token, { status, q, scope, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (q && q.trim()) params.set('q', q.trim())
    if (scope && scope !== 'mine') params.set('scope', scope)
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

  listRecentPublicTraces: (limit = 6) => request(`/trace/recent?limit=${encodeURIComponent(limit)}`),
  traceByToken: (qrToken) => request(`/trace/${encodeURIComponent(qrToken)}`),
  traceByCode: (batchCode) => request(`/trace/code/${encodeURIComponent(batchCode)}`),

  listAuditLogs: (token, { batchId, actorId, entityType, action, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams()
    if (batchId) params.set('batchId', String(batchId))
    if (actorId) params.set('actorId', String(actorId))
    if (entityType) params.set('entityType', entityType)
    if (action) params.set('action', action)
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/audit-logs${query ? `?${query}` : ''}`, { token })
  },
  verifyAuditChain: (token, batchId) => {
    const query = batchId ? `?batchId=${encodeURIComponent(batchId)}` : ''
    return request(`/audit-logs/verify${query}`, { token })
  },

  // Admin: Users & Organizations
  listUsers: (token, { status, role, page = 1, limit = 50 } = {}) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (role) params.set('role', role)
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/users${query ? `?${query}` : ''}`, { token })
  },
  changeUserRole: (token, userId, body) =>
    request(`/users/${userId}/role`, { method: 'PATCH', token, body: JSON.stringify(body) }),
  assignUserOrganization: (token, userId, body) =>
    request(`/users/${userId}/organization`, { method: 'PATCH', token, body: JSON.stringify(body) }),
  changeUserStatus: (token, userId, body) =>
    request(`/users/${userId}/status`, { method: 'PATCH', token, body: JSON.stringify(body) }),

  listOrganizations: (token, { type, page = 1, limit = 50 } = {}) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const query = params.toString()
    return request(`/organizations${query ? `?${query}` : ''}`, { token })
  },
  createOrganization: (token, body) =>
    request('/organizations', { method: 'POST', token, body: JSON.stringify(body) }),
  updateOrganization: (token, organizationId, body) =>
    request(`/organizations/${organizationId}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
}

const messages = {
  NETWORK_ERROR: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.',
  API_UNAVAILABLE: 'Máy chủ API tạm thời chưa phản hồi. Vui lòng thử lại sau giây lát.',
  DATABASE_UNAVAILABLE: 'Hệ thống chưa kết nối được cơ sở dữ liệu. Vui lòng kiểm tra lại dịch vụ PostgreSQL.',
  INVALID_RESPONSE: 'Phản hồi từ máy chủ không hợp lệ.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_PENDING: 'Tài khoản đang chờ quản trị viên duyệt.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khóa.',
  EMAIL_EXISTS: 'Email này đã được sử dụng.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  VALIDATION_ERROR: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  NO_ORGANIZATION: 'Tài khoản chưa thuộc đơn vị nào nên chưa thể thao tác.',
  BATCH_NOT_EDITABLE: 'Lô đã chuyển sang trạng thái tiếp theo trong chuỗi cung ứng, không thể chỉnh sửa.',
  INVALID_SEQUENCE: 'Sự kiện không đúng thứ tự hợp lệ của chuỗi cung ứng.',
  ALREADY_EXISTS: 'Sự kiện này đã được ghi nhận trước đó cho lô hàng.',
  NOT_FOUND: 'Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này đối với vai trò hiện tại.',
  TOO_MANY_REQUESTS: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
  HASH_MISMATCH: 'Cảnh báo: Phát hiện sai lệch chuỗi băm dữ liệu kiểm toán.',
  HASH_CHAIN_BROKEN: 'Cảnh báo tính toàn vẹn: Chuỗi băm lịch sử sự kiện bị gián đoạn.',
  INVALID_CODE: 'Mã lô hàng không đúng định dạng FR-YYYY-NNNN.',
  UNAUTHORIZED: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.',
  ORGANIZATION_REQUIRED: 'Cần gán đơn vị phù hợp trước khi duyệt hoặc mở khóa tài khoản.',
  ORG_TYPE_MISMATCH: 'Loại đơn vị không khớp với vai trò của tài khoản.',
  ORGANIZATION_EXISTS: 'Đơn vị cùng tên và cùng loại đã tồn tại.',
  ORGANIZATION_IN_USE: 'Đơn vị đã có thành viên hoặc lô hàng, không thể đổi loại.',
  CANNOT_MODIFY_SELF: 'Không thể tự thay đổi trạng thái tài khoản của chính mình.',
  LAST_ADMIN: 'Không thể khóa tài khoản Quản trị viên hoạt động cuối cùng.',
  ADMIN_HAS_NO_ORGANIZATION: 'Tài khoản Quản trị viên không thuộc đơn vị cụ thể nào.',
  ROLE_CHANGE_NOT_ALLOWED: 'Không thể thay đổi vai trò của tài khoản Quản trị viên qua API.',
}

export function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Đã xảy ra lỗi. Vui lòng thử lại.'
  if (messages[error.code]) return messages[error.code]
  if (error.serverMessage) return error.serverMessage
  return error.status >= 500
    ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
    : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'
}
