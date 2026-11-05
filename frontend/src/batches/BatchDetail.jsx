import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { BatchQrModal } from './BatchQrModal.jsx'
import {
  PREVIEW_BATCHES,
  STATUS_META,
  SUPPLY_CHAIN_STEPS,
  formatDateTime,
  formatQuantity,
} from './batchConstants.js'
import { IconEdit, IconQr, IconMapPin, IconLock, IconUnlock, IconShield } from '../components/Icons.jsx'

export function BatchDetail({
  batchId,
  initialBatch = null,
  token,
  user,
  preview = false,
  onBack,
  onEdit,
}) {
  const [batch, setBatch] = useState(() => {
    if (initialBatch) return initialBatch
    if (preview) {
      return PREVIEW_BATCHES.find((b) => b.batchId === Number(batchId)) || PREVIEW_BATCHES[0]
    }
    return null
  })
  const [loading, setLoading] = useState(() => !initialBatch && !preview)
  const [error, setError] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const qrCanvasRef = useRef(null)

  useEffect(() => {
    if (initialBatch || preview) return
    let active = true
    api
      .getBatch(token, batchId)
      .then((data) => {
        if (active) {
          setBatch(data)
          setError('')
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? errorMessage(err)
              : 'Không thể tải thông tin chi tiết lô hàng.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [batchId, initialBatch, token, preview])

  // Render inline QR code on the side card
  const traceUrl =
    batch?.qrData ||
    (batch?.batchCode
      ? `${window.location.origin}/trace/${batch.batchCode}`
      : '')

  useEffect(() => {
    if (!qrCanvasRef.current || !traceUrl) return
    QRCode.toCanvas(
      qrCanvasRef.current,
      traceUrl,
      {
        width: 180,
        margin: 2,
        color: {
          dark: '#0f3a2c',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (err) => {
        if (err) console.error('Lỗi vẽ QR:', err)
      }
    )
  }, [traceUrl])

  function handleCopyCode() {
    if (!batch?.batchCode) return
    navigator.clipboard.writeText(batch.batchCode).then(() => {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    })
  }

  function handleCopyUrl() {
    if (!traceUrl) return
    navigator.clipboard.writeText(traceUrl).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="state-block detail-loading-skeleton" role="status">
        <div className="skeleton-line shimmer-short" />
        <div className="skeleton-box shimmer-block" />
        <p>Đang tải thông tin chi tiết lô thực phẩm…</p>
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="state-block" role="alert">
        <span className="state-icon">⚠️</span>
        <h2>Không thể tải lô hàng</h2>
        <p>{error || 'Lô hàng không tồn tại hoặc bạn không có quyền truy cập.'}</p>
        <button type="button" className="button secondary" onClick={onBack}>
          Quay lại danh sách
        </button>
      </div>
    )
  }

  const currentStepIndex = SUPPLY_CHAIN_STEPS.findIndex(
    (s) => s.type === batch.currentStatus
  )
  const isFarmer = user?.role === 'FARMER' || preview
  const canEdit = isFarmer && batch.currentStatus === 'CREATED'

  return (
    <div className="batch-detail-view">
      {/* Breadcrumb & Navigation */}
      <nav className="detail-breadcrumb" aria-label="Điều hướng phân cấp">
        <button type="button" className="breadcrumb-link" onClick={onBack}>
          ← Quản lý lô
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{batch.batchCode}</span>
      </nav>

      {/* Hero Header */}
      <header className="detail-hero">
        <div className="detail-hero-left">
          <div className="hero-tags">
            <span className="hero-code-badge" onClick={handleCopyCode} title="Bấm để sao chép mã">
              <code>{batch.batchCode}</code>
              <span className="copy-icon-sub">{copiedCode ? '✓ Đã chép' : 'Sao chép'}</span>
            </span>
            <BatchStatusBadge status={batch.currentStatus} size="large" />
          </div>
          <h1 className="detail-product-title">{batch.productName}</h1>
          <p className="detail-origin-subtitle">
            <span className="geo-icon"><IconMapPin /></span> Xuất xứ: <strong>{batch.origin}</strong>
          </p>
        </div>

        <div className="detail-hero-actions">
          {canEdit && (
            <button
              type="button"
              className="button secondary with-icon"
              onClick={() => onEdit(batch)}
            >
              <IconEdit /> Hiệu chỉnh lô
            </button>
          )}
          <button
            type="button"
            className="button primary with-icon"
            onClick={() => setShowQrModal(true)}
          >
            <IconQr /> Xem & Tải mã QR
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="detail-grid-layout">
        {/* Left Column: Info & Timeline */}
        <div className="detail-left-col">
          {/* Card: Thông tin cơ bản */}
          <section className="detail-card">
            <div className="detail-card-head">
              <div>
                <span className="section-index">01</span>
                <h2>Thông tin xuất xứ & Đặc tính</h2>
              </div>
              <span className="card-badge-info">Hồ sơ nông sản</span>
            </div>

            <div className="facts-grid">
              <div className="fact-item">
                <span className="fact-label">Mã lô hệ thống</span>
                <span className="fact-val mono">{batch.batchCode}</span>
              </div>
              <div className="fact-item">
                <span className="fact-label">Sản lượng đăng ký</span>
                <span className="fact-val highlight-qty">
                  {formatQuantity(batch.quantity)}
                </span>
              </div>
              <div className="fact-item">
                <span className="fact-label">Nơi canh tác / Thu hoạch</span>
                <span className="fact-val">{batch.origin}</span>
              </div>
              <div className="fact-item">
                <span className="fact-label">Thời gian khởi tạo</span>
                <span className="fact-val">{formatDateTime(batch.creationDate)}</span>
              </div>
              <div className="fact-item">
                <span className="fact-label">Đơn vị sở hữu</span>
                <span className="fact-val">
                  {batch.organizationName ||
                    (batch.organizationId
                      ? `Đơn vị #${batch.organizationId}`
                      : 'Hợp tác xã nông nghiệp')}
                </span>
              </div>
              <div className="fact-item">
                <span className="fact-label">Mã định danh nội bộ</span>
                <span className="fact-val mono">#{batch.batchId}</span>
              </div>
            </div>

            <div className={`immutability-badge-box ${canEdit ? 'editable' : 'locked'}`}>
              <div className="immutability-icon">{canEdit ? <IconUnlock /> : <IconLock />}</div>
              <div className="immutability-text">
                <strong>
                  {canEdit
                    ? 'Lô hàng đang ở trạng thái Khởi tạo (CREATED) — Được phép hiệu chỉnh'
                    : 'Thông tin lô hàng đã được khóa bất biến'}
                </strong>
                <p>
                  {canEdit
                    ? 'Chủ sở hữu có thể cập nhật tên sản phẩm, nguồn gốc và số lượng trước khi bắt đầu chuyển giao chuỗi cung ứng.'
                    : `Lô đã tiến vào giai đoạn ${STATUS_META[batch.currentStatus]?.label || batch.currentStatus}. Mọi dữ liệu gốc được bảo lưu vĩnh viễn trên sổ cái hệ thống theo tiêu chuẩn an toàn thực phẩm.`}
                </p>
              </div>
            </div>
          </section>

          {/* Card: Tiến trình Chuỗi cung ứng (Visual Stepper) */}
          <section className="detail-card">
            <div className="detail-card-head">
              <div>
                <span className="section-index">02</span>
                <h2>Tiến trình chuỗi cung ứng</h2>
              </div>
              <span className="card-badge-info">6 giai đoạn chuẩn</span>
            </div>

            <p className="timeline-lead">
              Hành trình truy xuất từ nông trại tới tay người tiêu dùng theo quy trình kiểm định chất lượng:
            </p>

            <div className="supply-stepper">
              {SUPPLY_CHAIN_STEPS.map((step, index) => {
                const isCompleted = index < currentStepIndex
                const isCurrent = index === currentStepIndex
                const stepMeta = STATUS_META[step.type]

                return (
                  <div
                    key={step.type}
                    className={`stepper-node ${
                      isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'
                    }`}
                  >
                    <div className="node-icon-wrap">
                      <span className="node-number">
                        {isCompleted ? '✓' : index + 1}
                      </span>
                    </div>
                    <div className="node-content">
                      <div className="node-title-row">
                        <strong className="node-title">{step.label}</strong>
                        <span className="node-role-tag">{step.role}</span>
                      </div>
                      <span className="node-status-desc">
                        {isCurrent
                          ? `Đang ở bước này: ${stepMeta?.description || ''}`
                          : isCompleted
                          ? 'Đã hoàn thành xác thực'
                          : 'Đang chờ xử lý'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Right Column: QR Code Card & Verification */}
        <aside className="detail-right-col">
          <div className="qr-summary-card">
            <div className="qr-card-header">
              <span className="eyebrow">CHỨNG THỰC NGUỒN GỐC</span>
              <h3>Mã QR Định Danh</h3>
              <p>Mã QR duy nhất gắn liền với lô hàng, chứa chữ ký số chống giả mạo.</p>
            </div>

            <div className="qr-display-box">
              <canvas ref={qrCanvasRef} className="detail-qr-canvas" />
              <div className="qr-tag-label">
                <code>{batch.batchCode}</code>
              </div>
            </div>

            <div className="qr-url-compact">
              <span className="qr-url-truncate" title={traceUrl}>
                {traceUrl}
              </span>
              <button
                type="button"
                className="text-button copy-link-btn"
                onClick={handleCopyUrl}
              >
                {copiedUrl ? '✓ Đã chép' : 'Chép link'}
              </button>
            </div>

            <div className="qr-action-buttons">
              <button
                type="button"
                className="button primary wide"
                onClick={() => setShowQrModal(true)}
              >
                Phóng to & Tải tem QR
              </button>
            </div>

            <div className="qr-security-note">
              <span className="shield-icon"><IconShield /></span>
              <small>
                Mã QR được ký bởi HMAC-SHA256 bí mật tại máy chủ, đảm bảo người tiêu dùng tra cứu
                đúng lô hàng chính gốc.
              </small>
            </div>
          </div>
        </aside>
      </div>

      {/* QR Modal */}
      {showQrModal && (
        <BatchQrModal batch={batch} onClose={() => setShowQrModal(false)} />
      )}
    </div>
  )
}
