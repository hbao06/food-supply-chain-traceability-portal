import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api, ApiError } from '../api.js'
import { BatchStatusBadge } from '../batches/BatchStatusBadge.jsx'
import {
  STATUS_META,
  formatDateTime,
  formatRelativeTime,
} from '../batches/batchConstants.js'
import { PublicFooter } from '../components/BrandAndFooter.jsx'
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconShield,
  IconSparkles,
  StepIcon,
} from '../components/Icons.jsx'
import { PublicHeader } from './PublicHeader.jsx'
import {
  buildTraceRoute,
  classifyTraceError,
  getPreviewPublicTrace,
  getTraceProgress,
  parseTraceInput,
  sanitizePublicTrace,
} from './traceUtils.js'

function truncateIdentifier(value) {
  const str = String(value || '')
  if (str.length <= 42) return str
  return `${str.slice(0, 22)}…${str.slice(-14)}`
}

export function PublicTraceResult({
  mode,
  identifier,
  prefetchedTrace = null,
  navigate,
  isAuthenticated = false,
  preview = false,
}) {
  const [retryTick, setRetryTick] = useState(0)
  const [quickCode, setQuickCode] = useState('')
  const [quickError, setQuickError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const qrCanvasRef = useRef(null)

  const [state, setState] = useState(() => {
    if (prefetchedTrace) {
      return { status: 'success', data: prefetchedTrace, error: null }
    }
    return { status: 'loading', data: null, error: null }
  })

  useEffect(() => {
    if (prefetchedTrace && retryTick === 0) return

    let active = true

    async function load() {
      if (preview) {
        await Promise.resolve()
        if (!active) return
        const previewData = getPreviewPublicTrace({ mode, identifier })
        if (!previewData) {
          setState({
            status: 'error',
            data: null,
            error: classifyTraceError({ status: 404, code: 'NOT_FOUND' }),
          })
          return
        }
        setState({ status: 'success', data: previewData, error: null })
        return
      }

      try {
        const raw =
          mode === 'token'
            ? await api.traceByToken(identifier)
            : await api.traceByCode(identifier)

        if (!active) return
        const sanitized = sanitizePublicTrace(raw)
        if (!sanitized) {
          throw new ApiError(502, 'INVALID_RESPONSE')
        }
        setState({ status: 'success', data: sanitized, error: null })
      } catch (err) {
        if (!active) return
        setState({
          status: 'error',
          data: null,
          error: classifyTraceError(err),
        })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [identifier, mode, prefetchedTrace, preview, retryTick])

  const shareUrl =
    state.data && typeof window !== 'undefined'
      ? `${window.location.origin}${buildTraceRoute(mode, identifier)}`
      : ''

  useEffect(() => {
    if (!qrCanvasRef.current || !shareUrl) return
    QRCode.toCanvas(
      qrCanvasRef.current,
      shareUrl,
      {
        width: 146,
        margin: 2,
        color: { dark: '#2D4316', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      },
      () => {}
    )
  }, [shareUrl])

  function handleRetry() {
    setState({ status: 'loading', data: null, error: null })
    setRetryTick((t) => t + 1)
  }

  function handleQuickLookup(event) {
    event.preventDefault()
    const parsed = parseTraceInput(quickCode)
    if (!parsed.valid) {
      setQuickError(parsed.error)
      return
    }
    setQuickError('')
    navigate(buildTraceRoute(parsed.mode, parsed.identifier, { preview }))
  }

  function handleCopyShareLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  function handleDownloadQr() {
    if (!qrCanvasRef.current || !state.data) return
    const link = document.createElement('a')
    link.download = `QR-${state.data.batchCode}.png`
    link.href = qrCanvasRef.current.toDataURL('image/png')
    link.click()
  }

  const searchHomePath = preview ? '/trace?preview=1' : '/trace'
  const progress = state.data ? getTraceProgress(state.data.currentStatus) : null

  return (
    <div className="public-portal-page">
      <PublicHeader
        navigate={navigate}
        isAuthenticated={isAuthenticated}
        showSearchLink
        preview={preview}
      />

      <main className="public-main public-result-main">
        <div className="pub-container">
          {state.status === 'loading' && (
            <section className="trace-status-card trace-loading-card" role="status" aria-live="polite">
              <div className="spinner-olive" />
              <p className="trace-loading-text">
                Đang xác thực và tải hành trình nguồn gốc lô hàng…
              </p>
            </section>
          )}

          {state.status === 'error' && state.error?.kind === 'not_found' && (
            <section className="trace-status-card trace-not-found-card" role="alert">
              <div className="not-found-visual" aria-hidden="true">
                <span className="not-found-circle">
                  <IconAlertTriangle />
                </span>
              </div>
              <span className="not-found-code-tag">404 · KHÔNG TÌM THẤY</span>
              <h1>{state.error.title}</h1>
              <p className="status-card-desc">{state.error.message}</p>

              {identifier && (
                <div className="attempted-pill">
                  <span>{mode === 'token' ? 'Mã QR vừa mở:' : 'Mã lô vừa tra cứu:'}</span>
                  <code title={identifier}>{truncateIdentifier(identifier)}</code>
                </div>
              )}

              <div className="not-found-checklist">
                <h2>Gợi ý kiểm tra</h2>
                <ul>
                  <li>Đối chiếu lại mã lô trên tem nhãn theo chuẩn <code>FR-2026-0001</code>.</li>
                  <li>Nếu quét bằng QR, đảm bảo đường dẫn QR trên bao bì không bị cắt hoặc chỉnh sửa ký tự.</li>
                </ul>
              </div>

              <form className="not-found-quick-form" onSubmit={handleQuickLookup} noValidate>
                <input
                  id="retry-trace-code"
                  type="text"
                  className="public-search-input compact"
                  placeholder="Nhập mã lô khác (VD: FR-2026-0002)"
                  value={quickCode}
                  onChange={(e) => {
                    setQuickCode(e.target.value)
                    if (quickError) setQuickError('')
                  }}
                />
                <button type="submit" className="btn-olive-pill">
                  Tra cứu lại
                </button>
              </form>
              {quickError && (
                <p className="field-error" role="alert">{quickError}</p>
              )}

              <div className="status-card-actions">
                <button
                  type="button"
                  className="button secondary with-icon"
                  onClick={() => navigate(searchHomePath)}
                >
                  <IconSearch /> Về trang nhập / quét mã
                </button>
              </div>
            </section>
          )}

          {state.status === 'error' && state.error?.kind !== 'not_found' && (
            <section className="trace-status-card trace-system-error-card" role="alert">
              <div className="not-found-visual warn" aria-hidden="true">
                <span className="not-found-circle warn">
                  <IconAlertTriangle />
                </span>
              </div>
              <span className="not-found-code-tag warn">
                {state.error?.kind === 'rate_limited' ? '429 · GIỚI HẠN TẦN SUẤT' : 'LỖI KẾT NỐI / HỆ THỐNG'}
              </span>
              <h1>{state.error?.title}</h1>
              <p className="status-card-desc">{state.error?.message}</p>

              {identifier && (
                <div className="attempted-pill">
                  <span>Mã đang giữ lại:</span>
                  <code title={identifier}>{truncateIdentifier(identifier)}</code>
                </div>
              )}

              <div className="status-card-actions">
                <button
                  type="button"
                  className="button primary with-icon"
                  onClick={handleRetry}
                >
                  <IconRefresh /> Thử lại
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => navigate(searchHomePath)}
                >
                  Về trang tra cứu
                </button>
              </div>
            </section>
          )}

          {state.status === 'success' && state.data && (
            <>
              {/* Compact Result Top Bar */}
              <div className="trace-result-topbar">
                <nav className="detail-breadcrumb" aria-label="Điều hướng phân cấp">
                  <button type="button" className="breadcrumb-link" onClick={() => navigate(searchHomePath)}>
                    ← Trang tra cứu
                  </button>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">{state.data.batchCode}</span>
                </nav>

                <form className="trace-topbar-quick" onSubmit={handleQuickLookup} noValidate>
                  <input
                    type="text"
                    placeholder="Tra mã FR- khác..."
                    value={quickCode}
                    onChange={(e) => {
                      setQuickCode(e.target.value)
                      if (quickError) setQuickError('')
                    }}
                    aria-label="Tra cứu nhanh mã lô khác"
                  />
                  <button type="submit" className="btn-olive-pill sm">Tra cứu</button>
                </form>
              </div>

              {/* Compact Hero Banner */}
              <header className="public-result-hero">
                <div className="result-hero-main">
                  <div>
                    <div className="result-hero-badges">
                      <span className="verified-public-badge">
                        <IconCheckCircle />
                        {mode === 'token' ? 'Xác thực chữ ký QR hợp lệ' : 'Truy xuất công khai hợp lệ'}
                      </span>
                      <code className="result-batch-code-pill">{state.data.batchCode}</code>
                    </div>
                    <h1>{state.data.productName}</h1>
                    <p className="result-hero-origin">
                      <IconMapPin /> Xuất xứ: <strong>{state.data.origin}</strong>
                      <span className="hero-sep">·</span>
                      <IconBuilding /> <strong>{state.data.organizationName}</strong>
                    </p>
                  </div>
                  <div className="result-hero-status-box">
                    <span className="hero-status-caption">Trạng thái hiện tại</span>
                    <BatchStatusBadge status={state.data.currentStatus} size="large" />
                  </div>
                </div>
              </header>

              {/* Balanced 2-Column Layout: Sticky Info + QR on Left, Compact Timeline on Right */}
              <div className="public-trace-layout">
                <aside className="public-batch-info-col">
                  <section className="public-batch-info-card" aria-labelledby="public-batch-info-heading">
                    <div className="public-card-header">
                      <h2 id="public-batch-info-heading">Hồ sơ lô sản phẩm</h2>
                      <code className="batch-code-tag">{state.data.batchCode}</code>
                    </div>

                    <dl className="public-facts-list">
                      <div className="public-fact-row">
                        <dt>Sản phẩm</dt>
                        <dd>{state.data.productName}</dd>
                      </div>
                      <div className="public-fact-row">
                        <dt>Nguồn gốc</dt>
                        <dd>{state.data.origin}</dd>
                      </div>
                      <div className="public-fact-row">
                        <dt>Đơn vị sản xuất</dt>
                        <dd>{state.data.organizationName}</dd>
                      </div>
                      <div className="public-fact-row">
                        <dt>Giai đoạn</dt>
                        <dd>
                          <BatchStatusBadge status={state.data.currentStatus} />
                        </dd>
                      </div>
                    </dl>

                    {progress && (
                      <div className="public-progress-box">
                        <div className="public-progress-meta">
                          <span>Tiến độ chuỗi cung ứng</span>
                          <strong>{progress.completedSteps}/{progress.totalSteps} bước ({progress.percent}%)</strong>
                        </div>
                        <div className="chain-progress-track">
                          <div
                            className="chain-progress-fill"
                            style={{ width: `${progress.percent}%` }}
                            role="progressbar"
                            aria-valuenow={progress.percent}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          />
                        </div>
                      </div>
                    )}

                    {/* Live Scannable QR Stamp on Result Page */}
                    <div className="public-result-qr-box">
                      <div className="public-result-qr-canvas">
                        <canvas ref={qrCanvasRef} aria-label={`Mã QR truy xuất lô ${state.data.batchCode}`} />
                      </div>
                      <div className="public-result-qr-actions">
                        <strong>Mã QR chia sẻ nhanh</strong>
                        <p>Quét bằng điện thoại hoặc tải ảnh tem QR để kiểm tra lại bất cứ lúc nào.</p>
                        <div className="qr-mini-btn-row">
                          <button type="button" className="button secondary sm with-icon" onClick={handleDownloadQr}>
                            <IconDownload /> Tải PNG
                          </button>
                          <button type="button" className="button secondary sm with-icon" onClick={handleCopyShareLink}>
                            {copiedLink ? <><IconCheck /> Đã chép</> : 'Chép link'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="public-privacy-note">
                      <IconShield />
                      <small>
                        Chỉ hiển thị thông tin nguồn gốc và sự kiện được phép công khai. Dữ liệu tài khoản cá nhân và nhật ký nội bộ được bảo mật.
                      </small>
                    </div>
                  </section>
                </aside>

                <section className="public-timeline-card" aria-labelledby="public-timeline-heading">
                  <div className="public-timeline-head">
                    <div>
                      <h2 id="public-timeline-heading">Hành trình chuỗi cung ứng</h2>
                      <p className="public-timeline-sub">
                        Các mốc xác thực được ghi nhận theo trình tự từ nông trại tới điểm bán.
                      </p>
                    </div>
                    <span className="timeline-count-pill">
                      {state.data.events.length} / 6 mốc
                    </span>
                  </div>

                  {state.data.events.length === 0 ? (
                    <div className="public-empty-events">
                      <p>Chưa có sự kiện nào được ghi nhận cho lô hàng này.</p>
                    </div>
                  ) : (
                    <ol className="public-timeline-list">
                      {state.data.events.map((ev, index) => {
                        const meta = STATUS_META[ev.eventType] || {}
                        const isLatest = index === state.data.events.length - 1
                        const relativeTime = formatRelativeTime(ev.timestamp)

                        return (
                          <li
                            key={`${ev.eventType}-${ev.timestamp || index}`}
                            className={`public-timeline-item ${isLatest ? 'is-latest' : ''}`}
                          >
                            <div className="public-timeline-marker" aria-hidden="true">
                              <span className={`public-marker-dot ${meta.color || 'emerald'}`}>
                                <StepIcon type={ev.eventType} />
                              </span>
                            </div>

                            <div className="public-timeline-body">
                              <div className="public-event-top">
                                <div className="public-event-title-wrap">
                                  <h3 className="public-event-title">
                                    {meta.label || ev.eventType}
                                  </h3>
                                  <BatchStatusBadge status={ev.eventType} />
                                  {isLatest && (
                                    <span className="current-pulse-badge">Mới nhất</span>
                                  )}
                                </div>

                                <div className="public-event-time">
                                  <span><IconClock /> {formatDateTime(ev.timestamp)}</span>
                                  {relativeTime && <small>{relativeTime}</small>}
                                </div>
                              </div>

                              <div className="public-event-facts">
                                <div className="public-event-fact">
                                  <span className="fact-k"><IconBuilding /> Đơn vị</span>
                                  <strong className="fact-v">{ev.organizationName}</strong>
                                </div>
                                <div className="public-event-fact">
                                  <span className="fact-k"><IconMapPin /> Địa điểm</span>
                                  <strong className="fact-v">{ev.location}</strong>
                                </div>
                              </div>

                              {ev.description && (
                                <p className="public-event-desc">{ev.description}</p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )}

                  {state.data.events.length === 1 && state.data.currentStatus === 'CREATED' && (
                    <div className="public-initial-stage-note">
                      <IconSparkles />
                      <span>
                        Lô hàng vừa được khởi tạo tại nông trại. Các công đoạn vận chuyển, chế biến và đóng gói tiếp theo sẽ tự động cập nhật tại đây.
                      </span>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>

      <PublicFooter navigate={navigate} preview={preview} />
    </div>
  )
}
