import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { BatchQrModal } from './BatchQrModal.jsx'
import { BatchTimeline } from './BatchTimeline.jsx'
import { AddEventModal } from './AddEventModal.jsx'
import {
  PREVIEW_BATCHES,
  STATUS_META,
  SUPPLY_CHAIN_STEPS,
  formatDateTime,
  formatQuantity,
  canUserAddEvent,
} from './batchConstants.js'
import {
  IconEdit,
  IconQr,
  IconMapPin,
  IconLock,
  IconUnlock,
  IconShield,
  IconTimeline,
  IconPlus,
  IconClipboard,
  IconAlertTriangle,
  IconCheck,
} from '../components/Icons.jsx'

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
  const [activeTab, setActiveTab] = useState('timeline') // 'timeline' | 'info' | 'steps'
  const [showQrModal, setShowQrModal] = useState(false)
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [qrState, setQrState] = useState({ batchId: null, qrData: '', error: '' })
  const [flashMessage, setFlashMessage] = useState('')
  const [timelineRefreshTick, setTimelineRefreshTick] = useState(0)
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

  const fallbackQrUrl = batch
    ? (batch.qrData || `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/trace/code/${encodeURIComponent(batch.batchCode)}`)
    : ''

  const qrBatchId = batch?.batchId
  const needsQrFetch = Boolean(qrBatchId && token && !preview)
  const qrLoading = needsQrFetch && qrState.batchId !== qrBatchId
  const qrData = qrLoading ? '' : (qrState.qrData || fallbackQrUrl)
  const qrError = qrLoading ? '' : qrState.error
  const traceUrl = qrData

  useEffect(() => {
    if (!qrBatchId || !token || preview) return
    let active = true
    api.getBatchQr(token, qrBatchId).then((data) => {
      if (active) {
        setQrState({
          batchId: qrBatchId,
          qrData: typeof data.qrData === 'string' && data.qrData ? data.qrData : fallbackQrUrl,
          error: '',
        })
      }
    }).catch((err) => {
      if (active) {
        setQrState({
          batchId: qrBatchId,
          qrData: fallbackQrUrl,
          error: fallbackQrUrl ? '' : (err instanceof ApiError ? errorMessage(err) : 'Không thể tải mã QR của lô hàng.'),
        })
      }
    })
    return () => { active = false }
  }, [token, preview, qrBatchId, fallbackQrUrl])

  useEffect(() => {
    if (!qrCanvasRef.current || !traceUrl) return
    QRCode.toCanvas(
      qrCanvasRef.current,
      traceUrl,
      {
        width: 176,
        margin: 2,
        color: {
          dark: '#2D4316',
          light: '#FFFFFF',
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
      <div className="state-block" role="status">
        <div className="spinner-olive" />
        <p>Đang tải thông tin chi tiết lô thực phẩm…</p>
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="state-block" role="alert">
        <span className="state-icon"><IconAlertTriangle /></span>
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

  const eventPermission = canUserAddEvent(user, batch)
  const canAddEvent = eventPermission.allowed

  function handleEventAdded(newEvent, updatedBatch) {
    setBatch(updatedBatch)
    setShowAddEventModal(false)
    setTimelineRefreshTick((t) => t + 1)
    setFlashMessage(`Đã ghi nhận thành công sự kiện: ${STATUS_META[newEvent.eventType]?.label || newEvent.eventType}`)
    setTimeout(() => setFlashMessage(''), 4500)
  }

  return (
    <div className="batch-detail-view">
      <nav className="detail-breadcrumb" aria-label="Điều hướng phân cấp">
        <button type="button" className="breadcrumb-link" onClick={onBack}>
          ← Quản lý lô
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{batch.batchCode}</span>
      </nav>

      {/* Compact Hero Header */}
      <header className="detail-hero">
        <div className="detail-hero-left">
          <div className="hero-tags">
            <button type="button" className="hero-code-badge" onClick={handleCopyCode} title="Bấm để sao chép mã">
              <code>{batch.batchCode}</code>
              <span className="copy-icon-sub">{copiedCode ? <><IconCheck /> Đã chép</> : 'Sao chép'}</span>
            </button>
            <BatchStatusBadge status={batch.currentStatus} size="large" />
          </div>
          <h1 className="detail-product-title">{batch.productName}</h1>
          <p className="detail-origin-subtitle">
            <IconMapPin /> <strong>{batch.origin}</strong>
            <span className="hero-sep">·</span>
            Sản lượng: <strong>{formatQuantity(batch.quantity)}</strong>
          </p>
        </div>

        <div className="detail-hero-actions">
          {canAddEvent && batch.currentStatus !== 'SHIPPED' && (
            <button
              type="button"
              className="button primary with-icon"
              onClick={() => setShowAddEventModal(true)}
            >
              <IconPlus /> Ghi nhận sự kiện
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="button secondary with-icon"
              onClick={() => onEdit(batch)}
            >
              <IconEdit /> Sửa lô
            </button>
          )}
          <button
            type="button"
            className="button secondary with-icon"
            onClick={() => setShowQrModal(true)}
          >
            <IconQr /> Tem QR
          </button>
        </div>
      </header>

      {flashMessage && (
        <div className="notice success" role="status">
          {flashMessage}
        </div>
      )}

      {/* Segmented View Tabs (Prevents Endless Vertical Scrolling) */}
      <nav className="detail-tab-nav" aria-label="Phân khu chi tiết lô">
        <button
          type="button"
          className={`detail-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <IconTimeline /> Dòng thời gian sự kiện
        </button>
        <button
          type="button"
          className={`detail-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <IconClipboard /> Hồ sơ & Xuất xứ
        </button>
        <button
          type="button"
          className={`detail-tab-btn ${activeTab === 'steps' ? 'active' : ''}`}
          onClick={() => setActiveTab('steps')}
        >
          <IconShield /> Lộ trình 6 bước
        </button>
      </nav>

      {/* Compact 2-Column Content */}
      <div className="detail-grid-layout">
        <div className="detail-left-col">
          {activeTab === 'timeline' ? (
            <BatchTimeline
              key={timelineRefreshTick}
              batch={batch}
              user={user}
              token={token}
              preview={preview}
              onBatchUpdated={(updated) => setBatch(updated)}
            />
          ) : activeTab === 'info' ? (
            <section className="detail-card">
              <div className="detail-card-head">
                <h2>Thông tin xuất xứ & Hồ sơ lô</h2>
                <span className="card-badge-info">Chuẩn FR-</span>
              </div>

              <div className="facts-grid">
                <div className="fact-item">
                  <span className="fact-label">Mã lô định danh</span>
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
                    {batch.organizationName || (batch.organizationId ? `Đơn vị #${batch.organizationId}` : 'Hợp tác xã nông nghiệp')}
                  </span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Mã hệ thống</span>
                  <span className="fact-val mono">#{batch.batchId}</span>
                </div>
              </div>

              <div className={`immutability-badge-box ${canEdit ? 'editable' : 'locked'}`}>
                <div className="immutability-icon">{canEdit ? <IconUnlock /> : <IconLock />}</div>
                <div className="immutability-text">
                  <strong>
                    {canEdit
                      ? 'Đang ở trạng thái Khởi tạo (CREATED) — Cho phép hiệu chỉnh'
                      : 'Thông tin gốc đã khóa bất biến'}
                  </strong>
                  <p>
                    {canEdit
                      ? 'Bạn có thể cập nhật tên sản phẩm, nguồn gốc và số lượng trước khi đơn vị vận chuyển tiếp nhận.'
                      : `Lô đã sang giai đoạn ${STATUS_META[batch.currentStatus]?.label || batch.currentStatus}. Mọi thông tin nguồn gốc được bảo toàn vĩnh viễn.`}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="detail-card">
              <div className="detail-card-head">
                <h2>Tiến trình chuẩn 6 giai đoạn</h2>
                <span className="card-badge-info">{currentStepIndex + 1}/6 hoàn tất</span>
              </div>

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
                          {isCompleted ? <IconCheck /> : index + 1}
                        </span>
                      </div>
                      <div className="node-content">
                        <div className="node-title-row">
                          <strong className="node-title">{step.label}</strong>
                          <span className="node-role-tag">{step.roleVi}</span>
                        </div>
                        <span className="node-status-desc">
                          {isCurrent
                            ? `Hiện tại: ${stepMeta?.description || ''}`
                            : isCompleted
                            ? 'Đã xác thực hoàn tất'
                            : 'Đang chờ xử lý'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sticky Right Column: Real Scannable QR Card */}
        <aside className="detail-right-col">
          <div className="qr-summary-card">
            <div className="qr-card-header">
              <span className="modal-kicker">TEM TRUY XUẤT CHÍNH THỨC</span>
              <h3>Mã QR Định Danh</h3>
            </div>

            <div className="qr-display-box">
              {qrLoading && <p role="status">Đang tải mã QR…</p>}
              {qrError && <p role="alert">{qrError}</p>}
              {!qrLoading && !qrError && traceUrl && <canvas ref={qrCanvasRef} className="detail-qr-canvas" />}
              <div className="qr-tag-label">
                <code>{batch.batchCode}</code>
              </div>
            </div>

            <div className="qr-url-compact">
              <span className="qr-url-truncate" title={traceUrl}>
                {traceUrl || (qrLoading ? 'Đang tải liên kết…' : qrError)}
              </span>
              <button
                type="button"
                className="text-button copy-link-btn"
                onClick={handleCopyUrl}
                disabled={!traceUrl}
              >
                {copiedUrl ? <><IconCheck /> Đã chép</> : 'Chép'}
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
              {canAddEvent && batch.currentStatus !== 'SHIPPED' && (
                <button
                  type="button"
                  className="button secondary wide with-icon"
                  onClick={() => setShowAddEventModal(true)}
                >
                  <IconPlus /> Ghi nhận bước kế tiếp
                </button>
              )}
            </div>

            <div className="qr-security-note">
              <span className="shield-icon"><IconShield /></span>
              <small>
                Chữ ký số HMAC-SHA256 giúp người tiêu dùng xác thực đúng lô hàng nguyên bản.
              </small>
            </div>
          </div>
        </aside>
      </div>

      {showQrModal && (
        <BatchQrModal
          batch={batch}
          token={token}
          preview={preview}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {showAddEventModal && (
        <AddEventModal
          batch={batch}
          user={user}
          token={token}
          preview={preview}
          onSuccess={handleEventAdded}
          onClose={() => setShowAddEventModal(false)}
        />
      )}
    </div>
  )
}
