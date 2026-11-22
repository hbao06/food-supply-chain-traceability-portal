import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { STATUS_META, resolveBatchImage } from '../batches/batchConstants.js'
import { BrandLogo, PublicFooter } from '../components/BrandAndFooter.jsx'
import { TruckIllustration, WarehouseIllustration } from '../components/Illustrations.jsx'
import { QrScannerPanel } from './QrScannerPanel.jsx'
import { parseTraceInput } from './traceUtils.js'

function buildProductDisplayMeta(batch) {
  if (!batch) return null
  const statusMeta = STATUS_META[batch.currentStatus] || {
    label: batch.currentStatus || 'Đã xác thực',
    shortLabel: batch.currentStatus || 'Xác thực',
    description: 'Thông tin lô hàng đã được xác thực trên hệ thống.',
  }
  const orgName = batch.organizationName || 'Đối tác Food Trace'
  return {
    id: batch.batchCode,
    name: batch.productName,
    category: statusMeta.label,
    origin: batch.origin,
    standard: orgName,
    image: resolveBatchImage(batch),
    tag: statusMeta.shortLabel || statusMeta.label,
    desc: `${statusMeta.description} Nguồn gốc: ${batch.origin}${batch.organizationName ? ` · ${batch.organizationName}` : ''}.`,
    trustPoints: [
      { title: orgName, sub: `Xuất xứ: ${batch.origin}` },
      { title: `Trạng thái: ${statusMeta.label}`, sub: statusMeta.description },
      { title: 'Bảo chứng mã băm SHA-256', sub: 'Chống giả mạo và lưu vết bất biến trong PostgreSQL' },
    ],
  }
}

export function PublicTraceSearch({ navigate, isAuthenticated = false }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [recentBatches, setRecentBatches] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [selectedCode, setSelectedCode] = useState('')
  const railRef = useRef(null)

  useEffect(() => {
    let active = true
    api
      .listRecentPublicTraces(6)
      .then((res) => {
        if (!active) return
        const items = Array.isArray(res?.items) ? res.items : []
        setRecentBatches(items)
        if (items.length > 0) {
          setSelectedCode((prev) => prev || items[0].batchCode)
        }
      })
      .catch(() => {
        if (active) setRecentBatches([])
      })
      .finally(() => {
        if (active) setRecentLoading(false)
      })
    return () => { active = false }
  }, [])

  const showcaseItems = useMemo(
    () => recentBatches.map(buildProductDisplayMeta).filter(Boolean),
    [recentBatches]
  )

  const selectedProduct = useMemo(
    () => showcaseItems.find((p) => p.id === selectedCode) || showcaseItems[0] || null,
    [showcaseItems, selectedCode]
  )

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
      setError(parsed.error || 'Mã lô không hợp lệ (Ví dụ hợp lệ: FR-2026-0001).')
      return
    }

    navigate(parsed.route)
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
          <div className="header-brand" onClick={() => navigate('/trace')}>
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

      {/* 2. HERO BANNER - BỐ CỤC 2 CỘT CÂN ĐỐI, HIỆN ĐẠI */}
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
                  placeholder="Nhập mã lô hàng (Ví dụ: FR-2026-0001) hoặc dán đường dẫn QR"
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase()
                    setInput(val)
                    setError('')
                    const match = showcaseItems.find((p) => p.id === val.trim())
                    if (match) setSelectedCode(match.id)
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

            {/* Phím tắt chọn nhanh các lô hàng thật mới công bố */}
            <div className="hero-shortcuts-row">
              <span className="shortcuts-title">Lô nông sản mới công bố (bấm để xem nhanh):</span>
              {recentLoading ? (
                <div className="shortcuts-chips-wrap">
                  <span className="shortcuts-title">Đang tải dữ liệu lô hàng từ máy chủ…</span>
                </div>
              ) : showcaseItems.length > 0 ? (
                <div className="shortcuts-chips-wrap">
                  {showcaseItems.map((item) => {
                    const isSelected = selectedProduct?.id === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`shortcut-chip-item ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setInput(item.id)
                          setSelectedCode(item.id)
                        }}
                        title={`Bấm để xem thông tin ${item.name}`}
                      >
                        <span className="chip-dot" />
                        <strong>{item.id}</strong>: {item.name}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="shortcuts-chips-wrap">
                  <span className="shortcuts-title">
                    Chưa có lô nông sản nào được công bố. Hãy quét tem QR trên bao bì hoặc đăng nhập đối tác để khởi tạo lô mới.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: CARD MINH HỌA SẢN PHẨM TỪ DỮ LIỆU THẬT */}
          <div className="hero-trust-badge-col">
            {selectedProduct ? (
              <div className="hero-digital-qr-card">
                <div className="qr-card-cover-box">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="qr-card-big-img"
                    onError={(e) => { e.currentTarget.src = '/products/warehouse.jpg' }}
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
            ) : (
              <div className="hero-digital-qr-card">
                <div className="qr-card-cover-box">
                  <img
                    src="/products/warehouse.jpg"
                    alt="Cổng xác thực nguồn gốc nông sản"
                    className="qr-card-big-img"
                  />
                  <div className="qr-card-cover-badge-row">
                    <span className="qr-card-category-tag">Chuẩn FR-YYYY-NNNN</span>
                    <span className="qr-card-std-tag">HMAC-SHA256</span>
                  </div>
                </div>

                <div className="qr-card-body-content">
                  <div className="qr-card-title-group">
                    <span className="qr-card-badge">CỔNG TRUY XUẤT QUỐC GIA</span>
                    <h3 className="qr-card-product-name">Xác thực nguồn gốc theo thời gian thực</h3>
                    <div className="qr-card-code-row">
                      <code className="qr-card-code-tag">FR-YYYY-NNNN</code>
                      <span className="qr-card-origin-text">• Dữ liệu trực tiếp PostgreSQL</span>
                    </div>
                  </div>

                  <div className="qr-card-features-list">
                    <div className="qr-feature-item">
                      <span className="feature-icon">✓</span>
                      <div>
                        <strong>Truy xuất không cần đăng nhập</strong>
                        <p>Quét trực tiếp tem QR trên bao bì bằng camera điện thoại hoặc ảnh PNG</p>
                      </div>
                    </div>
                    <div className="qr-feature-item">
                      <span className="feature-icon">✓</span>
                      <div>
                        <strong>6 chặng chuỗi cung ứng khép kín</strong>
                        <p>Từ nông trại, vận tải, tiếp nhận kho, chế biến, đóng gói đến phân phối</p>
                      </div>
                    </div>
                    <div className="qr-feature-item">
                      <span className="feature-icon">✓</span>
                      <div>
                        <strong>Bảo chứng chữ ký &amp; chuỗi băm SHA-256</strong>
                        <p>Ngăn chặn làm giả tem nhãn và bảo toàn nhật ký bất biến</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-qr-card-inspect"
                    onClick={() => setShowScanner(true)}
                  >
                    Mở camera quét tem QR ngay →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. PRODUCT SHOWCASE RAIL */}
      <section id="showcase" className="showcase-rail-section">
        <div className="rail-header-container">
          <div>
            <div className="rail-kicker">DỮ LIỆU TRỰC TIẾP TỪ HỆ THỐNG</div>
            <h2 className="rail-title text-balance">Nông sản tiêu biểu</h2>
          </div>
          {showcaseItems.length > 0 && (
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
          )}
        </div>

        {recentLoading ? (
          <div className="batches-loading-state" role="status">
            <div className="spinner-olive" />
            <p>Đang tải danh sách nông sản công bố…</p>
          </div>
        ) : showcaseItems.length === 0 ? (
          <div className="batches-empty-state">
            <h3>Chưa có lô nông sản nào được công bố</h3>
            <p>Khi đối tác nông trại khởi tạo lô hàng thật trong hệ thống, danh sách sản phẩm sẽ tự động hiển thị tại đây.</p>
            <div className="empty-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => navigate(isAuthenticated ? '/batches/new' : '/login')}
              >
                {isAuthenticated ? 'Khởi tạo lô đầu tiên' : 'Đăng nhập đối tác →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="showcase-rail-track" ref={railRef}>
            {showcaseItems.map((prod) => (
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
                      e.currentTarget.src = '/products/warehouse.jpg'
                    }}
                  />
                  <span className="card-category-badge">{prod.tag}</span>
                </div>
                <div className="card-info-pane">
                  <div className="card-location-meta">
                    <span>{prod.standard}</span>
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
        )}
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

      {/* 6. FOOTER DOANH NGHIỆP */}
      <PublicFooter navigate={navigate} recentBatches={recentBatches} />

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
