import { Suspense, lazy, useCallback, useState } from 'react'
import { api, ApiError } from '../api.js'
import { PREVIEW_BATCHES } from '../batches/batchConstants.js'
import {
  IconAlertTriangle,
  IconInfo,
  IconQr,
  IconRefresh,
  IconSearch,
  IconShield,
  IconSparkles,
} from '../components/Icons.jsx'
import { PublicHeader } from './PublicHeader.jsx'
import {
  buildTraceRoute,
  classifyTraceError,
  getPreviewPublicTrace,
  parseTraceInput,
  sanitizePublicTrace,
} from './traceUtils.js'

const QrScannerPanel = lazy(() =>
  import('./QrScannerPanel.jsx').then((mod) => ({ default: mod.QrScannerPanel }))
)

export function PublicTraceSearch({
  navigate,
  isAuthenticated = false,
  preview = false,
  initialQuery = '',
}) {
  const [activeTab, setActiveTab] = useState('manual') // 'manual' | 'scan'
  const [query, setQuery] = useState(initialQuery)
  const [fieldError, setFieldError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lookupError, setLookupError] = useState(null) // { kind, title, message, retryable, attempted }
  const [lastAttempt, setLastAttempt] = useState(null)

  const executeLookup = useCallback(
    async (parsed, { usePreview = preview } = {}) => {
      setFieldError('')
      setLookupError(null)
      setLastAttempt(parsed)
      setBusy(true)

      try {
        if (usePreview) {
          const previewData = getPreviewPublicTrace({
            mode: parsed.mode,
            identifier: parsed.identifier,
          })
          if (!previewData) {
            setLookupError({
              ...classifyTraceError({ status: 404, code: 'NOT_FOUND' }),
              attempted: parsed.identifier,
            })
            return
          }
          navigate(buildTraceRoute(parsed.mode, parsed.identifier, { preview: true }), {
            prefetchedTrace: previewData,
          })
          return
        }

        const raw =
          parsed.mode === 'token'
            ? await api.traceByToken(parsed.identifier)
            : await api.traceByCode(parsed.identifier)

        const sanitized = sanitizePublicTrace(raw)
        if (!sanitized) {
          throw new ApiError(502, 'INVALID_RESPONSE')
        }

        navigate(buildTraceRoute(parsed.mode, parsed.identifier), {
          prefetchedTrace: sanitized,
        })
      } catch (err) {
        const classified = classifyTraceError(err)
        setLookupError({
          ...classified,
          attempted: parsed.identifier,
        })
      } finally {
        setBusy(false)
      }
    },
    [navigate, preview]
  )

  function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const parsed = parseTraceInput(query)
    if (!parsed.valid) {
      setFieldError(parsed.error)
      setLookupError(null)
      return
    }
    executeLookup(parsed)
  }

  const handleQrDetected = useCallback(
    (decodedText) => {
      const parsed = parseTraceInput(decodedText)
      if (!parsed.valid) {
        setFieldError('')
        setLookupError({
          kind: 'not_found',
          title: 'Không tìm thấy thông tin truy xuất hợp lệ',
          message: 'Nội dung trong mã QR không thuộc hệ thống truy xuất nguồn gốc Food Trace.',
          retryable: false,
          attempted: String(decodedText || '').slice(0, 60),
        })
        return
      }
      setQuery(parsed.identifier)
      setActiveTab('manual')
      executeLookup(parsed)
    },
    [executeLookup]
  )

  return (
    <div className="public-page">
      <PublicHeader navigate={navigate} isAuthenticated={isAuthenticated} preview={preview} />

      <main className="public-main public-search-main">
        <div className="public-container public-search-container">
          {preview && (
            <div className="preview-banner" role="status">
              <strong><IconSparkles /> Chế độ xem trước công khai (Demo)</strong> — Đang tra cứu trên dữ liệu mẫu cục bộ. Các mã hợp lệ gồm <code>BATCH-2026-0001</code> đến <code>BATCH-2026-0006</code> hoặc mã QR tương ứng.
            </div>
          )}

          <section className="public-search-hero">
            <span className="eyebrow">TRUY XUẤT NGUỒN GỐC CÔNG KHAI</span>
            <h1>Tra cứu nguồn gốc</h1>
            <p className="public-lead">
              Xem thông tin lô và hành trình thực phẩm minh bạch từ nông trại đến điểm bán. Không cần đăng nhập.
            </p>
          </section>

          <section className="public-lookup-card" aria-label="Biểu mẫu tra cứu nguồn gốc">
            <div className="lookup-mode-tabs" role="tablist" aria-label="Phương thức tra cứu">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'manual'}
                className={`lookup-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                onClick={() => setActiveTab('manual')}
              >
                <IconSearch /> Nhập mã lô
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'scan'}
                className={`lookup-tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
                onClick={() => setActiveTab('scan')}
              >
                <IconQr /> Quét / Tải mã QR
              </button>
            </div>

            {activeTab === 'manual' ? (
              <form className="public-search-form" onSubmit={handleSubmit} noValidate>
                <label htmlFor="trace-code-input" className="public-field-label">
                  Mã lô trên nhãn sản phẩm
                </label>

                <div className="public-search-row">
                  <div className="public-input-wrap">
                    <span className="search-icon" aria-hidden="true">
                      <IconSearch />
                    </span>
                    <input
                      id="trace-code-input"
                      name="batchCode"
                      type="text"
                      className="public-search-input"
                      placeholder="Ví dụ: BATCH-2026-0001"
                      value={query}
                      disabled={busy}
                      autoComplete="off"
                      spellCheck="false"
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={fieldError ? 'trace-code-error' : 'trace-code-hint'}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        if (fieldError) setFieldError('')
                      }}
                    />
                    {query && !busy && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        aria-label="Xóa mã đang nhập"
                        onClick={() => {
                          setQuery('')
                          setFieldError('')
                          setLookupError(null)
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="button primary public-submit-btn"
                    disabled={busy}
                  >
                    {busy ? 'Đang tra cứu…' : 'Tra cứu'}
                  </button>
                </div>

                {fieldError && (
                  <p id="trace-code-error" className="field-error" role="alert">
                    {fieldError}
                  </p>
                )}

                <p id="trace-code-hint" className="public-search-hint">
                  <IconInfo /> Hoặc dùng camera điện thoại quét QR trên nhãn — liên kết QR sẽ mở trực tiếp kết quả truy xuất. Bạn cũng có thể dán trực tiếp đường dẫn QR vào ô trên.
                </p>
              </form>
            ) : (
              <Suspense
                fallback={
                  <div className="scanner-idle-box" role="status">
                    <p>Đang tải trình quét mã QR…</p>
                  </div>
                }
              >
                <QrScannerPanel onDetected={handleQrDetected} disabled={busy} />
              </Suspense>
            )}

            {/* Status Feedback Area (Not Found / 429 / Network Error) */}
            {lookupError && lookupError.kind === 'not_found' && (
              <div className="trace-inline-not-found" role="alert">
                <div className="not-found-icon-badge" aria-hidden="true">
                  <IconAlertTriangle />
                </div>
                <div className="not-found-body">
                  <span className="not-found-code-tag">404 · KHÔNG TÌM THẤY</span>
                  <h2>{lookupError.title}</h2>
                  <p>{lookupError.message}</p>
                  {lookupError.attempted && (
                    <p className="attempted-ref">
                      Mã vừa kiểm tra: <code>{lookupError.attempted}</code>
                    </p>
                  )}
                  <ul className="not-found-tips">
                    <li>Kiểm tra lại mã lô in trên bao bì (ví dụ định dạng <code>BATCH-2026-0001</code>).</li>
                    <li>Đảm bảo không gõ nhầm ký tự <code>0</code> và chữ <code>O</code>, hoặc thiếu dấu gạch ngang.</li>
                    <li>Nếu quét từ ảnh QR, hãy đảm bảo mã QR không bị mờ, rách hoặc cắt góc.</li>
                  </ul>
                </div>
              </div>
            )}

            {lookupError && lookupError.kind !== 'not_found' && (
              <div className="trace-inline-error-card" role="alert">
                <div className="error-card-head">
                  <IconAlertTriangle />
                  <div>
                    <strong>{lookupError.title}</strong>
                    <p>{lookupError.message}</p>
                  </div>
                </div>
                {lookupError.retryable && lastAttempt && (
                  <button
                    type="button"
                    className="button secondary sm with-icon"
                    disabled={busy}
                    onClick={() => executeLookup(lastAttempt)}
                  >
                    <IconRefresh /> Thử lại
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Trust & Public Guide Strip */}
          <section className="public-trust-grid" aria-label="Hướng dẫn và cam kết minh bạch">
            <article className="trust-card">
              <span className="trust-icon"><IconShield /></span>
              <div>
                <h3>Chữ ký chống giả mạo</h3>
                <p>Mỗi mã QR được gắn chữ ký HMAC từ máy chủ để ngăn chặn làm giả tem nhãn.</p>
              </div>
            </article>
            <article className="trust-card">
              <span className="trust-icon"><IconSearch /></span>
              <div>
                <h3>Tra cứu không cần tài khoản</h3>
                <p>Người tiêu dùng kiểm tra trực tiếp xuất xứ và hành trình lô hàng mọi lúc trên điện thoại.</p>
              </div>
            </article>
          </section>

          {/* Explicit Demo / Preview Helper (never mixed into real API failures) */}
          <section className="public-demo-helper" aria-label="Dữ liệu minh họa xem trước">
            <div className="demo-helper-head">
              <div>
                <strong>Chưa bật Backend hoặc muốn xem thử giao diện nhanh?</strong>
                <span>Chọn một kịch bản bên dưới để mở ở chế độ xem trước (<code>?preview=1</code>):</span>
              </div>
            </div>
            <div className="demo-helper-chips">
              {PREVIEW_BATCHES.slice(0, 3).map((b) => (
                <button
                  key={b.batchId}
                  type="button"
                  className="demo-account-chip"
                  disabled={busy}
                  onClick={() =>
                    navigate(buildTraceRoute('code', b.batchCode, { preview: true }))
                  }
                >
                  {b.batchCode} ({b.currentStatus})
                </button>
              ))}
              <button
                type="button"
                className="demo-account-chip"
                disabled={busy}
                onClick={() =>
                  navigate(buildTraceRoute('code', 'BATCH-2026-0006', { preview: true }))
                }
              >
                BATCH-2026-0006 (Đủ 6 bước)
              </button>
              <button
                type="button"
                className="demo-account-chip demo-chip-warn"
                disabled={busy}
                onClick={() =>
                  navigate(buildTraceRoute('code', 'BATCH-2026-9999', { preview: true }))
                }
              >
                Thử trạng thái 404 (Không tìm thấy)
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="public-footer">
        <p>© Food Trace · Cổng truy xuất nguồn gốc thực phẩm công khai</p>
      </footer>
    </div>
  )
}
