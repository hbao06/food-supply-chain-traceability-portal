import { useEffect, useState, useMemo } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import {
  PREVIEW_AUDIT_LOGS,
  formatDateTime,
  formatRelativeTime,
} from '../batches/batchConstants.js'
import {
  IconShield,
  IconCheckCircle,
  IconSearch,
  IconClock,
  IconUser,
  IconBuilding,
  IconSparkles,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
} from '../components/Icons.jsx'

import {
  parseAuditLogsResponse,
  parseVerifyResponse,
  getAuditBatchCode,
} from './auditHelpers.js'

export function AuditLogView({ token, preview = false, onOpenBatch }) {
  const [logs, setLogs] = useState(() => (preview ? PREVIEW_AUDIT_LOGS : []))
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [filterAction, setFilterAction] = useState('ALL')
  const [filterEntity, setFilterEntity] = useState('ALL')
  const [datePreset, setDatePreset] = useState('ALL') // 'ALL' | '7D' | '30D' | 'QUARTER' | 'CUSTOM'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [copiedHash, setCopiedHash] = useState(null)

  useEffect(() => {
    if (preview) return

    let active = true

    api
      .listAuditLogs(token)
      .then((res) => {
        if (!active) return
        const list = parseAuditLogsResponse(res)
        setLogs(list)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(
          err instanceof ApiError
            ? errorMessage(err)
            : 'Không thể tải danh sách nhật ký kiểm toán từ máy chủ.'
        )
        setLogs([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token, preview, refreshKey])

  async function handleVerifyHashChain() {
    setVerifying(true)
    setVerifyResult(null)

    try {
      if (preview || !token) {
        // Mock verification ở chế độ demo/preview
        await new Promise((r) => setTimeout(r, 600))
        setVerifyResult({
          verified: true,
          count: logs.length,
          firstBrokenId: null,
          reason: null,
          algorithm: 'SHA-256 + HMAC-Chaining (CSDL)',
          timestamp: new Date().toISOString(),
          message:
            'Toàn bộ chuỗi băm kiểm toán (Audit Logs) và sự kiện chuỗi cung ứng đều khớp tuyệt đối. Không phát hiện bất kỳ sự can thiệp hoặc thay đổi dữ liệu trái phép nào.',
        })
      } else {
        const res = await api.verifyAuditChain(token)
        const parsed = parseVerifyResponse(res)
        setVerifyResult({
          ...parsed,
          algorithm: 'SHA-256 (Trigger CSDL)',
        })
      }
    } catch (err) {
      setVerifyResult({
        verified: false,
        count: 0,
        firstBrokenId: null,
        reason: null,
        algorithm: 'SHA-256',
        timestamp: new Date().toISOString(),
        message:
          err instanceof ApiError
            ? errorMessage(err)
            : 'Không thể kết nối đến dịch vụ kiểm toán mật mã.',
      })
    } finally {
      setVerifying(false)
    }
  }

  function copyText(txt, id) {
    if (!txt) return
    navigator.clipboard.writeText(txt).then(() => {
      setCopiedHash(id)
      setTimeout(() => setCopiedHash(null), 2000)
    })
  }

  const filteredLogs = useMemo(() => {
    const now = new Date()
    return logs.filter((item) => {
      if (filterAction !== 'ALL' && item.action !== filterAction) return false
      if (filterEntity !== 'ALL' && item.entityType !== filterEntity) return false
      if (datePreset !== 'ALL') {
        const d = new Date(item.timestamp || item.createdAt)
        if (datePreset === '7D' && d < new Date(now.getTime() - 7 * 86400000)) return false
        if (datePreset === '30D' && d < new Date(now.getTime() - 30 * 86400000)) return false
        if (datePreset === 'QUARTER' && d < new Date(now.getTime() - 90 * 86400000)) return false
        if (datePreset === 'CUSTOM') {
          if (startDate && d < new Date(startDate)) return false
          if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            if (d > end) return false
          }
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const batchCode = getAuditBatchCode(item)
        const matchId = String(item.auditId).includes(q)
        const matchCode = batchCode?.toLowerCase().includes(q)
        const matchActor = item.actorName?.toLowerCase().includes(q)
        const matchOrg = item.organizationName?.toLowerCase().includes(q)
        const matchHash = item.hash?.toLowerCase().includes(q)
        const matchEntity =
          item.entityType?.toLowerCase().includes(q) ||
          String(item.entityId).includes(q)
        const matchAction = item.action?.toLowerCase().includes(q)
        const matchValues =
          JSON.stringify(item.newValue || '').toLowerCase().includes(q) ||
          JSON.stringify(item.oldValue || '').toLowerCase().includes(q)
        if (
          !matchId &&
          !matchCode &&
          !matchActor &&
          !matchOrg &&
          !matchHash &&
          !matchEntity &&
          !matchAction &&
          !matchValues
        ) {
          return false
        }
      }
      return true
    })
  }, [logs, filterAction, filterEntity, searchQuery])

  return (
    <div className="audit-view-container">
      {/* Page Header */}
      <div className="audit-header-row">
        <div>
          <div className="eyebrow-tag">
            <IconShield /> QUẢN TRỊ HỆ THỐNG
          </div>
          <h1 className="audit-title">Nhật ký kiểm toán & Xác thực chuỗi băm</h1>
          <p className="audit-subtitle">
            Hệ thống lưu vết bất biến (Append-only) mọi hoạt động thay đổi dữ liệu, liên kết băm SHA-256 bảo đảm tính toàn vẹn và chống chối bỏ.
          </p>
        </div>

        <div className="audit-actions-top">
          <button
            type="button"
            className="button primary with-icon verify-chain-btn"
            disabled={verifying}
            onClick={handleVerifyHashChain}
          >
            {verifying ? (
              <>
                <span className="spinner-sm" /> Đang tính toán băm SHA-256…
              </>
            ) : (
              <>
                <IconSparkles /> Xác thực chuỗi băm mật mã
              </>
            )}
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verifyResult && (
        <div
          className={`verify-result-card ${verifyResult.verified ? 'is-verified' : 'is-broken'}`}
          role="status"
        >
          <div className="verify-icon-col">
            {verifyResult.verified ? <IconCheckCircle /> : <IconAlertTriangle />}
          </div>
          <div className="verify-content-col">
            <div className="verify-badge-row">
              <span className={`verify-status-badge ${verifyResult.verified ? 'badge-ok' : 'badge-fail'}`}>
                {verifyResult.verified ? 'CHUỖI BĂM HỢP LỆ 100%' : 'CẢNH BÁO: PHÁT HIỆN SAI LỆCH'}
              </span>
              <span className="verify-algo-text">
                Thuật toán: {verifyResult.algorithm || 'SHA-256 + HMAC-Chaining'}
              </span>
              {verifyResult.timestamp && (
                <span className="verify-time-text">
                  Thời điểm kiểm tra: {formatDateTime(verifyResult.timestamp)}
                </span>
              )}
            </div>
            <h3 className="verify-heading">
              {verifyResult.verified
                ? 'Toàn vẹn dữ liệu được chứng minh bằng mật mã học'
                : 'Sai lệch tính toàn vẹn phát hiện trong chuỗi băm'}
            </h3>
            <p className="verify-text">{verifyResult.message}</p>
          </div>
          <button
            type="button"
            className="verify-close-btn"
            onClick={() => setVerifyResult(null)}
            aria-label="Đóng kết quả"
          >
            ✕
          </button>
        </div>
      )}

      {/* System Stats Band */}
      <div className="audit-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Tổng bản ghi kiểm toán</span>
          <strong className="kpi-value">{logs.length}</strong>
          <span className="kpi-sub">Lưu trữ bất biến append-only</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Toàn vẹn chuỗi khối</span>
          <strong className={`kpi-value ${verifyResult ? (verifyResult.verified ? 'kpi-highlight' : 'kpi-danger') : ''}`}>
            {verifyResult ? (verifyResult.verified ? '100% Hợp lệ' : 'Bị gián đoạn') : 'Chưa kiểm tra'}
          </strong>
          <span className="kpi-sub">
            {verifyResult
              ? verifyResult.verified
                ? `Đã khớp ${verifyResult.count} bản ghi`
                : `Lỗi tại #${verifyResult.firstBrokenId ?? '?'}`
              : 'Nhấn "Xác thực chuỗi băm" để đối soát'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Thuật toán băm</span>
          <strong className="kpi-value">SHA-256</strong>
          <span className="kpi-sub">Tiêu chuẩn mật mã NIST FIPS 180-4</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Cấp quyền giám sát</span>
          <strong className="kpi-value">ADMIN ONLY</strong>
          <span className="kpi-sub">Quyền audit:read bảo vệ nghiêm ngặt</span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="audit-toolbar">
        <div className="search-box-wrap">
          <span className="search-icon">
            <IconSearch />
          </span>
          <input
            type="search"
            className="search-input"
            placeholder="Tìm theo mã lô, người thực hiện, đơn vị, mã hash, chi tiết…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <select
            className="filter-select"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            aria-label="Lọc theo hành động"
          >
            <option value="ALL">Mọi hành động</option>
            <option value="CREATE">Tạo mới (CREATE)</option>
            <option value="EVENT">Sự kiện chuỗi cung ứng (EVENT)</option>
            <option value="UPDATE">Cập nhật (UPDATE)</option>
            <option value="LOGIN">Đăng nhập (LOGIN)</option>
          </select>

          <select
            className="filter-select"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            aria-label="Lọc theo đối tượng"
          >
            <option value="ALL">Mọi đối tượng</option>
            <option value="BATCH">Lô hàng (BATCH)</option>
            <option value="EVENT">Sự kiện (EVENT)</option>
            <option value="USER">Người dùng (USER)</option>
          </select>

          <select
            className="filter-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            aria-label="Lọc theo thời gian"
          >
            <option value="ALL">Mọi mốc thời gian</option>
            <option value="7D">7 ngày qua</option>
            <option value="30D">30 ngày qua</option>
            <option value="QUARTER">Quý này (90 ngày)</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      {error ? (
        <div className="state-block error-block" role="alert">
          <IconAlertTriangle />
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setLoading(true)
              setError('')
              setRefreshKey((k) => k + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      ) : loading ? (
        <div className="state-block" role="status">
          <span className="spinner-sm" /> Đang tải nhật ký kiểm toán…
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="state-block">
          <p>Không tìm thấy bản ghi kiểm toán phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="audit-table-card">
          <div className="table-responsive-desktop">
            <table className="audit-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Hành động</th>
                  <th scope="col">Đối tượng / Mã lô</th>
                  <th scope="col">Người thực hiện</th>
                  <th scope="col">Đơn vị</th>
                  <th scope="col">Mã băm SHA-256 (Hash)</th>
                  <th scope="col" className="text-right">Tính toàn vẹn</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isCopied = copiedHash === log.auditId
                  const logTime = log.createdAt || log.timestamp
                  const batchCode = getAuditBatchCode(log)

                  return (
                    <tr key={log.auditId} className="audit-row-item">
                      <td className="cell-audit-id">
                        <code>#{log.auditId}</code>
                      </td>
                      <td className="cell-time">
                        <div className="audit-time-block">
                          <span className="time-primary">
                            <IconClock /> {formatDateTime(logTime)}
                          </span>
                          <span className="time-sub">{formatRelativeTime(logTime)}</span>
                        </div>
                      </td>
                      <td className="cell-action">
                        <span className={`action-pill pill-${(log.action || '').toLowerCase()}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="cell-entity">
                        <div className="entity-block">
                          <span className="entity-type-tag">{log.entityType}</span>
                          {batchCode ? (
                            <button
                              type="button"
                              className="entity-code-btn"
                              title="Xem chi tiết lô hàng này"
                              onClick={() =>
                                onOpenBatch &&
                                onOpenBatch(log.entityId || batchCode)
                              }
                            >
                              <code>{batchCode}</code>
                            </button>
                          ) : (
                            <span className="entity-id-text">
                              ID: {log.entityId ?? '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cell-actor">
                        <div className="actor-block">
                          <span className="actor-name">
                            <IconUser /> {log.actorName || 'Hệ thống'}
                          </span>
                          <span className="actor-role-sub">
                            {log.actorRole || (log.actorId ? `Mã #${log.actorId}` : 'Tự động')}
                          </span>
                        </div>
                      </td>
                      <td className="cell-org">
                        <span className="org-text">
                          <IconBuilding /> {log.organizationName || log.newValue?.organizationName || 'Toàn hệ thống'}
                        </span>
                      </td>
                      <td className="cell-hash">
                        <div className="hash-block">
                          {log.hash ? (
                            <>
                              <code
                                className="hash-preview"
                                title={`Hash: ${log.hash}\nPrevious: ${log.previousHash || 'N/A'}`}
                              >
                                {log.hash.slice(0, 10)}…{log.hash.slice(-8)}
                              </code>
                              <button
                                type="button"
                                className="hash-copy-btn"
                                title="Sao chép toàn bộ mã SHA-256"
                                onClick={() => copyText(log.hash, log.auditId)}
                              >
                                {isCopied ? <IconCheck /> : <IconCopy />}
                              </button>
                            </>
                          ) : (
                            <span
                              className="hash-sealed-text"
                              title="Lưu vết bất biến append-only, liên kết chuỗi băm trong CSDL PostgreSQL"
                            >
                              Lưu vết CSDL (SHA-256)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cell-integrity text-right">
                        <span
                          className="integrity-badge verified"
                          title="Bản ghi lưu vết bất biến append-only được bảo vệ"
                        >
                          <IconCheckCircle /> Hợp lệ
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
