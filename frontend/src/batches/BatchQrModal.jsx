import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api, ApiError, errorMessage } from '../api.js'
import { IconMapPin, IconDownload, IconCheck } from '../components/Icons.jsx'

export function BatchQrModal({ batch, token, preview = false, onClose, onOpenTrace }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const fallbackUrl = batch
    ? (batch.qrData && !batch.qrData.includes('PREVIEW')
        ? batch.qrData
        : `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/trace/code/${encodeURIComponent(batch.batchCode)}`)
    : ''

  const [qrState, setQrState] = useState(() => ({
    batchId: batch?.batchId ?? null,
    qrData: (!token || preview) ? fallbackUrl : '',
    error: '',
  }))

  const needsFetch = Boolean(token && !preview && batch?.batchId)
  const qrLoading = needsFetch && qrState.batchId !== batch?.batchId
  const qrData = qrLoading ? '' : (qrState.qrData || fallbackUrl)
  const qrError = qrLoading ? '' : qrState.error

  useEffect(() => {
    if (!batch?.batchId || !token || preview) return
    let active = true
    api.getBatchQr(token, batch.batchId).then((data) => {
      if (active) {
        setQrState({
          batchId: batch.batchId,
          qrData: typeof data.qrData === 'string' && data.qrData ? data.qrData : fallbackUrl,
          error: '',
        })
      }
    }).catch((err) => {
      if (active) {
        setQrState({
          batchId: batch.batchId,
          qrData: fallbackUrl,
          error: fallbackUrl ? '' : (err instanceof ApiError ? errorMessage(err) : 'Không thể tải mã QR của lô hàng.'),
        })
      }
    })
    return () => { active = false }
  }, [token, preview, batch?.batchId, fallbackUrl])

  useEffect(() => {
    if (!canvasRef.current || !qrData) return
    QRCode.toCanvas(
      canvasRef.current,
      qrData,
      {
        width: 248,
        margin: 2,
        color: {
          dark: '#2D4316',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      },
      (error) => {
        if (error) console.error('Lỗi sinh mã QR:', error)
      }
    )
  }, [qrData])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleCopy() {
    if (!qrData) return
    navigator.clipboard.writeText(qrData).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownloadPng() {
    if (!canvasRef.current || !batch) return
    setDownloading(true)
    try {
      const qrCanvas = canvasRef.current
      const cardCanvas = document.createElement('canvas')
      const ctx = cardCanvas.getContext('2d')

      const padding = 28
      const bannerHeight = 86
      cardCanvas.width = qrCanvas.width + padding * 2
      cardCanvas.height = qrCanvas.height + padding * 2 + bannerHeight

      ctx.fillStyle = '#ffffff'
      if (ctx.roundRect) {
        ctx.roundRect(0, 0, cardCanvas.width, cardCanvas.height, 18)
      } else {
        ctx.rect(0, 0, cardCanvas.width, cardCanvas.height)
      }
      ctx.fill()

      ctx.strokeStyle = '#DCE4CC'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.drawImage(qrCanvas, padding, padding)

      ctx.fillStyle = '#6B8824'
      ctx.font = 'bold 14px Quicksand, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('FOOD TRACE · TEM TRUY XUẤT', cardCanvas.width / 2, padding + qrCanvas.height + 28)

      ctx.fillStyle = '#242B24'
      ctx.font = '600 14px "JetBrains Mono", Consolas, monospace'
      ctx.fillText(batch.batchCode, cardCanvas.width / 2, padding + qrCanvas.height + 50)

      ctx.fillStyle = '#606A5E'
      ctx.font = '12px "Be Vietnam Pro", "Segoe UI", sans-serif'
      ctx.fillText(String(batch.productName || '').slice(0, 34), cardCanvas.width / 2, padding + qrCanvas.height + 70)

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

  function handleOpenTraceClick(e) {
    if (!qrData) {
      e.preventDefault()
      return
    }
    if (onOpenTrace) {
      e.preventDefault()
      onOpenTrace(qrData)
      onClose()
    }
  }

  if (!batch) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Mã QR lô ${batch.batchCode}`}>
      <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-kicker">TEM TRUY XUẤT NGUỒN GỐC</span>
            <h3>Mã QR Lô {batch.batchCode}</h3>
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
            {qrLoading && <p role="status">Đang tải mã QR…</p>}
            {qrError && <p role="alert">{qrError}</p>}
            {!qrLoading && !qrError && qrData && <canvas ref={canvasRef} className="qr-canvas" />}
            <div className="qr-batch-pill">
              <code>{batch.batchCode}</code>
            </div>
          </div>

          <div className="qr-batch-info">
            <h4>{batch.productName}</h4>
            {batch.origin && <p className="qr-batch-origin"><IconMapPin /> {batch.origin}</p>}
          </div>

          <div className="qr-url-box">
            <span className="qr-url-text" title={qrData}>{qrData || (qrLoading ? 'Đang tải liên kết…' : qrError)}</span>
            <button
              type="button"
              className="text-button copy-btn"
              onClick={handleCopy}
              disabled={!qrData}
              title="Sao chép liên kết"
            >
              {copied ? <><IconCheck /> Đã chép</> : 'Sao chép'}
            </button>
          </div>

          <p className="qr-notice">
            Quét trực tiếp bằng camera điện thoại hoặc tải ảnh PNG về rồi thử tải lên tại mục <strong>Quét / Tải mã QR</strong> để xem toàn bộ hành trình lô hàng.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="button secondary with-icon"
            onClick={handleDownloadPng}
            disabled={downloading || !qrData}
          >
            <IconDownload /> {downloading ? 'Đang tạo ảnh…' : 'Tải ảnh QR (PNG)'}
          </button>
          <a
            href={qrData || undefined}
            target={onOpenTrace ? undefined : '_blank'}
            rel={onOpenTrace ? undefined : 'noopener noreferrer'}
            className="button primary"
            aria-disabled={!qrData}
            onClick={handleOpenTraceClick}
          >
            Mở trang truy xuất ↗
          </a>
        </div>
      </div>
    </div>
  )
}
