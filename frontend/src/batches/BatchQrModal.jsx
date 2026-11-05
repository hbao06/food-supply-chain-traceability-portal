import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export function BatchQrModal({ batch, onClose }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const traceUrl = batch?.qrData || `${window.location.origin}/trace/${batch?.batchCode || ''}`

  useEffect(() => {
    if (!canvasRef.current || !traceUrl) return

    QRCode.toCanvas(
      canvasRef.current,
      traceUrl,
      {
        width: 260,
        margin: 2,
        color: {
          dark: '#0f3a2c', // Luxurious deep emerald
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (error) => {
        if (error) console.error('Lỗi sinh mã QR:', error)
      }
    )
  }, [traceUrl])

  // Handle ESC key to close
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleCopy() {
    navigator.clipboard.writeText(traceUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownloadPng() {
    if (!canvasRef.current) return
    setDownloading(true)
    try {
      // Create a branded canvas with border and text
      const qrCanvas = canvasRef.current
      const cardCanvas = document.createElement('canvas')
      const ctx = cardCanvas.getContext('2d')

      const padding = 24
      const bannerHeight = 80
      cardCanvas.width = qrCanvas.width + padding * 2
      cardCanvas.height = qrCanvas.height + padding * 2 + bannerHeight

      // Background
      ctx.fillStyle = '#ffffff'
      ctx.roundRect ? ctx.roundRect(0, 0, cardCanvas.width, cardCanvas.height, 16) : ctx.rect(0, 0, cardCanvas.width, cardCanvas.height)
      ctx.fill()

      // Border
      ctx.strokeStyle = '#d6e4dc'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw QR Canvas
      ctx.drawImage(qrCanvas, padding, padding)

      // Header branding line
      ctx.fillStyle = '#155b42'
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('FOOD TRACEABILITY PORTAL', cardCanvas.width / 2, padding + qrCanvas.height + 26)

      // Batch Code
      ctx.fillStyle = '#20332e'
      ctx.font = '600 13px ui-monospace, SFMono-Regular, Consolas, monospace'
      ctx.fillText(batch.batchCode, cardCanvas.width / 2, padding + qrCanvas.height + 48)

      // Product Name
      ctx.fillStyle = '#687b72'
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(batch.productName.slice(0, 32), cardCanvas.width / 2, padding + qrCanvas.height + 68)

      const link = document.createElement('a')
      link.download = `QR-${batch.batchCode}.png`
      link.href = cardCanvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Lỗi khi tải ảnh QR:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (!batch) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">TEM TRUY XUẤT NGUỒN GỐC</span>
            <h3>Mã QR Lô Hàng</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        <div className="qr-modal-body">
          <div className="qr-canvas-container">
            <canvas ref={canvasRef} className="qr-canvas" />
            <div className="qr-batch-pill">
              <code>{batch.batchCode}</code>
            </div>
          </div>

          <div className="qr-batch-info">
            <h4>{batch.productName}</h4>
            <p className="qr-batch-origin">📍 {batch.origin}</p>
          </div>

          <div className="qr-url-box">
            <span className="qr-url-text">{traceUrl}</span>
            <button
              type="button"
              className="text-button copy-btn"
              onClick={handleCopy}
              title="Sao chép liên kết"
            >
              {copied ? '✓ Đã sao chép' : 'Sao chép'}
            </button>
          </div>

          <p className="qr-notice">
            Mã QR được mã hóa chữ ký số HMAC bảo mật. Người tiêu dùng và đối tác có thể quét trực tiếp
            bằng camera điện thoại để xác thực chuỗi cung ứng.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            onClick={handleDownloadPng}
            disabled={downloading}
          >
            {downloading ? 'Đang chuẩn bị…' : '📥 Tải ảnh QR (PNG)'}
          </button>
          <a
            href={traceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button primary"
          >
            Mở trang truy xuất ↗
          </a>
        </div>
      </div>
    </div>
  )
}
