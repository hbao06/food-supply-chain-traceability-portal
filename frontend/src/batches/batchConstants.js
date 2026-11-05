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
  { type: 'CREATED', label: 'Khởi tạo', role: 'FARMER', icon: '🌱' },
  { type: 'TRANSPORTED', label: 'Vận chuyển', role: 'DISTRIBUTOR', icon: '🚚' },
  { type: 'RECEIVED', label: 'Tiếp nhận', role: 'PROCESSOR', icon: '🏢' },
  { type: 'PROCESSED', label: 'Chế biến', role: 'PROCESSOR', icon: '⚙️' },
  { type: 'PACKAGED', label: 'Đóng gói', role: 'PROCESSOR', icon: '📦' },
  { type: 'SHIPPED', label: 'Xuất kho', role: 'DISTRIBUTOR', icon: '🚀' },
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
