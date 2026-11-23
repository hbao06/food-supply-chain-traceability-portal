import { useEffect, useState, useMemo } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import {
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
  IconRefresh,
} from '../components/Icons.jsx'

import {
  parseAuditLogsPage,
  parseVerifyResponse,
  createVerifyErrorResult,
  getAuditBatchCode,
} from './auditHelpers.js'

export function AuditLogView({ token, onOpenBatch }) {
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [refreshKey, setRefreshKey] = useState(0)

  const [filterAction, setFilterAction] = useState('ALL')
  const [filterEntity, setFilterEntity] = useState('ALL')
  const [datePreset, setDatePreset] = useState('ALL') // 'ALL' | '7D' | '30D' | 'QUARTER'
  const [searchQuery, setSearchQuery] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  const requestKey = `${token || ''}|${filterAction}|${filterEntity}|${page}|${limit}|${refreshKey}`
  const [fetchState, setFetchState] = useState({
    key: '',
    logs: [],
    totalLogs: 0,
    error: '',
  })

  useEffect(() => {
    if (!token) return
    let active = true

    api
      .listAuditLogs(token, {
        action: filterAction !== 'ALL' ? filterAction : undefined,
        entityType: filterEntity !== 'ALL' ? filterEntity : undefined,
        page,
        limit,
      })
      .then((res) => {
        if (!active) return
        const parsed = parseAuditLogsPage(res)
        setFetchState({
          key: requestKey,
          logs: parsed.items,
          totalLogs: parsed.total,
          error: '',
        })
      })
      .catch((err) => {
        if (!active) return
        setFetchState({
          key: requestKey,
          logs: [],
          totalLogs: 0,
          error:
            err instanceof ApiError
              ? errorMessage(err)
              : 'Không thể tải danh sách nhật ký kiểm toán từ máy chủ.',
        })
      })

    return () => {
      active = false
    }
  }, [token, filterAction, filterEntity, page, limit, refreshKey, requestKey])

  const loading = Boolean(token) && fetchState.key !== requestKey
  const logs = useMemo(() => (fetchState.key === requestKey ? fetchState.logs : []), [fetchState, requestKey])
  const totalLogs = fetchState.key === requestKey ? fetchState.totalLogs : 0
  const error = fetchState.key === requestKey ? fetchState.error : ''

  async function handleVerifyHashChain() {
    if (!token) return
    setVerifying(true)
    setVerifyResult(null)

    try {
      const res = await api.verifyAuditChain(token)
      const parsed = parseVerifyResponse(res)
      setVerifyResult({
        ...parsed,
        algorithm: 'SHA-256 (Trigger CSDL)',
      })
    } catch (err) {
      setVerifyResult(
        createVerifyErrorResult(
          err instanceof ApiError
            ? errorMessage(err)
            : 'Không thể kết nối đến dịch vụ kiểm toán mật mã.'
        )
      )
    } finally {
      setVerifying(false)
    }
  }

  const filteredLogs = useMemo(() => {
    const now = new Date()
    return logs.filter((item) => {
      if (datePreset !== 'ALL') {
        const d = new Date(item.createdAt || item.timestamp)
        if (datePreset === '7D' && d < new Date(now.getTime() - 7 * 86400000)) return false
        if (datePreset === '30D' && d < new Date(now.getTime() - 30 * 86400000)) return false
        if (datePreset === 'QUARTER' && d < new Date(now.getTime() - 90 * 86400000)) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const batchCode = getAuditBatchCode(item)
        const matchId = String(item.auditId).includes(q)
        const matchCode = batchCode?.toLowerCase().includes(q)
        const matchActor = item.actorName?.toLowerCase().includes(q)
        const matchOrg = item.organizationName?.toLowerCase().includes(q)
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
          !matchEntity &&
          !matchAction &&
          !matchValues
        ) {
          return false
        }
      }
      return true
    })
  }, [logs, datePreset, searchQuery])

  const verifyStatus = verifyResult
    ? verifyResult.status || (verifyResult.verified ? 'verified' : 'broken')
    : null
  const totalPages = Math.max(1, Math.ceil(totalLogs / limit))

  return (
    <div className="audit-view-container">
      {/* Page Header */}
      <div className="audit-header-row">
        <div>
          <div className="eyebrow-tag">
            <IconShield /> QUẢN TRỊ HỆ THỐNG
          </div>
          <h1 className="audit-title">Nhật ký kiểm toán &amp; Xác thực chuỗi băm</h1>
          <p className="audit-subtitle">
            Hệ thống lưu vết bất biến (chỉ ghi thêm) mọi hoạt động thay đổi dữ liệu, liên kết băm SHA-256 bảo đảm tính toàn vẹn và chống chối bỏ.
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
          className={`verify-result-card ${
            verifyStatus === 'verified'
              ? 'is-verified'
              : verifyStatus === 'error'
              ? 'is-error'
              : 'is-broken'
          }`}
          role="status"
        >
          <div className="verify-icon-col">
            {verifyStatus === 'verified' ? <IconCheckCircle /> : <IconAlertTriangle />}
          </div>
          <div className="verify-content-col">
            <div className="verify-badge-row">
              <span
                className={`verify-status-badge ${
                  verifyStatus === 'verified'
                    ? 'badge-ok'
                    : verifyStatus === 'error'
                    ? 'badge-error'
                    : 'badge-fail'
                }`}
              >
                {verifyStatus === 'verified'
                  ? 'CHUỖI BĂM HỢP LỆ 100%'
                  : verifyStatus === 'error'
                  ? 'KHÔNG THỂ KIỂM TRA'
                  : 'CẢNH BÁO: PHÁT HIỆN SAI LỆCH'}
              </span>
              <span className="verify-algo-text">
                Thuật toán: {verifyResult.algorithm || 'SHA-256'}
              </span>
              {verifyResult.timestamp && (
                <span className="verify-time-text">
                  Thời điểm kiểm tra: {formatDateTime(verifyResult.timestamp)}
                </span>
              )}
            </div>
            <h3 className="verify-heading">
              {verifyStatus === 'verified'
                ? 'Toàn vẹn dữ liệu được chứng minh bằng mật mã học'
                : verifyStatus === 'error'
                ? 'Không thể hoàn tất xác thực chuỗi băm'
                : 'Sai lệch tính toàn vẹn phát hiện trong chuỗi băm'}
            </h3>
            <p className="verify-text">{verifyResult.message}</p>
            {verifyStatus === 'error' && (
              <div className="verify-retry-wrap">
                <button
                  type="button"
                  className="button secondary sm with-icon"
                  disabled={verifying}
                  onClick={handleVerifyHashChain}
                >
                  <IconRefresh /> Thử lại
                </button>
              </div>
            )}
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
          <div className="kpi-label">Tổng bản ghi kiểm toán</div>
          <div className="kpi-value">{totalLogs}</div>
          <div className="kpi-sub">Lưu trữ bất biến chỉ ghi thêm</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Toàn vẹn chuỗi băm</div>
          <div
            className={`kpi-value ${
              verifyStatus === 'verified'
                ? 'kpi-highlight'
                : verifyStatus === 'error'
                ? 'kpi-warning'
                : verifyStatus === 'broken'
                ? 'kpi-danger'
                : ''
            }`}
          >
            {!verifyResult
              ? 'Chưa kiểm tra'
              : verifyStatus === 'verified'
              ? '100% Hợp lệ'
              : verifyStatus === 'error'
              ? 'Lỗi kiểm tra'
              : 'Bị gián đoạn'}
          </div>
          <div className="kpi-sub">
            {!verifyResult
              ? 'Nhấn "Xác thực chuỗi băm" để đối soát'
              : verifyStatus === 'verified'
              ? `Đã khớp ${verifyResult.count} bản ghi`
              : verifyStatus === 'error'
              ? 'Chưa có kết luận — vui lòng thử lại'
              : `Lỗi tại #${verifyResult.firstBrokenId ?? '?'}`}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Thuật toán băm</div>
          <div className="kpi-value">SHA-256</div>
          <div className="kpi-sub">Tiêu chuẩn mật mã NIST FIPS 180-4</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cấp quyền giám sát</div>
          <div className="kpi-value">Chỉ quản trị viên</div>
          <div className="kpi-sub">Quyền giám sát kiểm toán nghiêm ngặt</div>
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
            placeholder="Tìm theo mã lô, người thực hiện, đơn vị, chi tiết…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <select
            className="filter-select"
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value)
              setPage(1)
            }}
            aria-label="Lọc theo hành động"
          >
            <option value="ALL">Mọi hành động</option>
            <option value="CREATE">Tạo mới (CREATE)</option>
            <option value="UPDATE">Cập nhật (UPDATE)</option>
            <option value="REGISTER">Đăng ký (REGISTER)</option>
            <option value="APPROVE">Duyệt tài khoản (APPROVE)</option>
            <option value="ASSIGN_ORGANIZATION">Gán đơn vị (ASSIGN_ORGANIZATION)</option>
            <option value="CHANGE_ROLE">Đổi vai trò (CHANGE_ROLE)</option>
            <option value="LOCK">Khóa tài khoản (LOCK)</option>
            <option value="UNLOCK">Mở khóa (UNLOCK)</option>
            <option value="LOGIN_FAILED">Đăng nhập sai (LOGIN_FAILED)</option>
          </select>

          <select
            className="filter-select"
            value={filterEntity}
            onChange={(e) => {
              setFilterEntity(e.target.value)
              setPage(1)
            }}
            aria-label="Lọc theo đối tượng"
          >
            <option value="ALL">Mọi đối tượng</option>
            <option value="BATCH">Lô hàng (BATCH)</option>
            <option value="EVENT">Sự kiện (EVENT)</option>
            <option value="QR_CODE">Mã QR (QR_CODE)</option>
            <option value="USER">Tài khoản (USER)</option>
            <option value="ORGANIZATION">Đơn vị (ORGANIZATION)</option>
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
            onClick={() => setRefreshKey((k) => k + 1)}
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
                  <th scope="col">Mã băm SHA-256</th>
                  <th scope="col" className="text-right">Tính toàn vẹn</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const logTime = log.createdAt || log.timestamp
                  const batchCode = getAuditBatchCode(log)
                  const targetBatchId =
                    log.entityType === 'BATCH'
                      ? log.entityId
                      : log.newValue?.batchId || log.oldValue?.batchId || null

                  let integrityNode
                  if (!verifyResult || verifyStatus === 'error') {
                    integrityNode = (
                      <span
                        className="integrity-badge pending"
                        title="Nhấn 'Xác thực chuỗi băm mật mã' để kiểm chứng"
                      >
                        Chưa đối soát
                      </span>
                    )
                  } else if (verifyStatus === 'verified') {
                    integrityNode = (
                      <span
                        className="integrity-badge verified"
                        title="Đã đối soát khớp chuỗi băm SHA-256"
                      >
                        <IconCheckCircle /> Hợp lệ
                      </span>
                    )
                  } else if (
                    verifyResult.firstBrokenId != null &&
                    Number(log.auditId) === Number(verifyResult.firstBrokenId)
                  ) {
                    integrityNode = (
                      <span
                        className="integrity-badge broken"
                        title={verifyResult.reason || 'Phát hiện sai lệch chuỗi băm tại bản ghi này'}
                      >
                        <IconAlertTriangle /> Sai lệch
                      </span>
                    )
                  } else if (
                    verifyResult.firstBrokenId != null &&
                    Number(log.auditId) > Number(verifyResult.firstBrokenId)
                  ) {
                    integrityNode = (
                      <span
                        className="integrity-badge affected"
                        title="Bản ghi nằm sau điểm gãy chuỗi băm"
                      >
                        Bị ảnh hưởng
                      </span>
                    )
                  } else {
                    integrityNode = (
                      <span className="integrity-badge verified">
                        <IconCheckCircle /> Hợp lệ
                      </span>
                    )
                  }

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
                          {batchCode && targetBatchId ? (
                            <button
                              type="button"
                              className="entity-code-btn"
                              title="Xem chi tiết lô hàng này"
                              onClick={() => onOpenBatch && onOpenBatch(targetBatchId)}
                            >
                              <code>{batchCode}</code>
                            </button>
                          ) : batchCode ? (
                            <code>{batchCode}</code>
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
                            {log.actorId ? `Mã #${log.actorId}` : 'Tự động'}
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
                          <span
                            className="hash-sealed-text"
                            title="Lưu vết bất biến chỉ ghi thêm, liên kết chuỗi băm SHA-256 trong CSDL PostgreSQL"
                          >
                            Lưu vết CSDL (SHA-256)
                          </span>
                        </div>
                      </td>
                      <td className="cell-integrity text-right">
                        {integrityNode}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalLogs > limit && (
            <div className="pagination-bar">
              <span className="pagination-info">
                Hiển thị <strong>{(page - 1) * limit + 1}</strong> –{' '}
                <strong>{Math.min(page * limit, totalLogs)}</strong> trên tổng số{' '}
                <strong>{totalLogs}</strong> bản ghi
              </span>
              <div className="pagination-pages">
                <button
                  type="button"
                  className="page-nav-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Trước
                </button>
                <span className="page-current-indicator">
                  Trang {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="page-nav-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
