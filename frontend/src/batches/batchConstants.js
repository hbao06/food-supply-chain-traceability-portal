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
    label: 'Đã tạo',
    shortLabel: 'Mới tạo',
    color: 'emerald',
    badgeClass: 'status-created',
    step: 1,
    description: 'Lô hàng vừa được nông dân khởi tạo tại cơ sở canh tác.',
    canEdit: true,
  },
  TRANSPORTED: {
    label: 'Vận chuyển',
    shortLabel: 'Đang chuyển',
    color: 'blue',
    badgeClass: 'status-transported',
    step: 2,
    description: 'Đang trong quá trình vận chuyển từ nông trại đến cơ sở tiếp nhận.',
    canEdit: false,
  },
  RECEIVED: {
    label: 'Tiếp nhận',
    shortLabel: 'Đã nhận',
    color: 'indigo',
    badgeClass: 'status-received',
    step: 3,
    description: 'Cơ sở chế biến hoặc đơn vị thu mua đã tiếp nhận lô hàng.',
    canEdit: false,
  },
  PROCESSED: {
    label: 'Chế biến',
    shortLabel: 'Đã chế biến',
    color: 'amber',
    badgeClass: 'status-processed',
    step: 4,
    description: 'Đã hoàn tất quy trình sơ chế, chế biến theo tiêu chuẩn chất lượng.',
    canEdit: false,
  },
  PACKAGED: {
    label: 'Đóng gói',
    shortLabel: 'Đã đóng gói',
    color: 'purple',
    badgeClass: 'status-packaged',
    step: 5,
    description: 'Đã hoàn thành đóng gói thành phẩm và dán nhãn tem mã QR.',
    canEdit: false,
  },
  SHIPPED: {
    label: 'Đã xuất kho',
    shortLabel: 'Xuất kho',
    color: 'teal',
    badgeClass: 'status-shipped',
    step: 6,
    description: 'Lô hàng đã xuất kho phân phối ra thị trường đến người tiêu dùng.',
    canEdit: false,
  },
}

export const SUPPLY_CHAIN_STEPS = [
  { type: 'CREATED', label: 'Khởi tạo', role: 'FARMER', iconName: 'seedling' },
  { type: 'TRANSPORTED', label: 'Vận chuyển', role: 'DISTRIBUTOR', iconName: 'truck' },
  { type: 'RECEIVED', label: 'Tiếp nhận', role: 'DISTRIBUTOR', iconName: 'warehouse' },
  { type: 'PROCESSED', label: 'Chế biến', role: 'PROCESSOR', iconName: 'cogs' },
  { type: 'PACKAGED', label: 'Đóng gói', role: 'PROCESSOR', iconName: 'box' },
  { type: 'SHIPPED', label: 'Xuất kho', role: 'DISTRIBUTOR', iconName: 'truck-fast' },
]

export const PREVIEW_BATCHES = [
  {
    batchId: 101,
    batchCode: 'BATCH-2026-0001',
    productName: 'Cà phê Arabica Cầu Đất Thượng Hạng',
    origin: 'Xã Trạm Hành, TP. Đà Lạt, Lâm Đồng',
    quantity: 1250.5,
    currentStatus: 'CREATED',
    creationDate: '2026-11-04T08:30:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Cà phê Cầu Đất',
    qrData: 'http://localhost:5173/trace/BATCH-2026-0001.c3167123984dfb1',
  },
  {
    batchId: 102,
    batchCode: 'BATCH-2026-0002',
    productName: 'Gạo ST25 Hữu Cơ Sóc Trăng',
    origin: 'Huyện Mỹ Xuyên, Tỉnh Sóc Trăng',
    quantity: 5000,
    currentStatus: 'TRANSPORTED',
    creationDate: '2026-11-03T14:15:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Nông Nghiệp Xanh',
    qrData: 'http://localhost:5173/trace/BATCH-2026-0002.8f01b921a2c34d',
  },
  {
    batchId: 103,
    batchCode: 'BATCH-2026-0003',
    productName: 'Chè Ô Long Mộc Châu Thượng Phẩm',
    origin: 'Thị trấn Nông trường Mộc Châu, Sơn La',
    quantity: 350.25,
    currentStatus: 'RECEIVED',
    creationDate: '2026-11-01T09:40:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Trà Cao Nguyên',
    qrData: 'http://localhost:5173/trace/BATCH-2026-0003.5e9a03b12389d0',
  },
  {
    batchId: 104,
    batchCode: 'BATCH-2026-0004',
    productName: 'Hạt Điều Rang Muối Bình Phước',
    origin: 'Huyện Bù Đăng, Tỉnh Bình Phước',
    quantity: 820,
    currentStatus: 'PROCESSED',
    creationDate: '2026-10-28T11:20:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'Nông trang An Phước',
    qrData: 'http://localhost:5173/trace/BATCH-2026-0004.7a3b49f0183cd2',
  },
  {
    batchId: 105,
    batchCode: 'BATCH-2026-0005',
    productName: 'Thanh Long Ruột Đỏ Chợ Gạo (VietGAP)',
    origin: 'Huyện Chợ Gạo, Tỉnh Tiền Giang',
    quantity: 3200,
    currentStatus: 'PACKAGED',
    creationDate: '2026-10-25T16:05:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'HTX Nông sản Tiền Giang',
    qrData: 'http://localhost:5173/trace/BATCH-2026-0005.1b2d3f4a5c6e78',
  },
  {
    batchId: 106,
    batchCode: 'BATCH-2026-0006',
    productName: 'Bưởi Da Xanh Bến Tre Loại 1',
    origin: 'Huyện Châu Thành, Tỉnh Bến Tre',
    quantity: 1800,
    currentStatus: 'SHIPPED',
    creationDate: '2026-10-20T07:15:00.000Z',
    createdBy: 2,
    organizationId: 1,
    organizationName: 'Nông trại Cái Mơn',
    qrData: 'http://localhost:5173/trace/BATCH-2026-0006.4c5d6e7f8a9b01',
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
      actorName: 'Nguyễn Văn An (Chủ vườn)',
      organizationName: 'HTX Cà phê Cầu Đất',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-04T08:30:00.000Z',
      location: 'Nông trường Trạm Hành, TP. Đà Lạt, Lâm Đồng',
      description: 'Khởi tạo lô cà phê Arabica Cầu Đất chín mọng 100%, thu hoạch đạt tiêu chuẩn VietGAP.',
    },
  ],
  102: [
    {
      eventId: 1002,
      batchId: 102,
      actorId: 2,
      actorName: 'Lê Văn Lúa',
      organizationName: 'HTX Nông Nghiệp Xanh',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-03T14:15:00.000Z',
      location: 'Cánh đồng mẫu lớn Mỹ Xuyên, Tỉnh Sóc Trăng',
      description: 'Thu hoạch và sơ chế sấy ẩm lúa giống ST25 hữu cơ đạt tỷ lệ hạt đều 98%.',
    },
    {
      eventId: 1003,
      batchId: 102,
      actorId: 4,
      actorName: 'Trần Hữu Vận (Tài xế logistics)',
      organizationName: 'Công ty Vận tải Mekong Xanh',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-04T09:00:00.000Z',
      location: 'Trạm logistics Phụng Hiệp, Hậu Giang',
      description: 'Vận chuyển 5 tấn lúa ST25 bằng xe thùng kín chuyên dụng số hiệu 65C-142.88.',
    },
  ],
  103: [
    {
      eventId: 1004,
      batchId: 103,
      actorId: 2,
      actorName: 'Hoàng Thị Trà',
      organizationName: 'HTX Trà Cao Nguyên',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-11-01T09:40:00.000Z',
      location: 'Đồi chè Nông trường Mộc Châu, Sơn La',
      description: 'Hái búp trà Ô Long tươi vào sáng sớm đạt chuẩn 1 tôm 2 lá vùng núi cao.',
    },
    {
      eventId: 1005,
      batchId: 103,
      actorId: 4,
      actorName: 'Vũ Văn Tài',
      organizationName: 'Đội Vận tải Tây Bắc',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-11-01T15:30:00.000Z',
      location: 'Tuyến đường đèo Thung Khe, Hòa Bình',
      description: 'Vận chuyển búp trà bảo quản trong sọt tre thông gió thoáng mát.',
    },
    {
      eventId: 1006,
      batchId: 103,
      actorId: 3,
      actorName: 'Đặng Đình Kiểm (KCS Kho vận)',
      organizationName: 'Đội Vận tải Tây Bắc',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-11-02T07:15:00.000Z',
      location: 'Kho tiếp nhận nguyên liệu, KCN Thạch Thất, Hà Nội',
      description: 'Kiểm nghiệm dư lượng, độ tươi và bàn giao nguyên liệu vào phòng mát 18°C.',
    },
  ],
  104: [
    {
      eventId: 1007,
      batchId: 104,
      actorId: 2,
      actorName: 'Trần Nông',
      organizationName: 'Nông trang An Phước',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-10-28T11:20:00.000Z',
      location: 'Xã Đắk Nhau, Huyện Bù Đăng, Bình Phước',
      description: 'Thu hoạch 820 kg hạt điều tươi chất lượng cao.',
    },
    {
      eventId: 1008,
      batchId: 104,
      actorId: 4,
      actorName: 'Lý Tấn',
      organizationName: 'Vận tải Đông Nam Bộ',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-10-29T08:00:00.000Z',
      location: 'Trạm cân Quốc lộ 14, Đồng Xoài, Bình Phước',
      description: 'Vận chuyển đến xưởng chế biến nông sản tập trung.',
    },
    {
      eventId: 1009,
      batchId: 104,
      actorId: 3,
      actorName: 'Bùi Bích (Điều phối giao nhận)',
      organizationName: 'Vận tải Đông Nam Bộ',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-10-29T13:30:00.000Z',
      location: 'Xưởng chế biến số 3, TX. Phước Long, Bình Phước',
      description: 'Tiếp nhận phân loại kích cỡ hạt điều chuẩn xuất khẩu W240.',
    },
    {
      eventId: 1010,
      batchId: 104,
      actorId: 3,
      actorName: 'Nguyễn Văn Chế (Trưởng ca)',
      organizationName: 'Cơ sở Chế biến Phước Long',
      role: 'PROCESSOR',
      eventType: 'PROCESSED',
      timestamp: '2026-10-31T16:00:00.000Z',
      location: 'Xưởng rang muối củi Phước Long, Bình Phước',
      description: 'Rang củi điều truyền thống, gia nhiệt 160°C kết hợp muối hạt tinh khiết.',
    },
  ],
  105: [
    {
      eventId: 1011,
      batchId: 105,
      actorId: 2,
      actorName: 'Võ Minh Trí',
      organizationName: 'HTX Nông sản Tiền Giang',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-10-25T16:05:00.000Z',
      location: 'Vườn thanh long Chợ Gạo, Tiền Giang',
      description: 'Thu hoạch thanh long ruột đỏ GlobalGAP đạt chỉ tiêu độ ngọt Brix 15+.',
    },
    {
      eventId: 1012,
      batchId: 105,
      actorId: 4,
      actorName: 'Ngô Văn Tốc',
      organizationName: 'Logistics Đồng Bằng',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-10-26T06:00:00.000Z',
      location: 'Đường cao tốc Trung Lương - TP.HCM',
      description: 'Vận chuyển xe tải lạnh 10 tấn nhiệt độ 8°C.',
    },
    {
      eventId: 1013,
      batchId: 105,
      actorId: 3,
      actorName: 'Lê Thùy Dung (Kiểm nhận kho bãi)',
      organizationName: 'Logistics Đồng Bằng',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-10-26T10:30:00.000Z',
      location: 'Khu công nghiệp Tân Hương, Tiền Giang',
      description: 'Tiếp nhận và kiểm tra ngoại quan, độ cứng trái và cuống xanh.',
    },
    {
      eventId: 1014,
      batchId: 105,
      actorId: 3,
      actorName: 'Phạm Tuấn Anh',
      organizationName: 'Nhà máy Đóng gói Rau quả Mekong',
      role: 'PROCESSOR',
      eventType: 'PROCESSED',
      timestamp: '2026-10-26T17:00:00.000Z',
      location: 'Dây chuyền rửa ozone & sấy khô tự động',
      description: 'Xử lý rửa hơi nước nóng kiểm soát vi sinh và nấm bề mặt quả.',
    },
    {
      eventId: 1015,
      batchId: 105,
      actorId: 3,
      actorName: 'Đặng Ngọc Lan (Quản lý QC)',
      organizationName: 'Nhà máy Đóng gói Rau quả Mekong',
      role: 'PROCESSOR',
      eventType: 'PACKAGED',
      timestamp: '2026-10-27T10:30:00.000Z',
      location: 'Phòng đóng gói vô trùng Tân Hương',
      description: 'Đóng thùng carton 5kg chống va đập, dán tem QR truy xuất nguồn gốc từng thùng.',
    },
  ],
  106: [
    {
      eventId: 1016,
      batchId: 106,
      actorId: 2,
      actorName: 'Nguyễn Văn Kiên',
      organizationName: 'Nông trại Cái Mơn',
      role: 'FARMER',
      eventType: 'CREATED',
      timestamp: '2026-10-20T07:15:00.000Z',
      location: 'Cù lao Chợ Lách, Bến Tre',
      description: 'Thu hoạch 1.800 kg bưởi da xanh ruột hồng chín cây.',
    },
    {
      eventId: 1017,
      batchId: 106,
      actorId: 4,
      actorName: 'Huỳnh Tấn Phát',
      organizationName: 'Vận chuyển Miền Tây Xanh',
      role: 'DISTRIBUTOR',
      eventType: 'TRANSPORTED',
      timestamp: '2026-10-20T14:30:00.000Z',
      location: 'Cầu Rạch Miễu, Bến Tre sang Tiền Giang',
      description: 'Chuyển hàng an toàn qua phà và cầu liên tỉnh.',
    },
    {
      eventId: 1018,
      batchId: 106,
      actorId: 3,
      actorName: 'Mai Tuyết Trinh (Bộ phận tiếp nhận vận tải)',
      organizationName: 'Vận chuyển Miền Tây Xanh',
      role: 'DISTRIBUTOR',
      eventType: 'RECEIVED',
      timestamp: '2026-10-21T08:00:00.000Z',
      location: 'Kho tổng Châu Thành, Bến Tre',
      description: 'Đo kích thước quả đạt chuẩn loại 1 trọng lượng 1.4kg - 1.8kg.',
    },
    {
      eventId: 1019,
      batchId: 106,
      actorId: 3,
      actorName: 'Trần Văn Hưng',
      organizationName: 'Tổng kho Chế biến Bến Tre Fruit',
      role: 'PROCESSOR',
      eventType: 'PROCESSED',
      timestamp: '2026-10-21T15:00:00.000Z',
      location: 'Xưởng sơ chế trái cây Bến Tre',
      description: 'Rửa sạch sát khuẩn vỏ, bọc lưới xốp bảo vệ quả.',
    },
    {
      eventId: 1020,
      batchId: 106,
      actorId: 3,
      actorName: 'Lương Hoàng Yến',
      organizationName: 'Tổng kho Chế biến Bến Tre Fruit',
      role: 'PROCESSOR',
      eventType: 'PACKAGED',
      timestamp: '2026-10-22T09:30:00.000Z',
      location: 'Phòng dán nhãn xuất xưởng',
      description: 'Đóng thùng carton 12 quả/thùng và in mã truy xuất QR chuẩn GS1.',
    },
    {
      eventId: 1021,
      batchId: 106,
      actorId: 4,
      actorName: 'Đỗ Quốc Thắng (Điều phối vận chuyển)',
      organizationName: 'Tổng kho Phân phối Miền Nam',
      role: 'DISTRIBUTOR',
      eventType: 'SHIPPED',
      timestamp: '2026-10-23T14:00:00.000Z',
      location: 'Trung tâm Phân phối Tân Tạo, Bình Tân, TP.HCM',
      description: 'Xuất kho phân phối chính thức đến chuỗi siêu thị bán lẻ Co.opmart và WinMart toàn quốc.',
    },
  ],
}

export const PREVIEW_AUDIT_LOGS = [
  {
    auditId: 501,
    timestamp: '2026-11-04T08:30:05.000Z',
    actorId: 2,
    actorName: 'Nguyễn Văn An',
    actorRole: 'FARMER',
    organizationName: 'HTX Cà phê Cầu Đất',
    action: 'CREATE',
    entityType: 'BATCH',
    entityId: 101,
    batchCode: 'BATCH-2026-0001',
    details: { productName: 'Cà phê Arabica Cầu Đất Thượng Hạng', quantity: 1250.5, origin: 'Xã Trạm Hành, TP. Đà Lạt' },
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'a718b9c20f12d45e6834bb0149e8a719c3e21fb4a6829de4f128ab09c47e812d',
    verified: true,
  },
  {
    auditId: 502,
    timestamp: '2026-11-04T08:30:06.000Z',
    actorId: 2,
    actorName: 'Nguyễn Văn An',
    actorRole: 'FARMER',
    organizationName: 'HTX Cà phê Cầu Đất',
    action: 'EVENT',
    entityType: 'EVENT',
    entityId: 1001,
    batchCode: 'BATCH-2026-0001',
    details: { eventType: 'CREATED', location: 'Nông trường Trạm Hành, TP. Đà Lạt' },
    previousHash: 'a718b9c20f12d45e6834bb0149e8a719c3e21fb4a6829de4f128ab09c47e812d',
    hash: 'c829e1fa39401bd6a77e819b48c01df2847a9cb3847e192f02938a49c281df74',
    verified: true,
  },
  {
    auditId: 503,
    timestamp: '2026-11-04T09:00:10.000Z',
    actorId: 4,
    actorName: 'Trần Hữu Vận',
    actorRole: 'DISTRIBUTOR',
    organizationName: 'Công ty Vận tải Mekong Xanh',
    action: 'EVENT',
    entityType: 'EVENT',
    entityId: 1003,
    batchCode: 'BATCH-2026-0002',
    details: { eventType: 'TRANSPORTED', location: 'Trạm logistics Phụng Hiệp, Hậu Giang' },
    previousHash: 'c829e1fa39401bd6a77e819b48c01df2847a9cb3847e192f02938a49c281df74',
    hash: 'e921d749a029384bc19284fa039182eb49182374ac029384ebc928471928374a',
    verified: true,
  },
  {
    auditId: 504,
    timestamp: '2026-11-04T10:15:22.000Z',
    actorId: 3,
    actorName: 'Trần Văn Chế Biến',
    actorRole: 'PROCESSOR',
    organizationName: 'Nhà máy Chế biến Nông sản Sài Gòn',
    action: 'EVENT',
    entityType: 'EVENT',
    entityId: 1010,
    batchCode: 'BATCH-2026-0004',
    details: { eventType: 'PROCESSED', location: 'Xưởng rang sấy công nghệ cao Bình Phước' },
    previousHash: 'e921d749a029384bc19284fa039182eb49182374ac029384ebc928471928374a',
    hash: 'b192847a01928374fc928374a0192834eb82736410293847fa0293847c019283',
    verified: true,
  },
  {
    auditId: 505,
    timestamp: '2026-11-04T11:45:00.000Z',
    actorId: 4,
    actorName: 'Đỗ Quốc Thắng',
    actorRole: 'DISTRIBUTOR',
    organizationName: 'Tổng kho Phân phối Miền Nam',
    action: 'EVENT',
    entityType: 'EVENT',
    entityId: 1021,
    batchCode: 'BATCH-2026-0006',
    details: { eventType: 'SHIPPED', location: 'Trung tâm Phân phối Tân Tạo, Bình Tân, TP.HCM' },
    previousHash: 'b192847a01928374fc928374a0192834eb82736410293847fa0293847c019283',
    hash: 'f029384bc1928374a01928347eb928374ac0192834ebc9284710293847bca019',
    verified: true,
  },
]

