import {
  BATCH_STATUSES,
  PREVIEW_BATCHES,
  PREVIEW_EVENTS,
  STATUS_META,
} from '../batches/batchConstants.js'

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function buildTraceRoute(mode, identifier, { preview = false } = {}) {
  const encoded = encodeURIComponent(identifier)
  const base = mode === 'token' ? `/trace/${encoded}` : `/trace/code/${encoded}`
  return preview ? `${base}?preview=1` : base
}

export function parseTraceRoute(path) {
  const cleanPath = String(path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  if (cleanPath === '/trace' || cleanPath === '/trace/code') {
    return { name: 'trace-search' }
  }
  const codeMatch = cleanPath.match(/^\/trace\/code\/(.+)$/)
  if (codeMatch) {
    return {
      name: 'trace-result',
      mode: 'code',
      identifier: safeDecode(codeMatch[1]),
    }
  }
  const tokenMatch = cleanPath.match(/^\/trace\/(.+)$/)
  if (tokenMatch) {
    return {
      name: 'trace-result',
      mode: 'token',
      identifier: safeDecode(tokenMatch[1]),
    }
  }
  return null
}

export function parseTraceInput(rawInput) {
  const trimmed = String(rawInput ?? '').trim()
  if (!trimmed) {
    return { valid: false, error: 'Vui lòng nhập mã lô để tra cứu.' }
  }
  if (trimmed.length > 255) {
    return { valid: false, error: 'Mã tra cứu quá dài (tối đa 255 ký tự).' }
  }

  // Handle full URLs encoded in QR codes (e.g. https://domain/trace/<qrToken>)
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed)
      const parsedRoute = parseTraceRoute(parsedUrl.pathname)
      if (parsedRoute?.name === 'trace-result' && parsedRoute.identifier) {
        return {
          valid: true,
          mode: parsedRoute.mode,
          identifier: parsedRoute.identifier,
          route: buildTraceRoute(parsedRoute.mode, parsedRoute.identifier),
        }
      }
      return { valid: false, error: 'Liên kết QR không chứa mã truy xuất hợp lệ.' }
    } catch {
      return { valid: false, error: 'Liên kết QR không đúng định dạng.' }
    }
  }

  // Handle relative /trace/... paths
  if (trimmed.startsWith('/trace/')) {
    const parsedRoute = parseTraceRoute(trimmed)
    if (parsedRoute?.name === 'trace-result' && parsedRoute.identifier) {
      return {
        valid: true,
        mode: parsedRoute.mode,
        identifier: parsedRoute.identifier,
        route: buildTraceRoute(parsedRoute.mode, parsedRoute.identifier),
      }
    }
    return { valid: false, error: 'Đường dẫn truy xuất không hợp lệ.' }
  }

  // Raw signed QR token: <batchCode>.<hmacSignature>
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex > 0 && dotIndex < trimmed.length - 1 && !/\s/.test(trimmed)) {
    return {
      valid: true,
      mode: 'token',
      identifier: trimmed,
      route: buildTraceRoute('token', trimmed),
    }
  }

  // Standard batch code (e.g. BATCH-2026-0001)
  return {
    valid: true,
    mode: 'code',
    identifier: trimmed,
    route: buildTraceRoute('code', trimmed),
  }
}

export function sanitizePublicTrace(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!raw.batchCode || !raw.productName) return null

  const rawEvents = Array.isArray(raw.events) ? raw.events : []
  const events = rawEvents
    .filter((ev) => ev && ev.eventType)
    .map((ev) => ({
      eventType: String(ev.eventType),
      location: ev.location ? String(ev.location) : '—',
      organizationName: ev.organizationName ? String(ev.organizationName) : 'Đơn vị tham gia chuỗi cung ứng',
      timestamp: ev.timestamp || null,
      ...(ev.description ? { description: String(ev.description) } : {}),
    }))
    .sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return timeA - timeB
    })

  const inferredStatus =
    raw.currentStatus ||
    (events.length > 0 ? events[events.length - 1].eventType : 'CREATED')

  return {
    batchCode: String(raw.batchCode),
    productName: String(raw.productName),
    origin: raw.origin ? String(raw.origin) : '—',
    organizationName: raw.organizationName ? String(raw.organizationName) : 'Đơn vị sản xuất',
    currentStatus: BATCH_STATUSES.includes(inferredStatus) ? inferredStatus : String(inferredStatus),
    events,
  }
}

export function extractQrTokenFromUrl(qrData) {
  if (!qrData || typeof qrData !== 'string') return ''
  const marker = '/trace/'
  const idx = qrData.indexOf(marker)
  if (idx === -1) return ''
  return safeDecode(qrData.slice(idx + marker.length).split('?')[0])
}

export function getPreviewPublicTrace({ mode, identifier }) {
  const target = String(identifier || '').trim()
  if (!target) return null

  const matchedBatch =
    mode === 'token'
      ? PREVIEW_BATCHES.find((b) => extractQrTokenFromUrl(b.qrData) === target)
      : PREVIEW_BATCHES.find((b) => b.batchCode.toUpperCase() === target.toUpperCase())

  if (!matchedBatch) return null

  const events = PREVIEW_EVENTS[matchedBatch.batchId] || [
    {
      eventType: 'CREATED',
      location: matchedBatch.origin,
      organizationName: matchedBatch.organizationName,
      timestamp: matchedBatch.creationDate,
      description: `Khởi tạo lô ${matchedBatch.productName}.`,
    },
  ]

  return sanitizePublicTrace({
    batchCode: matchedBatch.batchCode,
    productName: matchedBatch.productName,
    origin: matchedBatch.origin,
    organizationName: matchedBatch.organizationName,
    currentStatus: matchedBatch.currentStatus,
    events,
  })
}

export function classifyTraceError(error) {
  const status = error?.status
  const code = error?.code

  if (status === 404 || code === 'NOT_FOUND') {
    return {
      kind: 'not_found',
      title: 'Không tìm thấy thông tin truy xuất hợp lệ',
      message:
        'Mã lô không tồn tại hoặc mã QR không hợp lệ. Vui lòng kiểm tra lại mã trên tem nhãn sản phẩm và thử lại.',
      retryable: false,
    }
  }

  if (status === 429 || code === 'TOO_MANY_REQUESTS') {
    const waitHint =
      typeof error?.retryAfter === 'number' && error.retryAfter > 0
        ? ` (vui lòng chờ khoảng ${error.retryAfter} giây)`
        : ''
    return {
      kind: 'rate_limited',
      title: 'Bạn thao tác quá nhanh',
      message: `Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút${waitHint}.`,
      retryable: true,
    }
  }

  return {
    kind: 'network_error',
    title: 'Không thể tải kết quả truy xuất',
    message:
      'Kết nối tới máy chủ bị gián đoạn hoặc hệ thống đang bảo trì. Chưa thể xác minh mã lúc này — vui lòng giữ nguyên mã và thử lại.',
    retryable: true,
  }
}

export function getTraceProgress(currentStatus) {
  const idx = BATCH_STATUSES.indexOf(currentStatus)
  const completedSteps = idx >= 0 ? idx + 1 : 1
  const totalSteps = BATCH_STATUSES.length
  const percent = Math.min(100, Math.round((completedSteps / totalSteps) * 100))
  const statusMeta = STATUS_META[currentStatus] || {
    label: currentStatus || 'Đang cập nhật',
    description: '',
  }
  return { completedSteps, totalSteps, percent, statusMeta }
}
