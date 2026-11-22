import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../api.js'
import { BatchStatusBadge } from '../batches/BatchStatusBadge.jsx'
import { productImage, formatQuantity, STATUS_META, BATCH_STATUSES } from '../batches/batchConstants.js'
import { useBatches } from '../hooks/useBatches.js'
import { IconDownload, IconRefresh, IconQr } from '../components/Icons.jsx'

function QrCard({ batch, token }) {
  const canvasRef = useRef(null)
  const [url, setUrl] = useState(null)
  const fallback = `${window.location.origin}/trace/code/${encodeURIComponent(batch.batchCode)}`
  const target = url || batch.qrData || fallback

  useEffect(() => {
    if (!token) return
    let active = true
    api.getBatchQr(token, batch.batchId).then((d) => active && d.qrData && setUrl(d.qrData)).catch(() => {})
    return () => { active = false }
  }, [batch.batchId, token])

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, target, { width: 150, margin: 1, color: { dark: '#2D4316', light: '#FFFFFF' }, errorCorrectionLevel: 'H' }, () => {})
  }, [target])

  function download() {
    const a = document.createElement('a')
    a.download = `QR-${batch.batchCode}.png`
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
  }

  return (
    <article className="qr-sheet-card">
      <canvas ref={canvasRef} />
      <code className="batch-code-tag">{batch.batchCode}</code>
      <strong>{batch.productName}</strong>
      <small>{batch.origin} · {formatQuantity(batch.quantity)}</small>
      <BatchStatusBadge status={batch.currentStatus} />
      <button type="button" className="btn-soft-outline sm with-icon no-print" onClick={download}><IconDownload /> Tải PNG</button>
    </article>
  )
}

export function QrCenterView({ token }) {
  const [tick, setTick] = useState(0)
  const { items, loading, error } = useBatches(token, tick)
  const [status, setStatus] = useState('')
  const list = status ? items.filter((b) => b.currentStatus === status) : items

  return (
    <div className="admin-module-view">
      <div className="page-heading-row">
        <div>
          <h1>Trung tâm tem QR</h1>
          <p>Xem, tải và in hàng loạt tem QR truy xuất của các lô <code>FR-</code> trong phạm vi của bạn.</p>
        </div>
        <div className="heading-actions-group no-print">
          <button type="button" className="button secondary with-icon" onClick={() => setTick((t) => t + 1)}><IconRefresh /> Làm mới</button>
          <button type="button" className="button primary with-icon" onClick={() => window.print()}><IconQr /> In tất cả tem</button>
        </div>
      </div>
      <div className="status-tabs-row no-print" style={{ marginBottom: 16 }}>
        <button type="button" className={`status-tab-chip ${status === '' ? 'active' : ''}`} onClick={() => setStatus('')}>Tất cả ({items.length})</button>
        {BATCH_STATUSES.map((s) => (
          <button key={s} type="button" className={`status-tab-chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{STATUS_META[s].shortLabel}</button>
        ))}
      </div>
      {loading ? <div className="state-block"><div className="spinner-olive" /></div> : error ? <div className="notice error">{error}</div> : (
        <div className="qr-sheet-grid">
          {list.map((b) => <QrCard key={b.batchId} batch={b} token={token} />)}
          {list.length === 0 && <p className="muted-inline">Không có lô nào.</p>}
        </div>
      )}
      <img className="qr-center-thumb" src={productImage('')} alt="" aria-hidden="true" hidden />
    </div>
  )
}
