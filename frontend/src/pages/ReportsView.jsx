import { useState, useMemo } from 'react'
import { BATCH_STATUSES, STATUS_META, formatQuantity, formatDateOnly } from '../batches/batchConstants.js'
import { useBatches } from '../hooks/useBatches.js'
import { IconDownload, IconSearch } from '../components/Icons.jsx'

// Biểu đồ cột SVG trực quan sản lượng nông sản
function SvgBarChart({ data, height = 240 }) {
  if (!data || data.length === 0) {
    return <div className="empty-chart-notice">Chưa có dữ liệu sản lượng</div>
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const chartWidth = 600
  const chartHeight = height - 40
  const barWidth = Math.min(48, Math.floor((chartWidth - 60) / data.length) - 16)
  const gap = (chartWidth - 60) / data.length

  return (
    <div className="svg-chart-container">
      <svg viewBox={`0 0 ${chartWidth} ${height}`} className="responsive-svg-chart">
        {/* Đường lưới ngang */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartHeight - ratio * (chartHeight - 30) + 10
          return (
            <g key={ratio}>
              <line x1="40" y1={y} x2={chartWidth - 10} y2={y} stroke="#EAE6DE" strokeDasharray="4 4" strokeWidth="1" />
              <text x="32" y={y + 4} fontSize="10" textAnchor="end" fill="#88957F">
                {Math.round(ratio * maxVal)}
              </text>
            </g>
          )
        })}

        {/* Các cột nông sản */}
        {data.map((item, index) => {
          const barH = (item.value / maxVal) * (chartHeight - 30)
          const x = 55 + index * gap + (gap - barWidth) / 2
          const y = chartHeight - barH + 10

          return (
            <g key={item.label} className="chart-bar-group">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 3)}
                rx="6"
                fill="#73932A"
                className="svg-bar-rect"
              >
                <title>{`${item.label}: ${formatQuantity(item.value)}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 6}
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                fill="#2D4316"
              >
                {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}t` : `${item.value}k`}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 25}
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                fill="#4E5D45"
              >
                {item.shortLabel || item.label.slice(0, 8)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const STAGE_COLORS = {
  CREATED: '#A3B875',
  TRANSPORTED: '#3A82C4',
  RECEIVED: '#4A9C2D',
  PROCESSED: '#D97C2B',
  PACKAGED: '#8C56B8',
  SHIPPED: '#237318'
}

function computeDonutSlices(data, total, center, radius) {
  let currentAngle = -90
  return data.map((item) => {
    const angle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle += angle

    const startX = center + radius * Math.cos((Math.PI * startAngle) / 180)
    const startY = center + radius * Math.sin((Math.PI * startAngle) / 180)
    const endX = center + radius * Math.cos((Math.PI * endAngle) / 180)
    const endY = center + radius * Math.sin((Math.PI * endAngle) / 180)
    const largeArc = angle > 180 ? 1 : 0

    const pathData = item.value === 0 ? '' : [
      `M ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`
    ].join(' ')

    return {
      ...item,
      pathData,
      color: STAGE_COLORS[item.statusKey] || '#73932A',
      percent: Math.round((item.value / total) * 100)
    }
  })
}

// Biểu đồ tròn Donut Chart SVG phân bố các giai đoạn chuỗi
function SvgDonutChart({ data, size = 220 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  const radius = 70
  const center = size / 2
  const strokeWidth = 28

  const slices = computeDonutSlices(data, total, center, radius)

  return (
    <div className="donut-chart-wrapper">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#F1EFE9" strokeWidth={strokeWidth} />
        {slices.map((slice) => slice.pathData && (
          <path
            key={slice.label}
            d={slice.pathData}
            fill="none"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          >
            <title>{`${slice.label}: ${slice.value} lô (${slice.percent}%)`}</title>
          </path>
        ))}
        <text x={center} y={center - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1E2B14">
          {total}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fontSize="11" fill="#75856B">
          Tổng số lô
        </text>
      </svg>
      <div className="donut-legend-grid">
        {slices.map((slice) => (
          <div key={slice.label} className="donut-legend-item">
            <span className="legend-color-dot" style={{ background: slice.color }} />
            <span className="legend-name">{slice.label}</span>
            <strong className="legend-count">{slice.value} ({slice.percent}%)</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReportsView({ token, preview }) {
  const { items, loading, error } = useBatches(token, preview)

  // 1. STATE BỘ LỌC THỜI GIAN (TIME FILTER)
  const [timePreset, setTimePreset] = useState('ALL') // 'ALL' | '7D' | '30D' | 'QUARTER' | 'CUSTOM'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // 2. LỌC DỮ LIỆU THEO THỜI GIAN ĐÃ CHỌN
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return []

    const now = new Date()

    return items.filter((batch) => {
      const batchDate = new Date(batch.creationDate || batch.createdAt)

      // Kiểm tra theo preset thời gian
      if (timePreset === '7D') {
        const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (batchDate < past7) return false
      } else if (timePreset === '30D') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        if (batchDate < past30) return false
      } else if (timePreset === 'QUARTER') {
        const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        if (batchDate < past90) return false
      } else if (timePreset === 'CUSTOM') {
        if (startDate && batchDate < new Date(startDate)) return false
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          if (batchDate > end) return false
        }
      }

      // Lọc từ khóa tìm kiếm
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase()
        const matchCode = (batch.batchCode || '').toLowerCase().includes(q)
        const matchName = (batch.productName || '').toLowerCase().includes(q)
        const matchOrigin = (batch.origin || '').toLowerCase().includes(q)
        if (!matchCode && !matchName && !matchOrigin) return false
      }

      return true
    })
  }, [items, timePreset, startDate, endDate, filterSearch])

  // 3. TÍNH TOÁN CÁC CHỈ SỐ BÁO CÁO (METRICS & CHARTS)
  const stats = useMemo(() => {
    const totalBatches = filteredItems.length
    const totalQuantity = filteredItems.reduce((acc, b) => acc + Number(b.quantity || 0), 0)
    const shippedCount = filteredItems.filter((b) => b.currentStatus === 'SHIPPED').length
    const processingCount = filteredItems.filter((b) =>
      ['TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED'].includes(b.currentStatus)
    ).length

    // Phân bố theo giai đoạn (Donut)
    const byStatus = BATCH_STATUSES.map((status) => ({
      statusKey: status,
      label: STATUS_META[status]?.shortLabel || status,
      value: filteredItems.filter((b) => b.currentStatus === status).length
    }))

    // Sản lượng theo từng loại sản phẩm (Bar Chart)
    const prodMap = new Map()
    filteredItems.forEach((b) => {
      const name = b.productName || 'Khác'
      prodMap.set(name, (prodMap.get(name) || 0) + Number(b.quantity || 0))
    })

    const byProduct = [...prodMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => {
        let shortLabel = label
        if (label.includes('Cà phê')) shortLabel = 'Cà phê'
        else if (label.includes('Gạo')) shortLabel = 'Gạo ST25'
        else if (label.includes('Điều')) shortLabel = 'Hạt điều'
        else if (label.includes('Thanh long')) shortLabel = 'Thanh long'
        else if (label.includes('Chè') || label.includes('Trà')) shortLabel = 'Chè Ô Long'
        else if (label.includes('Sầu riêng')) shortLabel = 'Sầu riêng'
        return { label, shortLabel, value }
      })

    return {
      totalBatches,
      totalQuantity,
      shippedCount,
      processingCount,
      completionRate: totalBatches ? Math.round((shippedCount / totalBatches) * 100) : 0,
      byStatus,
      byProduct
    }
  }, [filteredItems])

  // Xuất file CSV báo cáo chuẩn tiếng Việt (UTF-8 BOM)
  const handleExportCsv = () => {
    const headers = ['Mã Lô', 'Sản Phẩm', 'Vùng Canh Tác / Cơ Sở', 'Sản Lượng (kg)', 'Trạng Thái Chuỗi', 'Ngày Khởi Tạo']
    const rows = filteredItems.map((b) => [
      b.batchCode,
      b.productName,
      b.origin || 'Chưa ghi nhận',
      b.quantity || 0,
      STATUS_META[b.currentStatus]?.label || b.currentStatus,
      formatDateOnly(b.creationDate)
    ])

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Bao_Cao_Nong_San_FoodTrace_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="state-block">
        <div className="spinner-olive" />
        <p>Đang tổng hợp báo cáo chuỗi cung ứng...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="notice error" role="alert">
        Không thể tải dữ liệu báo cáo: {error}
      </div>
    )
  }

  return (
    <div className="reports-page-wrapper">
      {/* 1. THANH TIÊU ĐỀ & NÚT XUẤT DỮ LIỆU */}
      <div className="page-heading-row">
        <div>
          <h1 className="page-main-heading">Báo cáo &amp; Thống kê sản lượng</h1>
          <p className="page-sub-desc">
            Phân tích số liệu chuỗi cung ứng, cơ cấu các dòng nông sản và tỷ lệ hoàn tất hành trình 6 bước.
          </p>
        </div>
        <div className="heading-actions-row">
          <button
            type="button"
            className="button primary with-icon"
            onClick={handleExportCsv}
            disabled={filteredItems.length === 0}
          >
            <IconDownload /> Xuất báo cáo CSV (Excel)
          </button>
        </div>
      </div>

      {/* 2. THANH BỘ LỌC THỜI GIAN CHUYÊN NGHIỆP (TIME FILTER TOOLBAR) */}
      <section className="time-filter-toolbar">
        <div className="filter-preset-buttons">
          <span className="filter-bar-label">Khoảng thời gian:</span>
          <button
            type="button"
            className={`preset-btn ${timePreset === 'ALL' ? 'active' : ''}`}
            onClick={() => setTimePreset('ALL')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`preset-btn ${timePreset === '7D' ? 'active' : ''}`}
            onClick={() => setTimePreset('7D')}
          >
            7 ngày qua
          </button>
          <button
            type="button"
            className={`preset-btn ${timePreset === '30D' ? 'active' : ''}`}
            onClick={() => setTimePreset('30D')}
          >
            30 ngày qua
          </button>
          <button
            type="button"
            className={`preset-btn ${timePreset === 'QUARTER' ? 'active' : ''}`}
            onClick={() => setTimePreset('QUARTER')}
          >
            Quý này (90 ngày)
          </button>
          <button
            type="button"
            className={`preset-btn ${timePreset === 'CUSTOM' ? 'active' : ''}`}
            onClick={() => setTimePreset('CUSTOM')}
          >
            Tùy chỉnh ngày
          </button>
        </div>

        {/* Inputs ngày tùy chọn */}
        {timePreset === 'CUSTOM' && (
          <div className="custom-date-inputs">
            <div className="date-input-group">
              <label htmlFor="report-start-date">Từ ngày:</label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="report-end-date">Đến ngày:</label>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Ô tìm kiếm lọc nhanh */}
        <div className="filter-search-box">
          <IconSearch />
          <input
            type="text"
            placeholder="Lọc theo mã FR- hoặc tên sản phẩm..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
      </section>

      {/* 3. 4 THẺ CHỈ SỐ KPI CHÍNH */}
      <div className="dashboard-kpi-grid">
        <div className="kpi-card-metric">
          <span className="metric-tag">TỔNG LÔ TRONG KỲ</span>
          <strong className="metric-num">{stats.totalBatches}</strong>
          <span className="metric-title">Lô nông sản được ghi nhận</span>
        </div>
        <div className="kpi-card-metric highlight-green">
          <span className="metric-tag">TỔNG SẢN LƯỢNG</span>
          <strong className="metric-num">{formatQuantity(stats.totalQuantity)}</strong>
          <span className="metric-title">Khối lượng hàng hóa xuất nhập</span>
        </div>
        <div className="kpi-card-metric highlight-blue">
          <span className="metric-tag">ĐANG LƯU THÔNG</span>
          <strong className="metric-num">{stats.processingCount}</strong>
          <span className="metric-title">Vận chuyển, sơ chế &amp; kho lạnh</span>
        </div>
        <div className="kpi-card-metric highlight-orange">
          <span className="metric-tag">TỶ LỆ HOÀN TẤT</span>
          <strong className="metric-num">{stats.completionRate}%</strong>
          <span className="metric-title">{stats.shippedCount} lô xuất xưởng thị trường</span>
        </div>
      </div>

      {/* 4. BIỂU ĐỒ TRỰC QUAN 2 CỘT (BAR CHART & DONUT CHART) */}
      <div className="reports-visual-charts-row">
        {/* Biểu đồ cột: Sản lượng theo từng nông sản */}
        <div className="chart-card-box">
          <div className="chart-head-info">
            <div>
              <h3 className="chart-title">Sản lượng theo loại nông sản (kg)</h3>
              <p className="chart-subtitle">So sánh tổng khối lượng giữa các đặc sản trong kỳ báo cáo</p>
            </div>
            <span className="chart-tag-badge">Biểu đồ cột</span>
          </div>
          <SvgBarChart data={stats.byProduct} height={250} />
        </div>

        {/* Biểu đồ tròn: Cơ cấu 6 giai đoạn chuỗi cung ứng */}
        <div className="chart-card-box">
          <div className="chart-head-info">
            <div>
              <h3 className="chart-title">Cơ cấu giai đoạn chuỗi cung ứng</h3>
              <p className="chart-subtitle">Tỷ lệ phân bố các lô hàng theo 6 chặng vận hành</p>
            </div>
            <span className="chart-tag-badge">Biểu đồ Donut</span>
          </div>
          <SvgDonutChart data={stats.byStatus} size={200} />
        </div>
      </div>

      {/* 5. BẢNG CHI TIẾT DANH SÁCH LÔ NÔNG SẢN */}
      <section className="batches-card-container">
        <div className="card-section-head">
          <div>
            <h3>Dữ liệu lô hàng chi tiết ({filteredItems.length} kết quả)</h3>
            <p>Dữ liệu đã được áp dụng bộ lọc thời gian và từ khóa tìm kiếm.</p>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="batches-empty-state">
            <p>Không tìm thấy lô hàng nào trong khoảng thời gian đã chọn.</p>
          </div>
        ) : (
          <div className="table-responsive-desktop">
            <table className="batches-table">
              <thead>
                <tr>
                  <th scope="col">Mã lô</th>
                  <th scope="col">Sản phẩm</th>
                  <th scope="col">Vùng trồng / Đơn vị</th>
                  <th scope="col" className="text-right">Sản lượng</th>
                  <th scope="col">Ngày tạo</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((b) => (
                  <tr key={b.batchId || b.batchCode} className="batch-row-item">
                    <td className="cell-batch-code">
                      <code className="batch-code-tag">{b.batchCode}</code>
                    </td>
                    <td className="cell-product-name">
                      <strong>{b.productName}</strong>
                    </td>
                    <td className="cell-origin">
                      <span>{b.origin || b.organizationName || '—'}</span>
                    </td>
                    <td className="cell-quantity text-right">
                      <strong className="quantity-val">{formatQuantity(b.quantity)}</strong>
                    </td>
                    <td className="cell-date">
                      <span>{formatDateOnly(b.creationDate)}</span>
                    </td>
                    <td className="cell-status">
                      <span className={`status-pill status-${(b.currentStatus || '').toLowerCase()}`}>
                        {STATUS_META[b.currentStatus]?.label || b.currentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
