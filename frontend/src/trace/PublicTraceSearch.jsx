import { useState, useRef } from 'react'
import { BrandLogo } from '../components/BrandAndFooter.jsx'
import { QrScannerPanel } from './QrScannerPanel.jsx'
import { parseTraceInput } from './traceUtils.js'
import { DEMO_BATCH_SHORTCUTS } from '../batches/batchConstants.js'
import { TruckIllustration, WarehouseIllustration } from '../components/Illustrations.jsx'

// Bộ sưu tập nông sản chuẩn lookbook bán hàng Nike / Adidas
const SHOWCASE_PRODUCTS = [
  {
    id: 'FR-2026-0001',
    name: 'Cà phê Arabica Cầu Đất',
    category: 'Cà phê đặc sản',
    origin: 'Đà Lạt, Lâm Đồng',
    standard: 'VietGAP • UTZ Certified',
    image: '/products/coffee.jpg',
    tag: 'Đặc sản cao nguyên',
    desc: 'Thu hoạch từ độ cao 1.650m, sơ chế ướt khép kín, hương thơm trái cây chín mọng quyện mật ong rừng.',
    trustPoints: [
      { title: '100% Nông trại VietGAP', sub: 'HTX Cầu Đất, Đà Lạt (Cao độ 1.650m)' },
      { title: 'Logistics chuỗi lạnh GPS', sub: 'Xe lạnh chuyên dụng giám sát 2–8°C' },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Chống giả mạo và can thiệp nhật ký' },
    ]
  },
  {
    id: 'FR-2026-0201',
    name: 'Gạo Thơm Hữu Cơ ST25',
    category: 'Lúa gạo xuất khẩu',
    origin: 'Sóc Trăng (Vùng tôm - lúa)',
    standard: 'Hữu cơ USDA • OCOP 5 Sao',
    image: '/products/rice.jpg',
    tag: 'Gạo ngon nhất thế giới',
    desc: 'Hạt dài, trắng trong, dẻo thơm mùi lá dứa tự nhiên, mô hình canh tác luân canh sinh thái tôm - lúa sạch.',
    trustPoints: [
      { title: 'Canh tác hữu cơ sinh thái', sub: 'Mô hình luân canh tôm - lúa tự nhiên' },
      { title: 'Bảo quản silo hút chân không', sub: 'Giữ ẩm độ tiêu chuẩn xuất khẩu EU/Mỹ' },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Số hóa tem truy xuất điện tử độc bản' },
    ]
  },
  {
    id: 'FR-2026-0202',
    name: 'Hạt Điều Rang Muối Vỏ Lụa',
    category: 'Hạt dinh dưỡng',
    origin: 'Bù Đăng, Bình Phước',
    standard: 'Chỉ dẫn địa lý • ISO 22000',
    image: '/products/cashew.jpg',
    tag: 'Chỉ dẫn địa lý',
    desc: 'Hạt điều size đại W240, rang củi gia truyền nguyên vỏ lụa, vị giòn tan, ngọt bùi đặc trưng đất đỏ bazan.',
    trustPoints: [
      { title: 'Vùng nguyên liệu Bù Đăng', sub: 'Đặc sản Chỉ dẫn địa lý Bình Phước' },
      { title: 'Rang củi gia truyền ISO 22000', sub: 'Quy trình kiểm soát an toàn nghiêm ngặt' },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Niêm phong nguồn gốc theo từng mẻ rang' },
    ]
  },
  {
    id: 'FR-2026-0203',
    name: 'Thanh Long Ruột Đỏ Chợ Gạo',
    category: 'Trái cây tươi',
    origin: 'Chợ Gạo, Tiền Giang',
    standard: 'GlobalGAP • Chuẩn EU',
    image: '/products/dragonfruit.jpg',
    tag: 'Xuất khẩu EU',
    desc: 'Độ ngọt Brix 14-16, vỏ mỏng bóng đẹp, tai quả cứng xanh, bảo quản chuỗi lạnh đạt chuẩn thị trường khó tính.',
    trustPoints: [
      { title: 'Vùng trồng GlobalGAP cấp mã vùng', sub: 'HTX Thanh Long Chợ Gạo xuất khẩu' },
      { title: 'Chuỗi cung ứng lạnh bảo quản CA', sub: 'Kiểm soát chặng vận tải và chiếu xạ' },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Xác thực kiểm dịch thực vật xuất khẩu' },
    ]
  },
  {
    id: 'FR-2026-0204',
    name: 'Chè Ô Long Kim Tuyên Mộc Châu',
    category: 'Trà & Thảo mộc',
    origin: 'Mộc Châu, Sơn La',
    standard: 'VietGAP • Cao nguyên 1050m',
    image: '/products/tea.jpg',
    tag: 'Hương vị sương sớm',
    desc: 'Hái thủ công 1 tôm 2 lá trong sương sớm, quy trình ủ lên men bán phần giữ trọn vị hậu ngọt thanh tao.',
    trustPoints: [
      { title: 'Vườn chè cao nguyên 1.050m', sub: 'Canh tác vi sinh không tồn dư hóa chất' },
      { title: 'Ủ men bán phần bí truyền', sub: 'Quy trình đóng gói hút chân không khử ẩm' },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Minh bạch nguồn gốc từng lứa hái' },
    ]
  },
  {
    id: 'FR-2026-0002',
    name: 'Sầu Riêng Ri6 Cơm Vàng Hạt Lép',
    category: 'Trái cây nhiệt đới',
    origin: 'Chợ Lách, Bến Tre',
    standard: 'Mã số vùng trồng • VietGAP',
    image: '/products/durian.jpg',
    tag: 'Đệ nhất sầu riêng',
    desc: 'Thu hoạch khi đạt độ chín hoàn hảo trên cây, múi cơm vàng ươm, dày béo mịn màng không xơ, hạt lép nhỏ.',
    trustPoints: [
      { title: 'Vườn cây giống chuẩn Chợ Lách', sub: 'Chín cây tự nhiên, kiểm định dư lượng' },
      { title: 'Xe thùng lạnh chuyên dụng', sub: 'Duy trì hương vị tươi ngon xuất khẩu' },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Gắn tem định danh từng trái xuất vườn' },
    ]
  }
]

export function PublicTraceSearch({ navigate, isAuthenticated = false, preview = false }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(SHOWCASE_PRODUCTS[0])
  const railRef = useRef(null)

  const scrollRail = (direction) => {
    if (!railRef.current) return
    const scrollAmount = direction === 'left' ? -380 : 380
    railRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  const handleTraceBatch = (batchCode) => {
    setError('')
    const target = (batchCode || input).trim()
    if (!target) {
      setError('Vui lòng nhập mã lô hàng, dán đường dẫn hoặc quét tem QR.')
      return
    }

    const parsed = parseTraceInput(target)
    if (!parsed.valid) {
      setError(parsed.message || 'Mã lô không hợp lệ (Ví dụ hợp lệ: FR-2026-0001, FR-2026-0201...).')
      return
    }

    const targetRoute = preview ? `${parsed.route}?preview=1` : parsed.route
    navigate(targetRoute)
  }

  const handleScanSuccess = (detectedText) => {
    setShowScanner(false)
    setInput(detectedText)
    handleTraceBatch(detectedText)
  }

  return (
    <div className="public-portal-page">
      {/* 1. HEADER CHUYÊN NGHIỆP ĐỒNG BỘ MÀU XANH NỀN VỚI FOOTER */}
      <header className="public-header-bar">
        <div className="header-container">
          <div className="header-brand" onClick={() => navigate(preview ? '/trace?preview=1' : '/trace')}>
            <BrandLogo invert />
            <div className="header-brand-slogan">
              <span className="brand-badge-vn">VIỆT NAM</span>
              <span className="brand-subtext on-dark">Cổng Truy Xuất Nguồn Gốc Quốc Gia</span>
            </div>
          </div>

          <nav className="header-nav-menu" aria-label="Menu chính">
            <a href="#showcase" className="header-nav-link">Nông sản</a>
            <a href="#pillars" className="header-nav-link">Quy trình</a>
            <a href="#standards" className="header-nav-link">Tiêu chuẩn</a>
            <button
              type="button"
              className="header-nav-link text-btn"
              onClick={() => setShowScanner(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Quét QR
            </button>
          </nav>

          <div className="header-actions">
            {isAuthenticated ? (
              <button
                type="button"
                className="btn-portal-workspace"
                onClick={() => navigate('/dashboard')}
              >
                Không gian làm việc →
              </button>
            ) : (
              <button
                type="button"
                className="btn-portal-login"
                onClick={() => navigate('/login')}
              >
                Đăng nhập đối tác
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO BANNER - BỐ CỤC 2 CỘT CÂN ĐỐI, HIỆN ĐẠI, KHÔNG BỊ TRỐNG 2 BÊN */}
      <section className="portal-hero-section">
        <div className="hero-split-grid">
          {/* CỘT TRÁI: THÔNG ĐIỆP & BỘ CÔNG CỤ TRA CỨU */}
          <div className="hero-lead-col">
            <div className="hero-eyebrow-pill">
              <span className="live-pulse-dot" />
              Định danh minh bạch • Bảo chứng chuỗi cung ứng nông sản Việt&nbsp;Nam
            </div>

            <h1 className="hero-headline text-balance">
              Truy xuất nguồn gốc, bảo chứng nông sản Việt
            </h1>

            <p className="hero-lead-text">
              Mỗi nông sản được gắn mã định danh chuẩn <code>FR-YYYY-NNNN</code>. Tra cứu ngay nhật ký canh tác từ nông trại, 
              kiểm định an toàn thực phẩm, nhiệt độ vận tải lạnh GPS đến siêu&nbsp;thị.
            </p>

            {/* Form tìm kiếm tra cứu & Quét QR */}
            <form
              className="hero-search-console"
              onSubmit={(e) => {
                e.preventDefault()
                handleTraceBatch(input)
              }}
            >
              <div className="search-field-box">
                <svg className="search-input-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="trace-input-field"
                  type="text"
                  placeholder="Nhập mã lô hàng (Ví dụ: FR-2026-0001, FR-2026-0201...) hoặc dán URL"
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase()
                    setInput(val)
                    setError('')
                    const match = SHOWCASE_PRODUCTS.find((p) => p.id === val.trim())
                    if (match) setSelectedProduct(match)
                  }}
                  autoComplete="off"
                  spellCheck="false"
                />
                {input && (
                  <button
                    type="button"
                    className="clear-input-btn"
                    onClick={() => {
                      setInput('')
                      setError('')
                    }}
                    title="Xoá nội dung"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="search-buttons-row">
                <button type="submit" className="btn-hero-search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Truy xuất ngay
                </button>

                <button
                  type="button"
                  className="btn-hero-qr"
                  onClick={() => setShowScanner(true)}
                  title="Bật máy ảnh quét tem QR bao bì"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  Quét tem QR
                </button>
              </div>
            </form>

            {error && (
              <div className="hero-search-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Phím tắt chọn nhanh 6 nông sản mẫu - THAY ĐỔI LINH HOẠT SẢN PHẨM HIỂN THỊ */}
            <div className="hero-shortcuts-row">
              <span className="shortcuts-title">Mẫu nông sản demo (bấm để xem &amp; đổi mẫu):</span>
              <div className="shortcuts-chips-wrap">
                {DEMO_BATCH_SHORTCUTS.map((item) => {
                  const isSelected = selectedProduct.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`shortcut-chip-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setInput(item.id)
                        const match = SHOWCASE_PRODUCTS.find((p) => p.id === item.id)
                        if (match) setSelectedProduct(match)
                      }}
                      title={`Bấm để xem thông tin ${item.label}`}
                    >
                      <span className="chip-dot" />
                      <strong>{item.id}</strong>: {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: CARD MINH HỌA SẢN PHẨM BỰ, ĐẸP, TỰ ĐỘNG THAY ĐỔI THEO MÃ ĐƯỢC CHỌN */}
          <div className="hero-trust-badge-col">
            <div className="hero-digital-qr-card">
              {/* Ảnh sản phẩm to bản, bắt mắt */}
              <div className="qr-card-cover-box">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="qr-card-big-img"
                  onError={(e) => { e.currentTarget.src = '/products/coffee.jpg' }}
                />
                <div className="qr-card-cover-badge-row">
                  <span className="qr-card-category-tag">{selectedProduct.category}</span>
                  <span className="qr-card-std-tag">{selectedProduct.standard}</span>
                </div>
              </div>

              <div className="qr-card-body-content">
                <div className="qr-card-title-group">
                  <span className="qr-card-badge">CHỨNG THỰC SỐ QUỐC GIA</span>
                  <h3 className="qr-card-product-name">{selectedProduct.name}</h3>
                  <div className="qr-card-code-row">
                    <code className="qr-card-code-tag">{selectedProduct.id}</code>
                    <span className="qr-card-origin-text">• {selectedProduct.origin}</span>
                  </div>
                </div>

                <div className="qr-card-features-list">
                  {selectedProduct.trustPoints.map((tp, idx) => (
                    <div key={idx} className="qr-feature-item">
                      <span className="feature-icon">✓</span>
                      <div>
                        <strong>{tp.title}</strong>
                        <p>{tp.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-qr-card-inspect"
                  onClick={() => {
                    setInput(selectedProduct.id)
                    handleTraceBatch(selectedProduct.id)
                  }}
                >
                  Xem chi tiết hành trình {selectedProduct.name} →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT SHOWCASE RAIL (Phong cách Lookbook bán hàng thể thao Nike & Adidas) */}
      <section id="showcase" className="showcase-rail-section">
        <div className="rail-header-container">
          <div>
            <div className="rail-kicker">TIÊU CHUẨN XUẤT KHẨU</div>
            <h2 className="rail-title text-balance">Nông sản tiêu biểu</h2>
          </div>
          <div className="rail-ctrl-arrows">
            <button
              type="button"
              className="rail-arrow-btn"
              onClick={() => scrollRail('left')}
              aria-label="Xem sản phẩm trước"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="rail-arrow-btn"
              onClick={() => scrollRail('right')}
              aria-label="Xem sản phẩm tiếp theo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Khung trượt ngang sản phẩm (Nike/Adidas lookbook track) */}
        <div className="showcase-rail-track" ref={railRef}>
          {SHOWCASE_PRODUCTS.map((prod) => (
            <div
              key={prod.id}
              className="showcase-product-card"
              onClick={() => {
                setInput(prod.id)
                handleTraceBatch(prod.id)
              }}
            >
              <div className="card-thumb-holder">
                <img
                  src={prod.image}
                  alt={prod.name}
                  loading="lazy"
                  className="card-thumb-img"
                  onError={(e) => {
                    e.currentTarget.src = '/products/coffee.jpg'
                  }}
                />
                <span className="card-category-badge">{prod.tag}</span>
              </div>
              <div className="card-info-pane">
                <div className="card-location-meta">
                  <span>{prod.category}</span>
                  <span className="meta-sep">•</span>
                  <span>{prod.origin}</span>
                </div>
                <h3 className="card-product-heading">{prod.name}</h3>
                <p className="card-product-summary">{prod.desc}</p>
                <div className="card-action-bar">
                  <div className="card-batch-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    <span>{prod.id}</span>
                  </div>
                  <span className="card-view-btn">
                    Xem nhật ký
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. QUY TRÌNH 4 TRỤ CỘT CHUỖI CUNG ỨNG NÔNG SẢN MINH BẠCH */}
      <section id="pillars" className="pillars-showcase-section">
        <div className="pillars-intro-block">
          <div className="rail-kicker">MÔ HÌNH VẬN HÀNH KHÉP KÍN</div>
          <h2 className="rail-title text-balance">
            Quy chuẩn 4 chặng
          </h2>
          <p className="pillars-sublead text-balance">
            Hệ thống kết nối trực tiếp dữ liệu từ nhà vườn, phân xưởng sơ chế, xe vận tải lạnh đến quầy kệ phân&nbsp;phối.
          </p>
        </div>

        <div className="pillars-four-grid">
          {/* Cột 1: Nông trại */}
          <div className="pillar-item-card">
            <div className="pillar-media-box">
              <img
                src="/products/coffee.jpg"
                alt="Nông trại sạch"
                className="pillar-bg-photo"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div className="pillar-content">
              <span className="pillar-order-badge">01. VÙNG TRỒNG</span>
              <h3 className="pillar-name">Nông trại &amp; Canh tác sạch</h3>
              <p className="pillar-detail">
                Theo dõi nguồn giống đạt chuẩn, nhật ký phân bón sinh học, kiểm định dư lượng thuốc BVTV trước khi thu hoạch.
              </p>
            </div>
          </div>

          {/* Cột 2: Kho bãi & Sơ chế */}
          <div className="pillar-item-card">
            <div className="pillar-media-box">
              <img
                src="/products/warehouse.jpg"
                alt="Kho bãi bảo quản"
                className="pillar-bg-photo"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <WarehouseIllustration />
            </div>
            <div className="pillar-content">
              <span className="pillar-order-badge">02. SƠ CHẾ &amp; LƯU KHO</span>
              <h3 className="pillar-name">Kho bãi tiêu chuẩn ISO</h3>
              <p className="pillar-detail">
                Kiểm soát độ ẩm, nhiệt độ buồng lạnh tự động, chọn lọc phân cỡ chất lượng theo quy chuẩn đóng gói xuất khẩu.
              </p>
            </div>
          </div>

          {/* Cột 3: Vận chuyển xe lạnh */}
          <div className="pillar-item-card">
            <div className="pillar-media-box">
              <img
                src="/products/truck.jpg"
                alt="Xe tải vận chuyển lạnh"
                className="pillar-bg-photo"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <TruckIllustration />
            </div>
            <div className="pillar-content">
              <span className="pillar-order-badge">03. LOGISTICS LẠNH</span>
              <h3 className="pillar-name">Đội xe chuyên dụng GPS</h3>
              <p className="pillar-detail">
                Giám sát nhiệt độ thùng xe lạnh theo thời gian thực và ghi nhận lộ trình hành trình qua định vị vệ tinh GPS.
              </p>
            </div>
          </div>

          {/* Cột 4: Tem QR & Siêu thị */}
          <div className="pillar-item-card">
            <div className="pillar-media-box">
              <img
                src="/products/market.jpg"
                alt="Siêu thị nông sản sạch và tem truy xuất QR"
                className="pillar-bg-photo"
                onError={(e) => {
                  e.currentTarget.src = '/products/coffee.jpg'
                }}
              />
            </div>
            <div className="pillar-content">
              <span className="pillar-order-badge">04. THỊ TRƯỜNG</span>
              <h3 className="pillar-name">Tem QR số hóa chống giả</h3>
              <p className="pillar-detail">
                Người tiêu dùng chỉ cần 2 giây quét mã bằng camera điện thoại để kiểm tra toàn bộ giấy tờ chứng nhận an toàn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. THANH QUY CHUẨN ĐỊNH DANH FR- (ĐẶT NGAY TRÊN FOOTER) */}
      <section id="standards" className="portal-standards-strip-section">
        <div className="portal-standards-strip">
          <div className="standards-banner-lead">
            <span className="standards-pill-tag">QUY CHUẨN ĐỊNH DANH QUỐC GIA</span>
            <h3 className="standards-banner-title">Cấu trúc mã định danh <code>FR-YYYY-NNNN</code></h3>
          </div>
          <div className="standards-spec-pills">
            <div className="spec-pill-item">
              <span className="spec-code-badge">FR-</span>
              <div className="spec-pill-text">
                <strong>Tiền tố chuẩn</strong>
                <small>Food Record quốc gia</small>
              </div>
            </div>
            <div className="spec-pill-item">
              <span className="spec-code-badge">YYYY</span>
              <div className="spec-pill-text">
                <strong>Niên vụ mùa</strong>
                <small>Năm canh tác thu hoạch</small>
              </div>
            </div>
            <div className="spec-pill-item">
              <span className="spec-code-badge">NNNN</span>
              <div className="spec-pill-text">
                <strong>Số hiệu lô</strong>
                <small>Thứ tự lô số hóa độc bản</small>
              </div>
            </div>
            <div className="spec-pill-item cert-hash">
              <span className="spec-code-badge hash">SHA-256</span>
              <div className="spec-pill-text">
                <strong>Bảo chứng băm</strong>
                <small>Chống làm giả nhật ký</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOOTER DOANH NGHIỆP PHONG CÁCH XUẤT NHẬP KHẨU THỰC PHẨM NHƯ Ý */}
      <footer className="portal-master-footer">

        <div className="footer-top-row">
          <div className="footer-col-brand">
            <BrandLogo invert />
            <p className="footer-org-summary">
              Hệ thống truy xuất nguồn gốc chuỗi cung ứng thực phẩm Việt Nam. Xây dựng nền tảng minh bạch hóa, 
              kết nối các hợp tác xã nông sản sạch đến thị trường nội địa và quốc tế.
            </p>
            <div className="footer-cert-tags">
              <span className="cert-pill">VietGAP</span>
              <span className="cert-pill">GlobalGAP</span>
              <span className="cert-pill">HACCP</span>
              <span className="cert-pill">ISO 22000</span>
              <span className="cert-pill">SHA-256</span>
            </div>
          </div>

          <div className="footer-col-nav">
            <h4>Nhóm Nông Sản</h4>
            <ul>
              <li><button type="button" onClick={() => handleTraceBatch('FR-2026-0001')}>Cà phê Arabica Cầu Đất</button></li>
              <li><button type="button" onClick={() => handleTraceBatch('FR-2026-0201')}>Gạo ST25 Sóc Trăng</button></li>
              <li><button type="button" onClick={() => handleTraceBatch('FR-2026-0202')}>Hạt Điều Rang Muối Bình Phước</button></li>
              <li><button type="button" onClick={() => handleTraceBatch('FR-2026-0203')}>Thanh Long Ruột Đỏ Tiền Giang</button></li>
              <li><button type="button" onClick={() => handleTraceBatch('FR-2026-0204')}>Chè Ô Long Mộc Châu</button></li>
              <li><button type="button" onClick={() => handleTraceBatch('FR-2026-0002')}>Sầu Riêng Ri6 Bến Tre</button></li>
            </ul>
          </div>

          <div className="footer-col-nav">
            <h4>Dành Cho Đối Tác</h4>
            <ul>
              <li><button type="button" onClick={() => navigate('/login')}>Cổng đăng nhập đối tác</button></li>
              <li><button type="button" onClick={() => navigate('/register')}>Đăng ký gia nhập mạng lưới</button></li>
              <li><button type="button" onClick={() => navigate('/help')}>Quy chuẩn gắn tem FR-</button></li>
              <li><button type="button" onClick={() => navigate('/audit-logs')}>Bảo chứng kiểm toán chuỗi khối</button></li>
            </ul>
          </div>

          <div className="footer-col-contact">
            <h4>Đầu Mối Hỗ Trợ Kỹ Thuật</h4>
            <p><strong>Hotline:</strong> 1900 6868 (8:00 - 18:00)</p>
            <p><strong>Email:</strong> hotro@foodtrace.vn</p>
            <p><strong>Trụ sở:</strong> Tầng 8, Tòa nhà Công Nghệ Xanh, Quận 1, TP. Hồ Chí Minh</p>
          </div>
        </div>

        <div className="footer-bottom-copyright">
          <div>© 2026 Food Trace Vietnam. Bản quyền thuộc về Đề tài Chuỗi Cung Ứng Thực Phẩm Minh Bạch.</div>
          <div className="footer-legal-links">
            <span>Tiêu chuẩn TCVN 12850:2019</span>
            <span>•</span>
            <span>Bảo mật dữ liệu HMAC-SHA256</span>
          </div>
        </div>
      </footer>

      {/* Modal máy ảnh quét mã QR */}
      {showScanner && (
        <div className="modal-backdrop" onClick={() => setShowScanner(false)}>
          <div className="modal-card-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Quét tem mã QR bao bì nông sản</h3>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setShowScanner(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <QrScannerPanel onDetected={handleScanSuccess} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
