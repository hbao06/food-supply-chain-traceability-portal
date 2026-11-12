import { useEffect, useState } from 'react'
import { api, ApiError } from '../api.js'
import { BatchStatusBadge } from '../batches/BatchStatusBadge.jsx'
import {
  STATUS_META,
  formatDateTime,
  formatRelativeTime,
} from '../batches/batchConstants.js'
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheckCircle,
  IconClock,
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

  const searchHomePath = preview ? '/trace?preview=1' : '/trace'
  const progress = state.data ? getTraceProgress(state.data.currentStatus) : null

  return (
    <div className="public-page">
      <PublicHeader
        navigate={navigate}
        isAuthenticated={isAuthenticated}
        showSearchLink
        preview={preview}
      />

      <main className="public-main public-result-main">
        <div className="public-container">
          {preview && (
            <div className="preview-banner" role="status">
              <strong><IconSparkles /> Chế độ xem trước công khai (Demo)</strong> — Dữ liệu đang hiển thị theo mô phỏng công khai chuẩn <code>PublicTrace</code> (ẩn thông tin định danh cá nhân và nhật ký nội bộ).
            </div>
          )}

          {state.status === 'loading' && (
            <section className="trace-status-card trace-loading-card" role="status" aria-live="polite">
              <div className="trace-skeleton-header">
                <div className="skeleton-line shimmer-short" />
                <div className="skeleton-title shimmer-medium" />
              </div>
              <div className="trace-skeleton-grid">
                <div className="skeleton-box shimmer-block" />
                <div className="skeleton-box shimmer-block" />
              </div>
              <p className="trace-loading-text">
                Đang tra cứu thông tin nguồn gốc và hành trình lô hàng…
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
                  <li>Đối chiếu lại mã lô trên tem nhãn (ví dụ <code>BATCH-2026-0001</code>).</li>
                  <li>Nếu quét bằng QR, đảm bảo đường dẫn QR trên bao bì không bị cắt hoặc chỉnh sửa ký tự.</li>
                </ul>
              </div>

              <form className="not-found-quick-form" onSubmit={handleQuickLookup} noValidate>
                <label htmlFor="retry-trace-code" className="sr-only-label">
                  Nhập mã lô khác
                </label>
                <input
                  id="retry-trace-code"
                  type="text"
                  className="public-search-input compact"
                  placeholder="Nhập mã lô khác (VD: BATCH-2026-0001)"
                  value={quickCode}
                  onChange={(e) => {
                    setQuickCode(e.target.value)
                    if (quickError) setQuickError('')
                  }}
                />
                <button type="submit" className="button primary">
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
              {/* Hero Summary Banner */}
              <header className="public-result-hero">
                <div className="result-hero-badges">
                  <span className="verified-public-badge">
                    <IconCheckCircle />
                    {mode === 'token' ? 'Xác thực qua mã QR hợp lệ' : 'Truy xuất công khai theo mã lô'}
                  </span>
                  <code className="result-batch-code-pill">{state.data.batchCode}</code>
                </div>
                <div className="result-hero-main">
                  <div>
                    <span className="eyebrow">NGUỒN GỐC LÔ {state.data.batchCode}</span>
                    <h1>{state.data.productName}</h1>
                    <p className="result-hero-origin">
                      <IconMapPin /> Xuất xứ: <strong>{state.data.origin}</strong>
                    </p>
                  </div>
                  <div className="result-hero-status-box">
                    <span className="hero-status-caption">Trạng thái hiện tại</span>
                    <BatchStatusBadge status={state.data.currentStatus} size="large" />
                  </div>
                </div>
              </header>

              {/* Responsive 2-column layout: Batch Info FIRST, Timeline SECOND (guaranteed on 360px mobile) */}
              <div className="public-trace-layout">
                {/* 1. THÔNG TIN LÔ */}
                <section className="public-batch-info-card" aria-labelledby="public-batch-info-heading">
                  <div className="public-card-header">
                    <span className="section-index">01</span>
                    <h2 id="public-batch-info-heading">Thông tin lô</h2>
                  </div>

                  <dl className="public-facts-list">
                    <div className="public-fact-row">
                      <dt>Sản phẩm</dt>
                      <dd>{state.data.productName}</dd>
                    </div>
                    <div className="public-fact-row">
                      <dt>Mã lô</dt>
                      <dd>
                        <code className="batch-code-tag">{state.data.batchCode}</code>
                      </dd>
                    </div>
                    <div className="public-fact-row">
                      <dt>Nguồn gốc</dt>
                      <dd>{state.data.origin}</dd>
                    </div>
                    <div className="public-fact-row">
                      <dt>Đơn vị</dt>
                      <dd>{state.data.organizationName}</dd>
                    </div>
                    <div className="public-fact-row">
                      <dt>Trạng thái</dt>
                      <dd>
                        <BatchStatusBadge status={state.data.currentStatus} showDescription />
                      </dd>
                    </div>
                  </dl>

                  {progress && (
                    <div className="public-progress-box">
                      <div className="public-progress-meta">
                        <span>Tiến độ chuỗi cung ứng</span>
                        <strong>{progress.completedSteps}/{progress.totalSteps} bước</strong>
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

                  <div className="public-privacy-note">
                    <IconShield />
                    <small>
                      Chỉ hiển thị thông tin nguồn gốc và sự kiện được phép công khai. Dữ liệu tài khoản cá nhân và nhật ký quản trị được bảo mật.
                    </small>
                  </div>
                </section>

                {/* 2. HÀNH TRÌNH THỰC PHẨM (Timeline công khai từ cũ đến mới) */}
                <section className="public-timeline-card" aria-labelledby="public-timeline-heading">
                  <div className="public-timeline-head">
                    <div>
                      <span className="section-index">02</span>
                      <h2 id="public-timeline-heading">Hành trình thực phẩm</h2>
                      <p className="public-timeline-sub">
                        Biên niên các công đoạn đã được xác thực, sắp xếp theo thứ tự từ cũ đến mới.
                      </p>
                    </div>
                    <span className="timeline-count-pill">
                      {state.data.events.length} mốc ghi nhận
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
                        const stepNum = String(index + 1).padStart(2, '0')

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
                                  <span className="public-step-num">{stepNum}</span>
                                  <h3 className="public-event-title">
                                    {meta.label || ev.eventType}
                                  </h3>
                                  <BatchStatusBadge status={ev.eventType} />
                                  {isLatest && (
                                    <span className="current-pulse-badge">Mới nhất</span>
                                  )}
                                </div>

                                <div className="public-event-time">
                                  <span>
                                    <IconClock /> {formatDateTime(ev.timestamp)}
                                  </span>
                                  {relativeTime && (
                                    <small>{relativeTime}</small>
                                  )}
                                </div>
                              </div>

                              <div className="public-event-facts">
                                <div className="public-event-fact">
                                  <span className="fact-k">
                                    <IconBuilding /> Đơn vị thực hiện
                                  </span>
                                  <strong className="fact-v">{ev.organizationName}</strong>
                                </div>
                                <div className="public-event-fact">
                                  <span className="fact-k">
                                    <IconMapPin /> Địa điểm
                                  </span>
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

      <footer className="public-footer">
        <p>© Food Trace · Cổng truy xuất nguồn gốc thực phẩm công khai</p>
      </footer>
    </div>
  )
}
