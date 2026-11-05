import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { BatchQrModal } from './BatchQrModal.jsx'
import {
  BATCH_STATUSES,
  PREVIEW_BATCHES,
  STATUS_META,
  formatDateOnly,
  formatQuantity,
} from './batchConstants.js'

export function BatchList({
  token,
  user,
  preview = false,
  onOpenBatch,
  onCreateBatch,
  onEditBatch,
}) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('') // '' = All
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [qrModalBatch, setQrModalBatch] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1) // Reset to page 1 on new search
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Reset page when filterStatus changes
  function handleFilterStatusChange(newStatus) {
    setFilterStatus(newStatus)
    setPage(1)
  }

  // Client-side filtering when in preview mode
  const previewData = useMemo(() => {
    if (!preview) return null
    let items = [...PREVIEW_BATCHES]
    if (filterStatus) {
      items = items.filter((b) => b.currentStatus === filterStatus)
    }
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim()
      items = items.filter(
        (b) =>
          b.batchCode.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q) ||
          b.origin.toLowerCase().includes(q)
      )
    }
    const start = (page - 1) * limit
    return {
      total: items.length,
      items: items.slice(start, start + limit),
    }
  }, [preview, filterStatus, debouncedQuery, page, limit])

  // Fetch batches from API
  useEffect(() => {
    if (preview) return
    let active = true

    api
      .listBatches(token, {
        status: filterStatus || undefined,
        q: debouncedQuery.trim() || undefined,
        page,
        limit,
      })
      .then((data) => {
        if (active) {
          setBatches(data.items || [])
          setTotal(data.total || 0)
          setError('')
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError
              ? errorMessage(err)
              : 'Không thể kết nối để lấy danh sách lô.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token, filterStatus, debouncedQuery, page, limit, refreshKey, preview])

  const displayedBatches = preview ? previewData?.items || [] : batches
  const displayedTotal = preview ? previewData?.total || 0 : total
  const isEffectiveLoading = preview ? false : loading

  // Aggregate stats
  const stats = useMemo(() => {
    const source = preview ? previewData?.items || PREVIEW_BATCHES : batches
    const totalCount = preview ? displayedTotal : total
    const createdCount = source.filter((b) => b.currentStatus === 'CREATED').length
    const activeCount = source.filter((b) =>
      ['TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED'].includes(b.currentStatus)
    ).length
    const shippedCount = source.filter((b) => b.currentStatus === 'SHIPPED').length
    return { totalCount, createdCount, activeCount, shippedCount }
  }, [batches, preview, previewData, displayedTotal, total])

  const totalPages = Math.max(1, Math.ceil(displayedTotal / limit))
  const isFarmer = user?.role === 'FARMER' || preview

  return (
    <div className="batch-list-container">
      {/* Page Heading & Action */}
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">QUẢN LÝ LÔ HÀNG NÔNG SẢN</span>
          <h1>Danh sách lô thực phẩm</h1>
          <p>
            Theo dõi, tra cứu và quản lý vòng đời của từng lô hàng từ nông trại đến người tiêu dùng.
          </p>
        </div>

        {isFarmer && (
          <button
            type="button"
            className="button primary with-icon"
            onClick={onCreateBatch}
          >
            <span className="plus-icon">+</span> Khởi tạo lô mới
          </button>
        )}
      </div>

      {/* Metric Cards Row */}
      <div className="batch-stats-strip">
        <div className="metric-pill-card">
          <div className="metric-value-wrap">
            <span className="metric-number">{stats.totalCount}</span>
            <span className="metric-tag total">Tất cả</span>
          </div>
          <span className="metric-label">Tổng số lô hàng</span>
        </div>

        <div className="metric-pill-card">
          <div className="metric-value-wrap">
            <span className="metric-number emerald">{stats.createdCount}</span>
            <span className="metric-tag emerald">Mới tạo</span>
          </div>
          <span className="metric-label">Đang ở nông trại</span>
        </div>

        <div className="metric-pill-card">
          <div className="metric-value-wrap">
            <span className="metric-number blue">{stats.activeCount}</span>
            <span className="metric-tag blue">Đang xử lý</span>
          </div>
          <span className="metric-label">Vận chuyển & Chế biến</span>
        </div>

        <div className="metric-pill-card">
          <div className="metric-value-wrap">
            <span className="metric-number teal">{stats.shippedCount}</span>
            <span className="metric-tag teal">Xuất kho</span>
          </div>
          <span className="metric-label">Phân phối thị trường</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="table-filter-toolbar">
        {/* Search input */}
        <div className="search-box-wrap">
          <span className="search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo mã lô (BATCH-...) hoặc tên sản phẩm…"
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

        {/* Refresh button */}
        <button
          type="button"
          className="refresh-icon-btn"
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Tải lại danh sách"
          aria-label="Tải lại danh sách"
        >
          🔄
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="status-tabs-row" role="tablist" aria-label="Bộ lọc trạng thái lô">
        <button
          type="button"
          role="tab"
          aria-selected={filterStatus === ''}
          className={`status-tab-chip ${filterStatus === '' ? 'active' : ''}`}
          onClick={() => handleFilterStatusChange('')}
        >
          Tất cả trạng thái
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
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Batches Table / Cards */}
      <div className="batches-card-container">
        {isEffectiveLoading ? (
          <div className="batches-loading-state" role="status">
            <div className="spinner-emerald" />
            <p>Đang tải danh sách lô hàng…</p>
          </div>
        ) : error ? (
          <div className="state-block" role="alert">
            <span className="state-icon">⚠️</span>
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
            <div className="empty-icon-wrap">🌾</div>
            <h3>Không tìm thấy lô thực phẩm nào</h3>
            <p>
              {searchQuery || filterStatus
                ? 'Không có lô nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.'
                : 'Chưa có lô thực phẩm nào được khởi tạo trong hệ thống.'}
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
            {/* Desktop Table View */}
            <div className="table-responsive-desktop">
              <table className="batches-table">
                <thead>
                  <tr>
                    <th scope="col">Mã lô</th>
                    <th scope="col">Sản phẩm</th>
                    <th scope="col">Nơi xuất xứ</th>
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
                          <strong>{batch.productName}</strong>
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
                              title="Xem mã QR"
                              onClick={() => setQrModalBatch(batch)}
                            >
                              📱 QR
                            </button>
                            {canEditRow && (
                              <button
                                type="button"
                                className="action-icon-btn edit-btn"
                                title="Hiệu chỉnh thông tin lô"
                                onClick={() => onEditBatch(batch)}
                              >
                                ✏️ Sửa
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

            {/* Mobile Cards View */}
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
                    <p className="mobile-card-origin">📍 {batch.origin}</p>

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
                        className="button secondary sm"
                        onClick={() => setQrModalBatch(batch)}
                      >
                        📱 QR
                      </button>
                      {canEditRow && (
                        <button
                          type="button"
                          className="button secondary sm"
                          onClick={() => onEditBatch(batch)}
                        >
                          ✏️ Sửa
                        </button>
                      )}
                      <button
                        type="button"
                        className="button primary sm"
                        onClick={() => onOpenBatch(batch.batchId)}
                      >
                        Xem chi tiết →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
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

      {/* Quick QR Modal */}
      {qrModalBatch && (
        <BatchQrModal
          batch={qrModalBatch}
          onClose={() => setQrModalBatch(null)}
        />
      )}
    </div>
  )
}
