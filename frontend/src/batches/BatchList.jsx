import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { BatchQrModal } from './BatchQrModal.jsx'
import {
  BATCH_STATUSES,
  STATUS_META,
  formatDateOnly,
  formatQuantity,
  resolveBatchImage,
} from './batchConstants.js'
import {
  IconSearch,
  IconRefresh,
  IconQr,
  IconEdit,
  IconPlus,
  IconMapPin,
  IconBatches,
  IconAlertTriangle,
} from '../components/Icons.jsx'

export function BatchList({
  token,
  user,
  onOpenBatch,
  onCreateBatch,
  onEditBatch,
}) {
  const isChainPartner = user?.role === 'PROCESSOR' || user?.role === 'DISTRIBUTOR'
  const [listScope, setListScope] = useState('mine') // 'mine' | 'awaiting'
  const [filterStatus, setFilterStatus] = useState('')
  const [datePreset, setDatePreset] = useState('ALL') // 'ALL' | '7D' | '30D' | 'QUARTER' | 'CUSTOM'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(8)
  const [qrModalBatch, setQrModalBatch] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const requestKey = `${token || ''}|${filterStatus}|${debouncedQuery.trim()}|${isChainPartner ? listScope : 'mine'}|${page}|${limit}|${refreshKey}`
  const [fetchState, setFetchState] = useState({
    key: '',
    items: [],
    total: 0,
    error: '',
  })

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1)
    }, 280)
    return () => clearTimeout(handler)
  }, [searchQuery])

  function handleFilterStatusChange(newStatus) {
    setFilterStatus(newStatus)
    setPage(1)
  }

  function handleScopeChange(nextScope) {
    setListScope(nextScope)
    setFilterStatus('')
    setPage(1)
  }

  const matchDate = useCallback((creationDate) => {
    if (datePreset === 'ALL') return true
    if (!creationDate) return true
    const d = new Date(creationDate)
    const now = new Date()
    if (datePreset === '7D') return d >= new Date(now.getTime() - 7 * 86400000)
    if (datePreset === '30D') return d >= new Date(now.getTime() - 30 * 86400000)
    if (datePreset === 'QUARTER') return d >= new Date(now.getTime() - 90 * 86400000)
    if (datePreset === 'CUSTOM') {
      if (startDate && d < new Date(startDate)) return false
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        if (d > end) return false
      }
      return true
    }
    return true
  }, [datePreset, startDate, endDate])

  useEffect(() => {
    if (!token) return
    let active = true

    api
      .listBatches(token, {
        status: filterStatus || undefined,
        q: debouncedQuery.trim() || undefined,
        scope: isChainPartner ? listScope : undefined,
        page,
        limit,
      })
      .then((data) => {
        if (!active) return
        setFetchState({
          key: requestKey,
          items: data.items || [],
          total: data.total || 0,
          error: '',
        })
      })
      .catch((err) => {
        if (!active) return
        setFetchState({
          key: requestKey,
          items: [],
          total: 0,
          error:
            err instanceof ApiError
              ? errorMessage(err)
              : 'Không thể kết nối để lấy danh sách lô.',
        })
      })

    return () => {
      active = false
    }
  }, [token, filterStatus, debouncedQuery, listScope, isChainPartner, page, limit, refreshKey, requestKey])

  const isEffectiveLoading = Boolean(token) && fetchState.key !== requestKey
  const batches = useMemo(() => (fetchState.key === requestKey ? fetchState.items : []), [fetchState, requestKey])
  const total = fetchState.key === requestKey ? fetchState.total : 0
  const error = fetchState.key === requestKey ? fetchState.error : ''

  const filteredLiveBatches = useMemo(() => {
    return batches.filter((b) => matchDate(b.creationDate || b.createdAt))
  }, [batches, matchDate])

  const displayedBatches = datePreset === 'ALL' ? batches : filteredLiveBatches
  const displayedTotal = datePreset === 'ALL' ? total : filteredLiveBatches.length

  const stats = useMemo(() => {
    const createdCount = batches.filter((b) => b.currentStatus === 'CREATED').length
    const activeCount = batches.filter((b) =>
      ['TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED'].includes(b.currentStatus)
    ).length
    const shippedCount = batches.filter((b) => b.currentStatus === 'SHIPPED').length
    return { totalCount: total, createdCount, activeCount, shippedCount }
  }, [batches, total])

  const totalPages = Math.max(1, Math.ceil(displayedTotal / limit))
  const isFarmer = user?.role === 'FARMER'

  return (
    <div className="batch-list-container">
      {/* Compact Page Header */}
      <div className="page-heading-row">
        <div>
          <h1>Quản lý lô thực phẩm</h1>
          <p>Theo dõi, cấp tem QR chuẩn <code>FR-</code> và quản lý vòng đời lô hàng.</p>
        </div>

        <div className="heading-actions-group">
          {isChainPartner && (
            <div className="scope-segmented" role="tablist" aria-label="Phạm vi lô hiển thị">
              <button
                type="button"
                role="tab"
                aria-selected={listScope === 'mine'}
                className={`scope-seg-btn ${listScope === 'mine' ? 'active' : ''}`}
                onClick={() => handleScopeChange('mine')}
              >
                Lô đã tham gia
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={listScope === 'awaiting'}
                className={`scope-seg-btn ${listScope === 'awaiting' ? 'active' : ''}`}
                onClick={() => handleScopeChange('awaiting')}
              >
                Chờ tiếp nhận
              </button>
            </div>
          )}

          {isFarmer && (
            <button
              type="button"
              className="button primary with-icon"
              onClick={onCreateBatch}
            >
              <IconPlus /> Khởi tạo lô mới
            </button>
          )}
        </div>
      </div>

      {/* Compact Metric Strip */}
      <div className="batch-stats-strip">
        <div className="metric-pill-card">
          <span className="metric-label">Tổng số lô</span>
          <div className="metric-value-wrap">
            <span className="metric-number">{stats.totalCount}</span>
            <span className="metric-tag total">Tất cả</span>
          </div>
        </div>
        <div className="metric-pill-card">
          <span className="metric-label">Tại nông trại</span>
          <div className="metric-value-wrap">
            <span className="metric-number emerald">{stats.createdCount}</span>
            <span className="metric-tag emerald">Khởi tạo</span>
          </div>
        </div>
        <div className="metric-pill-card">
          <span className="metric-label">Trong chuỗi cung ứng</span>
          <div className="metric-value-wrap">
            <span className="metric-number blue">{stats.activeCount}</span>
            <span className="metric-tag blue">Đang xử lý</span>
          </div>
        </div>
        <div className="metric-pill-card">
          <span className="metric-label">Phân phối thị trường</span>
          <div className="metric-value-wrap">
            <span className="metric-number teal">{stats.shippedCount}</span>
            <span className="metric-tag teal">Xuất kho</span>
          </div>
        </div>
      </div>

      {/* Unified Card: Search + Status Pills + Data Table */}
      <div className="batches-card-container">
        <div className="table-controls-header">
          <div className="table-filter-toolbar">
            <div className="search-box-wrap">
              <span className="search-icon" aria-hidden="true">
                <IconSearch />
              </span>
              <input
                type="text"
                className="search-input"
                placeholder="Tìm theo mã lô (FR-2026-...) hoặc tên sản phẩm…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              className="refresh-icon-btn"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Tải lại danh sách"
              aria-label="Tải lại danh sách"
            >
              <IconRefresh />
            </button>
          </div>

          <div className="status-tabs-row" role="tablist" aria-label="Bộ lọc trạng thái lô">
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === ''}
              className={`status-tab-chip ${filterStatus === '' ? 'active' : ''}`}
              onClick={() => handleFilterStatusChange('')}
            >
              Tất cả
            </button>

            {BATCH_STATUSES.map((st) => {
              const meta = STATUS_META[st]
              return (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={filterStatus === st}
                  className={`status-tab-chip ${filterStatus === st ? 'active' : ''}`}
                  onClick={() => handleFilterStatusChange(st)}
                >
                  <span className={`tab-dot ${meta.badgeClass}`} />
                  {meta.shortLabel}
                </button>
              )
            })}
          </div>

          {/* Thanh bộ lọc thời gian */}
          <div className="table-time-filter-bar">
            <span className="time-filter-label">Thời gian:</span>
            <div className="time-chips-group">
              <button
                type="button"
                className={`time-chip-btn ${datePreset === 'ALL' ? 'active' : ''}`}
                onClick={() => setDatePreset('ALL')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`time-chip-btn ${datePreset === '7D' ? 'active' : ''}`}
                onClick={() => setDatePreset('7D')}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                className={`time-chip-btn ${datePreset === '30D' ? 'active' : ''}`}
                onClick={() => setDatePreset('30D')}
              >
                30 ngày qua
              </button>
              <button
                type="button"
                className={`time-chip-btn ${datePreset === 'QUARTER' ? 'active' : ''}`}
                onClick={() => setDatePreset('QUARTER')}
              >
                Quý này
              </button>
              <button
                type="button"
                className={`time-chip-btn ${datePreset === 'CUSTOM' ? 'active' : ''}`}
                onClick={() => setDatePreset('CUSTOM')}
              >
                Tùy chỉnh
              </button>
            </div>

            {datePreset === 'CUSTOM' && (
              <div className="custom-dates-wrap">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="Từ ngày"
                />
                <span className="date-sep">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="Đến ngày"
                />
              </div>
            )}
          </div>
        </div>

        {isEffectiveLoading ? (
          <div className="batches-loading-state" role="status">
            <div className="spinner-olive" />
            <p>Đang tải danh sách lô hàng…</p>
          </div>
        ) : error ? (
          <div className="state-block" role="alert">
            <span className="state-icon"><IconAlertTriangle /></span>
            <h2>Không thể tải dữ liệu</h2>
            <p>{error}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Thử lại
            </button>
          </div>
        ) : displayedBatches.length === 0 ? (
          <div className="batches-empty-state">
            <div className="empty-icon-wrap"><IconBatches /></div>
            <h3>Không có lô thực phẩm phù hợp</h3>
            <p>
              {searchQuery || filterStatus
                ? 'Không tìm thấy lô hàng nào khớp với bộ lọc hiện tại.'
                : listScope === 'awaiting'
                ? 'Hiện chưa có lô hàng nào đang chờ đơn vị bạn tiếp nhận xử lý.'
                : 'Chưa có lô thực phẩm nào trong phạm vi hiển thị của bạn.'}
            </p>
            <div className="empty-actions">
              {(searchQuery || filterStatus) && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterStatus('')
                  }}
                >
                  Xóa bộ lọc
                </button>
              )}
              {isChainPartner && listScope === 'mine' && (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => handleScopeChange('awaiting')}
                >
                  Xem lô chờ tiếp nhận
                </button>
              )}
              {isFarmer && (
                <button
                  type="button"
                  className="button primary"
                  onClick={onCreateBatch}
                >
                  Khởi tạo lô đầu tiên
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="table-responsive-desktop">
              <table className="batches-table">
                <thead>
                  <tr>
                    <th scope="col">Mã lô</th>
                    <th scope="col">Sản phẩm</th>
                    <th scope="col">Xuất xứ</th>
                    <th scope="col" className="text-right">Sản lượng</th>
                    <th scope="col">Ngày tạo</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col" className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBatches.map((batch) => {
                    const canEditRow = isFarmer && batch.currentStatus === 'CREATED'

                    return (
                      <tr
                        key={batch.batchId}
                        className="batch-row-item"
                        onClick={() => onOpenBatch(batch.batchId)}
                      >
                        <td className="cell-batch-code">
                          <code className="batch-code-tag">{batch.batchCode}</code>
                        </td>
                        <td className="cell-product-name">
                          <div className="product-cell-media">
                            <img
                              className="product-cell-thumb"
                              src={resolveBatchImage(batch)}
                              alt={batch.productName}
                              onError={(e) => { e.currentTarget.src = '/products/warehouse.jpg' }}
                            />
                            <strong>{batch.productName}</strong>
                          </div>
                        </td>
                        <td className="cell-origin">
                          <span className="origin-text" title={batch.origin}>
                            {batch.origin}
                          </span>
                        </td>
                        <td className="cell-quantity text-right">
                          <span className="quantity-val">
                            {formatQuantity(batch.quantity)}
                          </span>
                        </td>
                        <td className="cell-date">
                          <span className="date-text">
                            {formatDateOnly(batch.creationDate)}
                          </span>
                        </td>
                        <td className="cell-status">
                          <BatchStatusBadge status={batch.currentStatus} />
                        </td>
                        <td
                          className="cell-actions text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="row-action-buttons">
                            <button
                              type="button"
                              className="action-icon-btn qr-btn"
                              title="Xem và tải mã QR"
                              onClick={() => setQrModalBatch(batch)}
                            >
                              <IconQr /> QR
                            </button>
                            {canEditRow && (
                              <button
                                type="button"
                                className="action-icon-btn edit-btn"
                                title="Hiệu chỉnh thông tin lô"
                                onClick={() => onEditBatch(batch)}
                              >
                                <IconEdit /> Sửa
                              </button>
                            )}
                            <button
                              type="button"
                              className="action-icon-btn view-btn"
                              title="Xem chi tiết lô"
                              onClick={() => onOpenBatch(batch.batchId)}
                            >
                              Chi tiết →
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="batches-cards-mobile">
              {displayedBatches.map((batch) => {
                const canEditRow = isFarmer && batch.currentStatus === 'CREATED'

                return (
                  <div
                    key={batch.batchId}
                    className="mobile-batch-card"
                    onClick={() => onOpenBatch(batch.batchId)}
                  >
                    <div className="mobile-card-top">
                      <code className="batch-code-tag">{batch.batchCode}</code>
                      <BatchStatusBadge status={batch.currentStatus} />
                    </div>

                    <h3 className="mobile-card-title">{batch.productName}</h3>
                    <p className="mobile-card-origin"><IconMapPin /> {batch.origin}</p>

                    <div className="mobile-card-facts">
                      <div>
                        <small>Sản lượng</small>
                        <strong>{formatQuantity(batch.quantity)}</strong>
                      </div>
                      <div>
                        <small>Ngày tạo</small>
                        <span>{formatDateOnly(batch.creationDate)}</span>
                      </div>
                    </div>

                    <div
                      className="mobile-card-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="button secondary sm with-icon"
                        onClick={() => setQrModalBatch(batch)}
                      >
                        <IconQr /> QR
                      </button>
                      {canEditRow && (
                        <button
                          type="button"
                          className="button secondary sm with-icon"
                          onClick={() => onEditBatch(batch)}
                        >
                          <IconEdit /> Sửa
                        </button>
                      )}
                      <button
                        type="button"
                        className="button primary sm"
                        onClick={() => onOpenBatch(batch.batchId)}
                      >
                        Chi tiết →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pagination-bar">
              <span className="pagination-info">
                Hiển thị <strong>{(page - 1) * limit + 1}</strong> –{' '}
                <strong>{Math.min(page * limit, displayedTotal)}</strong> trên tổng số{' '}
                <strong>{displayedTotal}</strong> lô hàng
              </span>

              <div className="pagination-pages">
                <button
                  type="button"
                  className="page-nav-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Trang trước"
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
                  aria-label="Trang tiếp theo"
                >
                  Sau →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {qrModalBatch && (
        <BatchQrModal
          batch={qrModalBatch}
          token={token}
          onClose={() => setQrModalBatch(null)}
        />
      )}
    </div>
  )
}
