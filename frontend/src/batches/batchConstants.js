export const BATCH_STATUSES = [
  'CREATED',
  'TRANSPORTED',
  'RECEIVED',
  'PROCESSED',
  'PACKAGED',
  'SHIPPED',
]

export const ROLE_LABELS_VI = {
  FARMER: 'Nông trại',
  PROCESSOR: 'Cơ sở chế biến',
  DISTRIBUTOR: 'Đơn vị phân phối',
  ADMIN: 'Quản trị viên',
}

export const STATUS_META = {
  CREATED: {
    label: 'Mới khởi tạo',
    shortLabel: 'Khởi tạo',
    color: 'emerald',
    badgeClass: 'status-created',
    step: 1,
    description: 'Lô hàng vừa được nông dân khởi tạo tại cơ sở canh tác.',
    canEdit: true,
  },
  TRANSPORTED: {
    label: 'Đang vận chuyển',
    shortLabel: 'Vận chuyển',
    color: 'blue',
    badgeClass: 'status-transported',
    step: 2,
    description: 'Đang trong quá trình vận chuyển lạnh từ nông trại đến kho tiếp nhận.',
    canEdit: false,
  },
  RECEIVED: {
    label: 'Đã tiếp nhận',
    shortLabel: 'Tiếp nhận',
    color: 'indigo',
    badgeClass: 'status-received',
    step: 3,
    description: 'Kho trung chuyển hoặc cơ sở chế biến đã tiếp nhận và kiểm định sơ bộ.',
    canEdit: false,
  },
  PROCESSED: {
    label: 'Đã chế biến',
    shortLabel: 'Chế biến',
    color: 'amber',
    badgeClass: 'status-processed',
    step: 4,
    description: 'Đã hoàn tất quy trình sơ chế, chế biến theo tiêu chuẩn an toàn thực phẩm.',
    canEdit: false,
  },
  PACKAGED: {
    label: 'Đã đóng gói',
    shortLabel: 'Đóng gói',
    color: 'purple',
    badgeClass: 'status-packaged',
    step: 5,
    description: 'Đã hoàn thành đóng gói thành phẩm và dán tem mã QR truy xuất.',
    canEdit: false,
  },
  SHIPPED: {
    label: 'Đã xuất kho',
    shortLabel: 'Xuất kho',
    color: 'teal',
    badgeClass: 'status-shipped',
    step: 6,
    description: 'Lô hàng đã xuất kho phân phối tới hệ thống bán lẻ và người tiêu dùng.',
    canEdit: false,
  },
}

export const SUPPLY_CHAIN_STEPS = [
  { type: 'CREATED', label: 'Khởi tạo', role: 'FARMER', roleVi: 'Nông trại', iconName: 'seedling' },
  { type: 'TRANSPORTED', label: 'Vận chuyển', role: 'DISTRIBUTOR', roleVi: 'Vận chuyển', iconName: 'truck' },
  { type: 'RECEIVED', label: 'Tiếp nhận', role: 'DISTRIBUTOR', roleVi: 'Kho nhận', iconName: 'warehouse' },
  { type: 'PROCESSED', label: 'Chế biến', role: 'PROCESSOR', roleVi: 'Chế biến', iconName: 'cogs' },
  { type: 'PACKAGED', label: 'Đóng gói', role: 'PROCESSOR', roleVi: 'Đóng gói', iconName: 'box' },
  { type: 'SHIPPED', label: 'Xuất kho', role: 'DISTRIBUTOR', roleVi: 'Phân phối', iconName: 'truck-fast' },
]

export function formatQuantity(value, unit = 'kg') {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const num = Number(value)
  return `${num.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unit}`
}

export function formatDateTime(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function formatDateOnly(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    if (diffMs < 0) return 'Vừa mới đây'
    const diffMins = Math.floor(diffMs / (60 * 1000))
    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} giờ trước`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Hôm qua'
    if (diffDays < 30) return `${diffDays} ngày trước`
    return formatDateOnly(isoString)
  } catch {
    return ''
  }
}

export const NEXT_EVENT_MAP = {
  CREATED: 'TRANSPORTED',
  TRANSPORTED: 'RECEIVED',
  RECEIVED: 'PROCESSED',
  PROCESSED: 'PACKAGED',
  PACKAGED: 'SHIPPED',
  SHIPPED: null,
}

export const EVENT_ROLE_MAP = {
  TRANSPORTED: ['DISTRIBUTOR'],
  RECEIVED: ['DISTRIBUTOR'],
  PROCESSED: ['PROCESSOR'],
  PACKAGED: ['PROCESSOR'],
  SHIPPED: ['DISTRIBUTOR'],
}

export function getNextEventType(currentStatus) {
  return NEXT_EVENT_MAP[currentStatus] || null
}

export function canUserAddEvent(user, batch) {
  if (!batch || !batch.currentStatus) {
    return { allowed: false, reason: 'Dữ liệu lô hàng không hợp lệ.' }
  }
  if (batch.currentStatus === 'SHIPPED') {
    return { allowed: false, reason: 'Lô hàng đã hoàn tất toàn bộ chuỗi cung ứng (Đã xuất kho).' }
  }
  const nextType = NEXT_EVENT_MAP[batch.currentStatus]
  if (!nextType) {
    return { allowed: false, reason: 'Lô hàng đã ở giai đoạn cuối cùng.' }
  }
  if (!user) {
    return { allowed: false, reason: 'Vui lòng đăng nhập để ghi nhận sự kiện.' }
  }
  if (user.role === 'ADMIN') {
    return {
      allowed: false,
      reason: 'Quản trị viên chỉ xem và giám sát hệ thống, không trực tiếp ghi nhận sự kiện chuỗi cung ứng.',
      nextType,
    }
  }
  if (user.role === 'FARMER') {
    return {
      allowed: false,
      reason: 'Nông trại chỉ khởi tạo lô hàng, các sự kiện tiếp theo do đơn vị phân phối hoặc cơ sở chế biến ghi nhận.',
      nextType,
    }
  }

  const allowedRoles = EVENT_ROLE_MAP[nextType] || []
  if (allowedRoles.includes(user.role)) {
    return { allowed: true, nextType }
  }
  const allowedRoleNames = allowedRoles.map((r) => ROLE_LABELS_VI[r] || r).join(' hoặc ')
  return {
    allowed: false,
    reason: `Giai đoạn tiếp theo (${STATUS_META[nextType]?.label || nextType}) yêu cầu vai trò: ${allowedRoleNames}.`,
    nextType,
  }
}

export function productImage(name = '') {
  const n = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  if (/ca phe|cafe|coffee/.test(n)) return '/products/coffee.jpg'
  if (/sau rieng/.test(n)) return '/products/durian.jpg'
  if (/thanh long/.test(n)) return '/products/dragonfruit.jpg'
  if (/\b(gao|lua)\b/.test(n)) return '/products/rice.jpg'
  if (/\bdieu\b/.test(n)) return '/products/cashew.jpg'
  if (/\b(che|tra)\b/.test(n)) return '/products/tea.jpg'
  return '/products/warehouse.jpg'
}

export function resolveBatchImage(batchOrName, explicitUrl) {
  if (batchOrName && typeof batchOrName === 'object') {
    const url = typeof batchOrName.imageUrl === 'string' ? batchOrName.imageUrl.trim() : ''
    if (url) return url
    return productImage(batchOrName.productName || '')
  }
  const url = typeof explicitUrl === 'string' ? explicitUrl.trim() : ''
  if (url) return url
  return productImage(batchOrName || '')
}
