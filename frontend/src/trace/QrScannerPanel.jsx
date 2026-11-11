import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { IconAlertTriangle, IconQr } from '../components/Icons.jsx'

function IconCamera({ className = 'icon' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconUpload({ className = 'icon' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export function QrScannerPanel({ onDetected, disabled = false }) {
  const [cameraState, setCameraState] = useState('idle') // 'idle' | 'starting' | 'active'
  const [scanError, setScanError] = useState('')
  const [decodingImage, setDecodingImage] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraState('idle')
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop()
        }
      }
    }
  }, [])

  async function startCamera() {
    if (disabled || cameraState !== 'idle') return
    setScanError('')

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScanError(
        'Trình duyệt hoặc kết nối hiện tại không hỗ trợ truy cập camera. Bạn có thể tải ảnh mã QR lên hoặc nhập mã lô trực tiếp.'
      )
      return
    }

    setCameraState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraState('active')
    } catch (err) {
      setCameraState('idle')
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setScanError(
          'Quyền truy cập camera đã bị từ chối. Vui lòng cấp quyền camera cho trình duyệt hoặc tải ảnh mã QR lên.'
        )
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setScanError(
          'Không tìm thấy camera trên thiết bị này. Bạn có thể chọn ảnh mã QR từ máy hoặc nhập mã lô.'
        )
      } else {
        setScanError(
          'Không thể khởi động camera. Hãy thử tải ảnh mã QR lên hoặc dùng camera điện thoại quét trực tiếp.'
        )
      }
    }
  }

  useEffect(() => {
    if (cameraState !== 'active' || !videoRef.current || !streamRef.current) return

    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play().catch(() => {})

    timerRef.current = window.setInterval(() => {
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })
      if (decoded?.data) {
        stopCamera()
        onDetected(decoded.data)
      }
    }, 180)

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [cameraState, onDetected, stopCamera])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setScanError('')
    setDecodingImage(true)

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        const maxSide = 1024
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1))
        const width = Math.max(1, Math.round((img.width || 512) * scale))
        const height = Math.max(1, Math.round((img.height || 512) * scale))

        const canvas = canvasRef.current || document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const decoded = jsQR(imageData.data, width, height, {
          inversionAttempts: 'attemptBoth',
        })

        if (decoded?.data) {
          onDetected(decoded.data)
        } else {
          setScanError(
            'Không nhận diện được mã QR trong ảnh này. Vui lòng chọn ảnh rõ nét hơn hoặc nhập mã lô thủ công.'
          )
        }
      } catch {
        setScanError('Không thể đọc dữ liệu từ tệp ảnh đã chọn.')
      } finally {
        URL.revokeObjectURL(objectUrl)
        setDecodingImage(false)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setDecodingImage(false)
      setScanError('Tệp được chọn không phải là hình ảnh hợp lệ.')
    }

    img.src = objectUrl
  }

  return (
    <div className="qr-scanner-panel">
      <canvas ref={canvasRef} className="sr-only-canvas" aria-hidden="true" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only-input"
        onChange={handleFileChange}
        aria-label="Chọn ảnh chứa mã QR"
      />

      {cameraState === 'active' ? (
        <div className="scanner-viewfinder-wrap">
          <div className="scanner-video-box">
            <video ref={videoRef} playsInline muted className="scanner-video" />
            <div className="scanner-reticle" aria-hidden="true">
              <span className="reticle-corner tl" />
              <span className="reticle-corner tr" />
              <span className="reticle-corner bl" />
              <span className="reticle-corner br" />
              <span className="scanner-laser" />
            </div>
          </div>
          <p className="scanner-live-hint" role="status">
            Đưa mã QR trên tem nhãn sản phẩm vào khung hình…
          </p>
          <div className="scanner-action-row">
            <button
              type="button"
              className="button secondary sm"
              onClick={stopCamera}
            >
              Tắt camera
            </button>
            <button
              type="button"
              className="button secondary sm with-icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || decodingImage}
            >
              <IconUpload /> Chọn ảnh QR
            </button>
          </div>
        </div>
      ) : (
        <div className="scanner-idle-box">
          <div className="scanner-idle-icon" aria-hidden="true">
            <IconQr />
          </div>
          <h3>Quét mã QR trên tem sản phẩm</h3>
          <p>
            Sử dụng camera thiết bị để quét trực tiếp hoặc tải ảnh mã QR (PNG, JPG, SVG) lên để tra cứu tự động.
          </p>
          <div className="scanner-action-row">
            <button
              type="button"
              className="button primary with-icon"
              onClick={startCamera}
              disabled={disabled || cameraState === 'starting'}
            >
              <IconCamera />
              {cameraState === 'starting' ? 'Đang mở camera…' : 'Mở camera quét QR'}
            </button>
            <button
              type="button"
              className="button secondary with-icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || decodingImage}
            >
              <IconUpload />
              {decodingImage ? 'Đang đọc ảnh…' : 'Tải ảnh mã QR'}
            </button>
          </div>
        </div>
      )}

      {scanError && (
        <div className="notice error scanner-error-notice" role="alert">
          <span className="notice-inline-icon"><IconAlertTriangle /></span>
          <span>{scanError}</span>
        </div>
      )}
    </div>
  )
}
