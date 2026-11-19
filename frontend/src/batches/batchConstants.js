export const BATCH_STATUSES = [
  'CREATED',
  'TRANSPORTED',
  'RECEIVED',
  'PROCESSED',
  'PACKAGED',
  'SHIPPED',
]

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

// Dữ liệu mẫu đồng bộ chuẩn mã FR-2026-xxxx với CSDL demo cố định (backend/src/db/seedDemo.js)
export const PREVIEW_BATCHES = [
  {
    batchId: 101,
    batchCode: 'FR-2026-0001',
    productName: 'Cà phê Arabica Cầu Đất',
    category: 'Cà phê đặc sản',
    origin: 'Cầu Đất, Đà Lạt, Lâm Đồng',
    quantity: 500,
    currentStatus: 'CREATED',
    creationDate: '2026-11-16T08:30:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
    qrData: 'http://localhost:5173/trace/FR-2026-0001.c3167123984dfb1',
  },
  {
    batchId: 102,
    batchCode: 'FR-2026-0002',
    productName: 'Cà phê Robusta rang xay',
    category: 'Cà phê rang mộc',
    origin: 'Cầu Đất, Đà Lạt, Lâm Đồng',
    quantity: 300,
    currentStatus: 'SHIPPED',
    creationDate: '2026-11-06T08:30:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
    qrData: 'http://localhost:5173/trace/FR-2026-0002.8f01b921a2c34d',
  },
  {
    batchId: 103,
    batchCode: 'FR-2026-0003',
    productName: 'Cà phê Arabica Cầu Đất',
    category: 'Cà phê đặc sản',
    origin: 'Cầu Đất, Đà Lạt, Lâm Đồng',
    quantity: 200,
    currentStatus: 'RECEIVED',
    creationDate: '2026-11-12T09:40:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
    qrData: 'http://localhost:5173/trace/FR-2026-0003.5e9a03b12389d0',
  },
  {
    batchId: 104,
    batchCode: 'FR-2026-0004',
    productName: 'Cà phê Arabica Cầu Đất',
    category: 'Cà phê đặc sản',
    origin: 'Cầu Đất, Đà Lạt, Lâm Đồng',
    quantity: 120,
    currentStatus: 'TRANSPORTED',
    creationDate: '2026-11-15T11:20:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
    qrData: 'http://localhost:5173/trace/FR-2026-0004.7a3b49f0183cd2',
  },
  {
    batchId: 105,
    batchCode: 'FR-2026-0005',
    productName: 'Cà phê Robusta rang xay',
    category: 'Cà phê rang mộc',
    origin: 'Cầu Đất, Đà Lạt, Lâm Đồng',
    quantity: 250,
    currentStatus: 'PROCESSED',
    creationDate: '2026-11-10T16:05:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
    qrData: 'http://localhost:5173/trace/FR-2026-0005.1b2d3f4a5c6e78',
  },
  {
    batchId: 106,
    batchCode: 'FR-2026-0101',
    productName: 'Sầu riêng Ri6 Cái Mơn',
    category: 'Trái cây tươi',
    origin: 'Chợ Lách, Bến Tre',
    quantity: 1000,
    currentStatus: 'PACKAGED',
    creationDate: '2026-11-09T07:15:00.000Z',
    createdBy: 3,
    organizationId: 2,
    organizationName: 'Nông trại Sầu riêng Cái Mơn',
    qrData: 'http://localhost:5173/trace/FR-2026-0101.4c5d6e7f8a9b01',
  },
  {
    batchId: 107,
    batchCode: 'FR-2026-0102',
    productName: 'Sầu riêng Ri6 Cái Mơn',
    category: 'Trái cây tươi',
    origin: 'Chợ Lách, Bến Tre',
    quantity: 150,
    currentStatus: 'CREATED',
    creationDate: '2026-11-17T07:15:00.000Z',
    createdBy: 3,
    organizationId: 2,
    organizationName: 'Nông trại Sầu riêng Cái Mơn',
    qrData: 'http://localhost:5173/trace/FR-2026-0102.9d8e7f6a5b4c32',
  },
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
    return { allowed: false, reason: 'Lô hàng đã hoàn tất toàn bộ chuỗi cung ứng (SHIPPED).' }
  }
  const nextType = NEXT_EVENT_MAP[batch.currentStatus]
  if (!nextType) {
    return { allowed: false, reason: 'Lô hàng đã ở giai đoạn cuối cùng.' }
  }
  if (!user) return { allowed: true, nextType }
  if (user.role === 'ADMIN') {
    return {
      allowed: false,
      reason: 'Quản trị viên (Admin) chỉ xem và giám sát hệ thống, không trực tiếp ghi nhận sự kiện chuỗi cung ứng.',
      nextType,
    }
  }
  if (user.role === 'FARMER') {
    return {
      allowed: false,
      reason: 'Nhà sản xuất (Farmer) chỉ khởi tạo lô hàng, các sự kiện chuỗi cung ứng do đơn vị vận chuyển hoặc chế biến ghi nhận.',
      nextType,
    }
  }

  const allowedRoles = EVENT_ROLE_MAP[nextType] || []
  if (allowedRoles.includes(user.role)) {
    return { allowed: true, nextType }
  }
  return {
    allowed: false,
    reason: `Giai đoạn tiếp theo (${STATUS_META[nextType]?.label || nextType}) yêu cầu vai trò: ${allowedRoles.join(' hoặc ')}.`,
    nextType,
  }
}

export const PREVIEW_EVENTS = {
  101: [
    {
      eventId: 1001,
      batchId: 101,
      actorId: 2,
      actorName: 'Nguyễn Văn An',
      organizationName: 'HTX Cà phê Cầu Đất',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-16T08:30:00.000Z',
      location: 'Cầu Đất, Đà Lạt, Lâm Đồng',
      description: 'Thu hoạch cà phê Arabica chín mọng đạt chuẩn VietGAP, khởi tạo lô và dán mã định danh FR-.',
    },
  ],
  102: [
    {
      eventId: 1002,
      batchId: 102,
      actorId: 2,
      actorName: 'Nguyễn Văn An',
      organizationName: 'HTX Cà phê Cầu Đất',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-06T08:30:00.000Z',
      location: 'Cầu Đất, Đà Lạt, Lâm Đồng',
      description: 'Thu hoạch và sơ chế 300 kg cà phê Robusta nguyên liệu chất lượng cao.',
    },
    {
      eventId: 1003,
      batchId: 102,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-07T08:30:00.000Z',
      location: 'QL20, Đà Lạt → TP.HCM',
      description: 'Vận chuyển bằng xe lạnh tiêu chuẩn nhiệt độ 2–8°C.',
    },
    {
      eventId: 1004,
      batchId: 102,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-11-08T08:30:00.000Z',
      location: 'Kho Quận 7, TP.HCM',
      description: 'Tiếp nhận đủ 300 kg, đạt độ ẩm tiêu chuẩn kiểm nghiệm.',
    },
    {
      eventId: 1005,
      batchId: 102,
      actorId: 4,
      actorName: 'Lê Văn Chế',
      organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
      role: 'PROCESSOR',
      eventType: 'PROCESSED',
      timestamp: '2026-11-09T08:30:00.000Z',
      location: 'Xưởng Tân Bình, TP.HCM',
      description: 'Rang mộc 220°C theo quy trình HACCP.',
    },
    {
      eventId: 1006,
      batchId: 102,
      actorId: 4,
      actorName: 'Lê Văn Chế',
      organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
      role: 'PROCESSOR',
      eventType: 'PACKAGED',
      timestamp: '2026-11-10T08:30:00.000Z',
      location: 'Xưởng Tân Bình, TP.HCM',
      description: 'Đóng túi van một chiều 500 g và dán tem QR truy xuất.',
    },
    {
      eventId: 1007,
      batchId: 102,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'SHIPPED',
      timestamp: '2026-11-11T08:30:00.000Z',
      location: 'Hệ thống Siêu thị Quận 1, TP.HCM',
      description: 'Xuất kho phân phối chính thức tới điểm bán lẻ.',
    },
  ],
  103: [
    {
      eventId: 1008,
      batchId: 103,
      actorId: 2,
      actorName: 'Nguyễn Văn An',
      organizationName: 'HTX Cà phê Cầu Đất',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-12T09:40:00.000Z',
      location: 'Cầu Đất, Đà Lạt, Lâm Đồng',
      description: 'Thu hoạch 200 kg Arabica Cầu Đất sơ chế ướt.',
    },
    {
      eventId: 1009,
      batchId: 103,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-13T09:40:00.000Z',
      location: 'QL20, Đà Lạt → TP.HCM',
      description: 'Vận chuyển tuyến cao tốc về kho trung chuyển.',
    },
    {
      eventId: 1010,
      batchId: 103,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-11-14T09:40:00.000Z',
      location: 'Kho Quận 7, TP.HCM',
      description: 'Đã kiểm định sơ bộ, chờ chuyển xưởng chế biến.',
    },
  ],
  104: [
    {
      eventId: 1011,
      batchId: 104,
      actorId: 2,
      actorName: 'Nguyễn Văn An',
      organizationName: 'HTX Cà phê Cầu Đất',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-15T11:20:00.000Z',
      location: 'Cầu Đất, Đà Lạt, Lâm Đồng',
      description: 'Khởi tạo lô 120 kg Arabica xuất kho miền Bắc.',
    },
    {
      eventId: 1012,
      batchId: 104,
      actorId: 6,
      actorName: 'Hoàng Thị Em',
      organizationName: 'Phân phối Thực phẩm Sạch Hà Nội',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-16T11:20:00.000Z',
      location: 'QL20 → QL1A, Đà Lạt → Hà Nội',
      description: 'Xe lạnh bảo quản 2–8°C trên tuyến Bắc - Nam.',
    },
  ],
  105: [
    {
      eventId: 1013,
      batchId: 105,
      actorId: 2,
      actorName: 'Nguyễn Văn An',
      organizationName: 'HTX Cà phê Cầu Đất',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-10T16:05:00.000Z',
      location: 'Cầu Đất, Đà Lạt, Lâm Đồng',
      description: 'Thu hoạch 250 kg Robusta nguyên liệu.',
    },
    {
      eventId: 1014,
      batchId: 105,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-11T16:05:00.000Z',
      location: 'QL20, Đà Lạt → TP.HCM',
      description: 'Vận chuyển đến kho TP.HCM.',
    },
    {
      eventId: 1015,
      batchId: 105,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-11-12T16:05:00.000Z',
      location: 'Kho Quận 7, TP.HCM',
      description: 'Tiếp nhận nguyên liệu đạt chuẩn.',
    },
    {
      eventId: 1016,
      batchId: 105,
      actorId: 4,
      actorName: 'Lê Văn Chế',
      organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
      role: 'PROCESSOR',
      eventType: 'PROCESSED',
      timestamp: '2026-11-13T16:05:00.000Z',
      location: 'Xưởng Tân Bình, TP.HCM',
      description: 'Rang vừa 210°C, sàng lọc hạt tiêu chuẩn.',
    },
  ],
  106: [
    {
      eventId: 1017,
      batchId: 106,
      actorId: 3,
      actorName: 'Trần Thị Bình',
      organizationName: 'Nông trại Sầu riêng Cái Mơn',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-09T07:15:00.000Z',
      location: 'Chợ Lách, Bến Tre',
      description: 'Thu hoạch 1.000 kg sầu riêng Ri6 chín cây.',
    },
    {
      eventId: 1018,
      batchId: 106,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-10T07:15:00.000Z',
      location: 'QL57, Bến Tre → TP.HCM',
      description: 'Xe lạnh bảo quản 2–5°C.',
    },
    {
      eventId: 1019,
      batchId: 106,
      actorId: 5,
      actorName: 'Phạm Văn Dũng',
      organizationName: 'Vận tải Lạnh Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-11-11T07:15:00.000Z',
      location: 'Kho Quận 7, TP.HCM',
      description: 'Tiếp nhận kiểm tra ngoại quan và độ chín.',
    },
    {
      eventId: 1020,
      batchId: 106,
      actorId: 4,
      actorName: 'Lê Văn Chế',
      organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
      role: 'PROCESSOR',
      eventType: 'PROCESSED',
      timestamp: '2026-11-12T07:15:00.000Z',
      location: 'Xưởng Tân Bình, TP.HCM',
      description: 'Tách múi, cấp đông nhanh IQF.',
    },
    {
      eventId: 1021,
      batchId: 106,
      actorId: 4,
      actorName: 'Lê Văn Chế',
      organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
      role: 'PROCESSOR',
      eventType: 'PACKAGED',
      timestamp: '2026-11-13T07:15:00.000Z',
      location: 'Xưởng Tân Bình, TP.HCM',
      description: 'Đóng hộp 400 g đạt chuẩn xuất khẩu và dán tem QR.',
    },
  ],
  107: [
    {
      eventId: 1022,
      batchId: 107,
      actorId: 3,
      actorName: 'Trần Thị Bình',
      organizationName: 'Nông trại Sầu riêng Cái Mơn',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-17T07:15:00.000Z',
      location: 'Chợ Lách, Bến Tre',
      description: 'Khởi tạo lô 150 kg sầu riêng Ri6 thu hoạch buổi sáng.',
    },
  ],
}

export const PREVIEW_AUDIT_LOGS = [
  {
    auditId: 501,
    createdAt: '2026-11-16T08:30:05.000Z',
    timestamp: '2026-11-16T08:30:05.000Z',
    actorId: 2,
    actorName: 'Nguyễn Văn An',
    actorRole: 'FARMER',
    organizationName: 'HTX Cà phê Cầu Đất',
    action: 'CREATE',
    entityType: 'BATCH',
    entityId: 101,
    batchCode: 'FR-2026-0001',
    oldValue: null,
    newValue: { batchCode: 'FR-2026-0001', productName: 'Cà phê Arabica Cầu Đất', quantity: 500, origin: 'Cầu Đất, Đà Lạt, Lâm Đồng' },
    details: { productName: 'Cà phê Arabica Cầu Đất', quantity: 500, origin: 'Cầu Đất, Đà Lạt, Lâm Đồng' },
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'a718b9c20f12d45e6834bb0149e8a719c3e21fb4a6829de4f128ab09c47e812d',
    verified: true,
  },
  {
    auditId: 502,
    createdAt: '2026-11-16T08:30:06.000Z',
    timestamp: '2026-11-16T08:30:06.000Z',
    actorId: 2,
    actorName: 'Nguyễn Văn An',
    actorRole: 'FARMER',
    organizationName: 'HTX Cà phê Cầu Đất',
    action: 'CREATE',
    entityType: 'EVENT',
    entityId: 1001,
    batchCode: 'FR-2026-0001',
    oldValue: null,
    newValue: { eventType: 'CREATED', location: 'Cầu Đất, Đà Lạt, Lâm Đồng' },
    details: { eventType: 'CREATED', location: 'Cầu Đất, Đà Lạt, Lâm Đồng' },
    previousHash: 'a718b9c20f12d45e6834bb0149e8a719c3e21fb4a6829de4f128ab09c47e812d',
    hash: 'c829e1fa39401bd6a77e819b48c01df2847a9cb3847e192f02938a49c281df74',
    verified: true,
  },
  {
    auditId: 503,
    createdAt: '2026-11-16T11:20:10.000Z',
    timestamp: '2026-11-16T11:20:10.000Z',
    actorId: 6,
    actorName: 'Hoàng Thị Em',
    actorRole: 'DISTRIBUTOR',
    organizationName: 'Phân phối Thực phẩm Sạch Hà Nội',
    action: 'CREATE',
    entityType: 'EVENT',
    entityId: 1012,
    batchCode: 'FR-2026-0004',
    oldValue: null,
    newValue: { eventType: 'TRANSPORTED', location: 'QL20 → QL1A, Đà Lạt → Hà Nội' },
    details: { eventType: 'TRANSPORTED', location: 'QL20 → QL1A, Đà Lạt → Hà Nội' },
    previousHash: 'c829e1fa39401bd6a77e819b48c01df2847a9cb3847e192f02938a49c281df74',
    hash: 'e921d749a029384bc19284fa039182eb49182374ac029384ebc928471928374a',
    verified: true,
  },
  {
    auditId: 504,
    createdAt: '2026-11-13T16:05:22.000Z',
    timestamp: '2026-11-13T16:05:22.000Z',
    actorId: 4,
    actorName: 'Lê Văn Chế',
    actorRole: 'PROCESSOR',
    organizationName: 'Công ty Chế biến Nông sản Sài Gòn',
    action: 'CREATE',
    entityType: 'EVENT',
    entityId: 1016,
    batchCode: 'FR-2026-0005',
    oldValue: null,
    newValue: { eventType: 'PROCESSED', location: 'Xưởng Tân Bình, TP.HCM' },
    details: { eventType: 'PROCESSED', location: 'Xưởng Tân Bình, TP.HCM' },
    previousHash: 'e921d749a029384bc19284fa039182eb49182374ac029384ebc928471928374a',
    hash: 'b192847a01928374fc928374a0192834eb82736410293847fa0293847c019283',
    verified: true,
  },
  {
    auditId: 505,
    createdAt: '2026-11-11T08:30:00.000Z',
    timestamp: '2026-11-11T08:30:00.000Z',
    actorId: 5,
    actorName: 'Phạm Văn Dũng',
    actorRole: 'DISTRIBUTOR',
    organizationName: 'Vận tải Lạnh Miền Nam',
    action: 'CREATE',
    entityType: 'EVENT',
    entityId: 1007,
    batchCode: 'FR-2026-0002',
    oldValue: null,
    newValue: { eventType: 'SHIPPED', location: 'Hệ thống Siêu thị Quận 1, TP.HCM' },
    details: { eventType: 'SHIPPED', location: 'Hệ thống Siêu thị Quận 1, TP.HCM' },
    previousHash: 'b192847a01928374fc928374a0192834eb82736410293847fa0293847c019283',
    hash: 'f029384bc1928374a01928347eb928374ac0192834ebc9284710293847bca019',
    verified: true,
  },
]

// ---------- Ảnh sản phẩm & dữ liệu mẫu bổ sung (gạo, hạt điều, thanh long, chè) ----------
export function productImage(name = '') {
  const n = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  if (/ca phe|cafe|coffee/.test(n)) return '/products/coffee.jpg'
  if (/sau rieng/.test(n)) return '/products/durian.jpg'
  if (/gao|lua/.test(n)) return '/products/rice.jpg'
  if (/dieu/.test(n)) return '/products/cashew.jpg'
  if (/thanh long/.test(n)) return '/products/dragonfruit.jpg'
  if (/\b(che|tra)\b/.test(n)) return '/products/tea.jpg'
  return '/products/warehouse.jpg'
}

const EXTRA_PREVIEW = [
  { id: 108, code: 'FR-2026-0201', name: 'Gạo ST25 Sóc Trăng', cat: 'Lúa gạo', origin: 'Mỹ Xuyên, Sóc Trăng', qty: 5000, status: 'SHIPPED', date: '2026-11-04T08:00:00.000Z', org: 'HTX Lúa gạo ST25 Mỹ Xuyên', by: 'Lâm Thị Cúc',
    steps: [['TRANSPORTED', 'Vận tải Lạnh Miền Nam', 'QL1A, Sóc Trăng → TP.HCM', 'Xe tải thùng kín, bao 25 kg'], ['RECEIVED', 'Vận tải Lạnh Miền Nam', 'Kho Quận 7, TP.HCM', 'Kiểm tra độ ẩm 14%'], ['PROCESSED', 'Công ty Chế biến Nông sản Sài Gòn', 'Xưởng Tân Bình, TP.HCM', 'Xát trắng, đánh bóng, tách tạp chất'], ['PACKAGED', 'Công ty Chế biến Nông sản Sài Gòn', 'Xưởng Tân Bình, TP.HCM', 'Đóng túi hút chân không 5 kg'], ['SHIPPED', 'Vận tải Lạnh Miền Nam', 'Hệ thống siêu thị Quận 3, TP.HCM', 'Giao điểm bán lẻ']] },
  { id: 109, code: 'FR-2026-0202', name: 'Hạt điều rang muối Bình Phước', cat: 'Hạt dinh dưỡng', origin: 'Bù Đăng, Bình Phước', qty: 800, status: 'PACKAGED', date: '2026-11-08T08:00:00.000Z', org: 'Nông trại Hạt điều Bù Đăng', by: 'Điểu Văn Dũng',
    steps: [['TRANSPORTED', 'Vận tải Lạnh Miền Nam', 'QL14, Bình Phước → TP.HCM', 'Vận chuyển đường bộ'], ['RECEIVED', 'Vận tải Lạnh Miền Nam', 'Kho Quận 7, TP.HCM', 'Phân loại cỡ hạt W320'], ['PROCESSED', 'Công ty Chế biến Nông sản Sài Gòn', 'Xưởng Tân Bình, TP.HCM', 'Rang củi, ướp muối nhẹ'], ['PACKAGED', 'Công ty Chế biến Nông sản Sài Gòn', 'Xưởng Tân Bình, TP.HCM', 'Hũ thủy tinh 500 g']] },
  { id: 110, code: 'FR-2026-0203', name: 'Thanh long ruột đỏ VietGAP', cat: 'Trái cây tươi', origin: 'Chợ Gạo, Tiền Giang', qty: 2000, status: 'RECEIVED', date: '2026-11-13T08:00:00.000Z', org: 'HTX Thanh long Chợ Gạo', by: 'Võ Minh Tâm',
    steps: [['TRANSPORTED', 'Vận tải Lạnh Miền Nam', 'QL1A, Tiền Giang → TP.HCM', 'Xe lạnh 8–10°C'], ['RECEIVED', 'Vận tải Lạnh Miền Nam', 'Kho Quận 7, TP.HCM', 'Kiểm tra ngoại quan, độ ngọt Brix 15']] },
  { id: 111, code: 'FR-2026-0204', name: 'Chè Ô Long Mộc Châu', cat: 'Trà', origin: 'Mộc Châu, Sơn La', qty: 350, status: 'RECEIVED', date: '2026-11-14T08:00:00.000Z', org: 'HTX Chè Ô Long Mộc Châu', by: 'Hà Thị Mai',
    steps: [['TRANSPORTED', 'Phân phối Thực phẩm Sạch Hà Nội', 'QL6, Sơn La → Hà Nội', 'Vận chuyển đường bộ'], ['RECEIVED', 'Phân phối Thực phẩm Sạch Hà Nội', 'Kho Long Biên, Hà Nội', 'Nhập kho bảo quản khô thoáng']] },
]

EXTRA_PREVIEW.forEach((p, i) => {
  PREVIEW_BATCHES.push({
    batchId: p.id, batchCode: p.code, productName: p.name, category: p.cat, origin: p.origin, quantity: p.qty,
    currentStatus: p.status, creationDate: p.date, createdBy: 10 + i, organizationId: 10 + i, organizationName: p.org,
    qrData: `http://localhost:5173/trace/${p.code}.demo${p.id}sig`,
  })
  const base = new Date(p.date).getTime()
  PREVIEW_EVENTS[p.id] = [
    { eventId: 2000 + p.id * 10, batchId: p.id, actorName: p.by, organizationName: p.org, role: 'FARMER', eventType: 'CREATED', timestamp: p.date, location: p.origin, description: `Thu hoạch và khởi tạo lô ${p.name}.` },
    ...p.steps.map(([type, org, location, description], k) => ({
      eventId: 2000 + p.id * 10 + k + 1, batchId: p.id, actorName: org, organizationName: org,
      role: type === 'PROCESSED' || type === 'PACKAGED' ? 'PROCESSOR' : 'DISTRIBUTOR', eventType: type,
      timestamp: new Date(base + (k + 1) * 86400000).toISOString(), location, description,
    })),
  ]
})

export const DEMO_BATCH_SHORTCUTS = [
  { id: 'FR-2026-0001', label: 'Cà phê Arabica Cầu Đất' },
  { id: 'FR-2026-0201', label: 'Gạo ST25 Sóc Trăng' },
  { id: 'FR-2026-0202', label: 'Hạt điều Bình Phước' },
  { id: 'FR-2026-0203', label: 'Thanh long Tiền Giang' },
  { id: 'FR-2026-0204', label: 'Chè Ô Long Mộc Châu' },
  { id: 'FR-2026-0002', label: 'Sầu riêng Ri6 Bến Tre' },
]

