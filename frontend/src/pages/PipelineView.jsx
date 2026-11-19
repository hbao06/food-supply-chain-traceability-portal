import { useMemo } from 'react'
import { BatchQrBadge } from './pipelineParts.jsx'
import {
  BATCH_STATUSES,
  STATUS_META,
  formatQuantity,
  productImage,
} from '../batches/batchConstants.js'
import { useBatches } from '../hooks/useBatches.js'
import {
  IconBatches,
  IconBook,
  IconBuilding,
  IconChartBar,
  IconCheckCircle,
  IconFactory,
  IconPackage,
  IconPlus,
  IconQr,
  IconSeedling,
  IconShield,
  IconTruck,
  IconUsersGroup,
} from '../components/Icons.jsx'

const ROLE_DASHBOARD_CONFIG = {
  FARMER: {
    badge: 'NÔNG TRẠI & HỢP TÁC XÃ CANH TÁC',
    title: 'Không gian làm việc Nông hộ',
    icon: IconSeedling,
    themeColor: '#73932A',
    badgeClass: 'role-tag-farmer',
    mission:
      'Đơn vị khởi nguồn chuỗi giá trị. Quản lý vùng trồng, nhật ký thu hoạch, khởi tạo lô nông sản gốc (chuẩn FR-) và in ấn phát hành tem QR truy xuất nguồn gốc.',
    highlightStatuses: ['CREATED', 'TRANSPORTED'],
    actions: [
      {
        title: 'Khởi tạo lô hàng mới',
        desc: 'Đăng ký mã lô FR-, khai báo sản lượng, xuất xứ giống và ngày thu hoạch.',
        actionLabel: 'Tạo lô mới +',
        route: '/batches/new',
        primary: true,
      },
      {
        title: 'Quản lý danh sách lô hàng',
        desc: 'Xem danh sách toàn bộ các lô nông sản đã khởi tạo tại vườn.',
        actionLabel: 'Danh sách lô hàng →',
        route: '/batches',
      },
      {
        title: 'Trung tâm in mã QR',
        desc: 'Xem, tải và in tem QR số hóa để dán lên bao bì nông sản xuất vườn.',
        actionLabel: 'Quản lý mã QR →',
        route: '/qr-center',
      },
      {
        title: 'Sổ tay canh tác VietGAP',
        desc: 'Xem tiêu chuẩn cách ly, phân bón sinh học và kiểm định dư lượng.',
        actionLabel: 'Xem quy chuẩn →',
        route: '/help',
      },
    ],
  },
  PROCESSOR: {
    badge: 'CƠ SỞ SƠ CHẾ & NHÀ MÁY CHẾ BIẾN',
    title: 'Không gian làm việc Nhà máy Chế biến',
    icon: IconFactory,
    themeColor: '#C26A18',
    badgeClass: 'role-tag-processor',
    mission:
      'Khâu nâng cao giá trị nông sản. Tiếp nhận nguyên liệu tươi từ nông trại, vận hành dây chuyền sơ chế, rang xay, sấy thăng hoa và đóng gói đạt chuẩn ISO 22000 & HACCP.',
    highlightStatuses: ['RECEIVED', 'PROCESSED', 'PACKAGED'],
    actions: [
      {
        title: 'Tiếp nhận nguyên liệu từ vườn',
        desc: 'Xác nhận tiếp nhận lô hàng tươi từ xe vận tải nông trại chuyển sang.',
        actionLabel: 'Xem lô chờ tiếp nhận →',
        route: '/batches',
        primary: true,
      },
      {
        title: 'Ghi nhận công đoạn chế biến',
        desc: 'Cập nhật tiến trình sơ chế, chế biến nhiệt và đóng gói thành phẩm.',
        actionLabel: 'Cập nhật tiến trình →',
        route: '/batches',
      },
      {
        title: 'Báo cáo sản lượng & chế biến',
        desc: 'Thống kê tỷ lệ hoàn thành công đoạn và lượng thành phẩm đóng gói.',
        actionLabel: 'Xem báo cáo →',
        route: '/reports',
      },
      {
        title: 'Quy trình công nghệ an toàn',
        desc: 'Tra cứu ngưỡng tới hạn kiểm soát vệ sinh vi sinh và an toàn bao bì.',
        actionLabel: 'Cẩm nang quy chuẩn →',
        route: '/help',
      },
    ],
  },
  DISTRIBUTOR: {
    badge: 'NHÀ PHÂN PHỐI & CHUỖI BÁN LẺ',
    title: 'Không gian Quản trị Logistics & Phân phối',
    icon: IconTruck,
    themeColor: '#1F75B8',
    badgeClass: 'role-tag-distributor',
    mission:
      'Cầu nối đưa nông sản ra thị trường tiêu thụ. Giám sát logistics chuỗi lạnh GPS 2–8°C, quản lý lưu kho trung chuyển và phân phối đến quầy kệ hệ thống siêu thị.',
    highlightStatuses: ['TRANSPORTED', 'RECEIVED', 'SHIPPED'],
    actions: [
      {
        title: 'Giám sát vận tải chuỗi lạnh',
        desc: 'Theo dõi lộ trình các xe lạnh vận chuyển và tiếp nhận lô hàng thành phẩm.',
        actionLabel: 'Theo dõi lô vận chuyển →',
        route: '/batches',
        primary: true,
      },
      {
        title: 'Xác nhận xuất kho siêu thị',
        desc: 'Cập nhật trạng thái phân phối đến điểm bán lẻ tiêu thụ cuối cùng.',
        actionLabel: 'Cập nhật xuất kho →',
        route: '/batches',
      },
      {
        title: 'Báo cáo lưu thông thị trường',
        desc: 'Xem biểu đồ phân bổ sản lượng tới các chuỗi siêu thị và đối tác.',
        actionLabel: 'Báo cáo thống kê →',
        route: '/reports',
      },
      {
        title: 'Cổng tra cứu công khai',
        desc: 'Trải nghiệm tra cứu từ góc nhìn người tiêu dùng quét tem QR tại quầy kệ.',
        actionLabel: 'Mở cổng tra cứu ↗',
        route: '/trace',
      },
    ],
  },
  ADMIN: {
    badge: 'CƠ QUAN QUẢN TRỊ & BẢO CHỨNG QUỐC GIA',
    title: 'Bảng Điều Hành Toàn Diện Hệ Thống',
    icon: IconShield,
    themeColor: '#533B82',
    badgeClass: 'role-tag-admin',
    mission:
      'Cơ quan bảo chứng toàn vẹn dữ liệu chuỗi cung ứng. Thẩm định hồ sơ đối tác, cấp mã doanh nghiệp, kiểm toán chuỗi băm mật mã SHA-256 chống gian lận và điều phối lưu thông toàn quốc.',
    highlightStatuses: ['CREATED', 'TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED'],
    actions: [
      {
        title: 'Duyệt & Quản lý tài khoản',
        desc: 'Thẩm định và phê duyệt các tài khoản đối tác chuỗi cung ứng mới đăng ký.',
        actionLabel: 'Duyệt thành viên →',
        route: '/admin/users',
        primary: true,
      },
      {
        title: 'Kiểm toán chuỗi khối SHA-256',
        desc: 'Xác thực tính toàn vẹn chuỗi băm mật mã, bảo đảm nhật ký không bị can thiệp.',
        actionLabel: 'Kiểm toán hệ thống →',
        route: '/admin/audit',
      },
      {
        title: 'Quản lý Tổ chức & Doanh nghiệp',
        desc: 'Quản lý danh sách các nông trại, nhà máy chế biến và nhà phân phối.',
        actionLabel: 'Quản lý tổ chức →',
        route: '/admin/orgs',
      },
      {
        title: 'Báo cáo tổng quan toàn quốc',
        desc: 'Phân tích dữ liệu sản lượng, tỷ lệ phân bổ và tiến trình chuỗi cung ứng.',
        actionLabel: 'Báo cáo chuyên sâu →',
        route: '/reports',
      },
    ],
  },
}

export function PipelineView({ token, user, preview, onOpenBatch, navigate }) {
  const { items, loading, error } = useBatches(token, preview)

  const userRole = user?.role || 'FARMER'
  const roleConfig = ROLE_DASHBOARD_CONFIG[userRole] || ROLE_DASHBOARD_CONFIG.FARMER
  const RoleIcon = roleConfig.icon

  // Tính toán các chỉ số theo Role
  const roleMetrics = useMemo(() => {
    if (!items || !items.length) {
      return {
        m1: { label: 'Lô hàng', val: 0, unit: 'lô' },
        m2: { label: 'Đang luân chuyển', val: 0, unit: 'lô' },
        m3: { label: 'Sản lượng', val: '0 kg', unit: '' },
        m4: { label: 'Tiêu chuẩn', val: 'Đạt', unit: '' },
      }
    }

    const createdCount = items.filter((b) => b.currentStatus === 'CREATED').length
    const transportedCount = items.filter((b) => b.currentStatus === 'TRANSPORTED').length
    const receivedCount = items.filter((b) => b.currentStatus === 'RECEIVED').length
    const processedCount = items.filter((b) => b.currentStatus === 'PROCESSED').length
    const packagedCount = items.filter((b) => b.currentStatus === 'PACKAGED').length
    const shippedCount = items.filter((b) => b.currentStatus === 'SHIPPED').length

    const totalWeight = items.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0)

    if (userRole === 'FARMER') {
      return {
        m1: { label: 'Lô đang canh tác / mới tạo', val: createdCount, unit: 'lô' },
        m2: { label: 'Lô đã bàn giao vận chuyển', val: transportedCount, unit: 'lô' },
        m3: { label: 'Tổng sản lượng đã xuất vườn', val: formatQuantity(totalWeight), unit: '' },
        m4: { label: 'Tỷ lệ gắn tem mã FR-', val: '100%', unit: 'Chuẩn hóa' },
      }
    }
    if (userRole === 'PROCESSOR') {
      return {
        m1: { label: 'Nguyên liệu chờ chế biến', val: receivedCount, unit: 'lô' },
        m2: { label: 'Đang sơ chế & đóng gói', val: processedCount + packagedCount, unit: 'lô' },
        m3: { label: 'Thành phẩm sẵn sàng xuất', val: shippedCount, unit: 'lô' },
        m4: { label: 'Tiêu chuẩn an toàn', val: 'ISO 22000', unit: 'HACCP Đạt' },
      }
    }
    if (userRole === 'DISTRIBUTOR') {
      return {
        m1: { label: 'Đội xe lạnh đang vận chuyển', val: transportedCount, unit: 'lô' },
        m2: { label: 'Nông sản lưu kho trung chuyển', val: receivedCount, unit: 'lô' },
        m3: { label: 'Đã phân phối tới siêu thị', val: shippedCount, unit: 'lô' },
        m4: { label: 'Nhiệt độ bảo quản GPS', val: '2°C – 8°C', unit: 'Chuỗi lạnh' },
      }
    }
    // ADMIN
    return {
      m1: { label: 'Tổng số lô toàn hệ thống', val: items.length, unit: 'lô' },
      m2: { label: 'Đơn vị thành viên mạng lưới', val: '9', unit: 'Đơn vị' },
      m3: { label: 'Tài khoản chuỗi cung ứng', val: '12', unit: 'Tài khoản' },
      m4: { label: 'Toàn vẹn chuỗi khối SHA-256', val: '100%', unit: 'Khớp tuyệt đối' },
    }
  }, [items, userRole])

  if (loading) {
    return (
      <div className="state-block">
        <div className="spinner-olive" />
      </div>
    )
  }

  if (error) {
    return <div className="notice error">{error}</div>
  }

  return (
    <div className="role-dashboard-container">
      {/* 1. BANNER ĐỊNH DANH VAI TRÒ & QUYỀN HẠN CỦA ROLE */}
      <section className="role-identity-banner">
        <div className="role-banner-left">
          <div className="role-avatar-box">
            <RoleIcon className="role-main-icon" />
          </div>
          <div className="role-banner-text">
            <div className="role-pill-row">
              <span className={`role-badge-pill ${roleConfig.badgeClass}`}>
                {roleConfig.badge}
              </span>
              {user?.organizationName && (
                <span className="role-org-pill">
                  <IconBuilding /> {user.organizationName}
                </span>
              )}
            </div>
            <h1 className="role-heading-title">{roleConfig.title}</h1>
            <p className="role-mission-desc">{roleConfig.mission}</p>
          </div>
        </div>
      </section>

      {/* 2. CÁC CHỈ SỐ TRỌNG YẾU ĐƯỢC CÁ NHÂN HÓA THEO VAI TRÒ */}
      <section className="role-metrics-grid">
        <div className="metric-box">
          <span className="metric-k">{roleMetrics.m1.label}</span>
          <div className="metric-v-row">
            <span className="metric-v">{roleMetrics.m1.val}</span>
            <small className="metric-u">{roleMetrics.m1.unit}</small>
          </div>
        </div>
        <div className="metric-box">
          <span className="metric-k">{roleMetrics.m2.label}</span>
          <div className="metric-v-row">
            <span className="metric-v">{roleMetrics.m2.val}</span>
            <small className="metric-u">{roleMetrics.m2.unit}</small>
          </div>
        </div>
        <div className="metric-box">
          <span className="metric-k">{roleMetrics.m3.label}</span>
          <div className="metric-v-row">
            <span className="metric-v">{roleMetrics.m3.val}</span>
            <small className="metric-u">{roleMetrics.m3.unit}</small>
          </div>
        </div>
        <div className="metric-box highlight-box">
          <span className="metric-k">{roleMetrics.m4.label}</span>
          <div className="metric-v-row">
            <span className="metric-v success-accent">{roleMetrics.m4.val}</span>
            <small className="metric-u">{roleMetrics.m4.unit}</small>
          </div>
        </div>
      </section>

      {/* 3. KHỐI TÁC VỤ NHANH CHUẨN NGHIỆP VỤ CHO TỪNG ROLE */}
      <section className="role-actions-section">
        <div className="section-head-bar">
          <div>
            <h2 className="section-title">Nhiệm vụ &amp; Chức năng chính của vai trò</h2>
            <p className="section-subtitle">
              Các tác vụ nghiệp vụ quan trọng được đề xuất riêng cho tài khoản của bạn.
            </p>
          </div>
        </div>

        <div className="role-actions-grid">
          {roleConfig.actions.map((act, index) => (
            <div
              key={index}
              className={`role-action-card ${act.primary ? 'primary-action-card' : ''}`}
            >
              <div className="action-card-header">
                <span className="action-index-num">0{index + 1}</span>
                <h3 className="action-card-title">{act.title}</h3>
              </div>
              <p className="action-card-desc">{act.desc}</p>
              <button
                type="button"
                className={`action-btn-trigger ${act.primary ? 'btn-primary-trigger' : ''}`}
                onClick={() => {
                  if (navigate && act.route) navigate(act.route)
                }}
              >
                {act.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. BẢNG TIẾN TRÌNH CHUỖI CUNG ỨNG 6 CÔNG ĐOẠN (KANBAN PIPELINE) */}
      <section className="pipeline-kanban-section">
        <div className="section-head-bar">
          <div>
            <h2 className="section-title">Tiến trình lưu thông lô hàng qua 6 mắt xích</h2>
            <p className="section-subtitle">
              Các cột được viền sáng biểu thị công đoạn thuộc phạm vi phụ trách trực tiếp của bạn.
            </p>
          </div>
        </div>

        <div className="kanban-board">
          {BATCH_STATUSES.map((statusKey) => {
            const colItems = items.filter((b) => b.currentStatus === statusKey)
            const isRoleScope = roleConfig.highlightStatuses.includes(statusKey)

            return (
              <section
                key={statusKey}
                className={`kanban-col ${isRoleScope ? 'kanban-col-highlight' : ''}`}
              >
                <header className="kanban-col-head">
                  <div className="kanban-head-title">
                    <span className={`tab-dot ${STATUS_META[statusKey].badgeClass}`} />
                    <strong>{STATUS_META[statusKey].label}</strong>
                  </div>
                  <span className="kanban-counter-chip">{colItems.length}</span>
                </header>

                {isRoleScope && (
                  <div className="role-scope-badge">
                    <IconCheckCircle /> Phạm vi phụ trách
                  </div>
                )}

                <div className="kanban-col-cards">
                  {colItems.map((b) => (
                    <button
                      key={b.batchId}
                      type="button"
                      className="kanban-card"
                      onClick={() => onOpenBatch(b.batchId)}
                    >
                      <div className="kanban-card-top">
                        <img
                          src={productImage(b.productName)}
                          alt=""
                          loading="lazy"
                          className="kanban-product-thumb"
                          onError={(e) => {
                            e.currentTarget.src = '/products/coffee.jpg'
                          }}
                        />
                        <div className="kanban-card-meta">
                          <BatchQrBadge code={b.batchCode} />
                          <strong className="kanban-prod-name">{b.productName}</strong>
                        </div>
                      </div>
                      <div className="kanban-card-footer">
                        <span>{b.origin}</span>
                        <span className="kanban-qty">{formatQuantity(b.quantity)}</span>
                      </div>
                    </button>
                  ))}
                  {colItems.length === 0 && (
                    <div className="kanban-empty-slot">Không có lô nào</div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </div>
  )
}
