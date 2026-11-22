import { useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { STATUS_META, formatQuantity, resolveBatchImage } from './batchConstants.js'
import { IconQr, IconLock, IconClipboard } from '../components/Icons.jsx'

const PRODUCT_SUGGESTIONS = [
  'Cà phê Arabica Cầu Đất',
  'Cà phê Robusta rang xay',
  'Sầu riêng Ri6 Cái Mơn',
  'Gạo ST25 Hữu Cơ Sóc Trăng',
  'Chè Ô Long Mộc Châu',
  'Thanh Long Ruột Đỏ VietGAP',
]

const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_URL_RE = /^(https?:\/\/[^\s"'<>]+|\/products\/[A-Za-z0-9._-]+|data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)$/

// Nén ảnh tải lên trên trình duyệt về tối đa 960px (JPEG chất lượng 0.82) để lưu gọn và hiển thị nhanh.
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Tệp ảnh không hợp lệ hoặc bị hỏng.'))
      img.onload = () => {
        const maxSide = 960
        let { width, height } = img
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width)
            width = maxSide
          } else {
            width = Math.round((width * maxSide) / height)
            height = maxSide
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, width)
        canvas.height = Math.max(1, height)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(String(reader.result || ''))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/jpeg', 0.82)
        resolve(compressed)
      }
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

export function BatchForm({
  mode = 'create',
  batch: initialBatch = null,
  batchId = null,
  token,
  user,
  onSuccess,
  onCancel,
}) {
  const isEdit = mode === 'update'
  const fileInputRef = useRef(null)
  const [loadedBatch, setLoadedBatch] = useState(initialBatch)
  const [loadingBatch, setLoadingBatch] = useState(Boolean(isEdit && !initialBatch && batchId))
  const [loadError, setLoadError] = useState('')

  const [form, setForm] = useState({
    productName: initialBatch?.productName || '',
    origin: initialBatch?.origin || '',
    quantity: initialBatch?.quantity != null ? String(initialBatch.quantity) : '',
    imageUrl: initialBatch?.imageUrl || '',
  })

  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)

  useEffect(() => {
    if (!isEdit || initialBatch || !batchId || !token) return
    let active = true
    api
      .getBatch(token, batchId)
      .then((data) => {
        if (!active) return
        setLoadedBatch(data)
        setForm({
          productName: data.productName || '',
          origin: data.origin || '',
          quantity: data.quantity != null ? String(data.quantity) : '',
          imageUrl: data.imageUrl || '',
        })
        setLoadError('')
      })
      .catch((err) => {
        if (!active) return
        setLoadError(err instanceof ApiError ? errorMessage(err) : 'Không thể tải thông tin lô cần chỉnh sửa.')
      })
      .finally(() => {
        if (active) setLoadingBatch(false)
      })
    return () => { active = false }
  }, [isEdit, initialBatch, batchId, token])

  const batch = loadedBatch || initialBatch
  const isEditable = !isEdit || batch?.currentStatus === 'CREATED'

  async function handleImageFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, imageUrl: 'Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.' }))
      return
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, imageUrl: 'Ảnh gốc quá lớn (tối đa 10 MB).' }))
      return
    }

    setProcessingImage(true)
    setErrors((prev) => ({ ...prev, imageUrl: '' }))
    try {
      const dataUrl = await compressImageFile(file)
      if (dataUrl.length > 2 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, imageUrl: 'Ảnh sau khi nén vẫn vượt quá 2 MB, vui lòng chọn ảnh nhẹ hơn.' }))
        return
      }
      setForm((prev) => ({ ...prev, imageUrl: dataUrl }))
    } catch (err) {
      setErrors((prev) => ({ ...prev, imageUrl: err.message || 'Không thể xử lý ảnh đã chọn.' }))
    } finally {
      setProcessingImage(false)
    }
  }

  function validate() {
    const next = {}
    const pName = form.productName.trim()
    const pOrigin = form.origin.trim()
    const pQty = Number(form.quantity)
    const pImg = form.imageUrl.trim()

    if (!pName) next.productName = 'Vui lòng nhập tên sản phẩm.'
    else if (pName.length > 150) next.productName = 'Tên sản phẩm tối đa 150 ký tự.'

    if (!pOrigin) next.origin = 'Vui lòng nhập nơi xuất xứ / nông trại.'
    else if (pOrigin.length > 255) next.origin = 'Nguồn gốc tối đa 255 ký tự.'

    if (!form.quantity || form.quantity.trim() === '') {
      next.quantity = 'Vui lòng nhập số lượng sản phẩm.'
    } else if (Number.isNaN(pQty) || !Number.isFinite(pQty)) {
      next.quantity = 'Số lượng phải là một số hợp lệ.'
    } else if (pQty <= 0) {
      next.quantity = 'Số lượng phải lớn hơn 0.'
    } else if (pQty > 9999999999.99) {
      next.quantity = 'Số lượng vượt quá giới hạn tối đa cho phép.'
    } else if (Math.abs(pQty * 100 - Math.round(pQty * 100)) > 1e-6) {
      next.quantity = 'Số lượng tối đa 2 chữ số thập phân (ví dụ: 500.50).'
    }

    if (pImg && !IMAGE_URL_RE.test(pImg)) {
      next.imageUrl = 'Đường dẫn ảnh phải bắt đầu bằng https://, http:// hoặc là ảnh JPG/PNG/WebP tải lên.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGeneralError('')

    if (!isEditable) {
      setGeneralError('Lô hàng đã chuyển sang trạng thái tiếp theo, không thể chỉnh sửa.')
      return
    }

    if (!validate()) return

    const trimmedImage = form.imageUrl.trim()
    const payload = {
      productName: form.productName.trim(),
      origin: form.origin.trim(),
      quantity: Math.round(Number(form.quantity) * 100) / 100,
      ...(isEdit ? { imageUrl: trimmedImage || null } : (trimmedImage ? { imageUrl: trimmedImage } : {})),
    }

    setSubmitting(true)
    try {
      let result
      if (isEdit) {
        result = await api.updateBatch(token, batch.batchId, payload)
      } else {
        result = await api.createBatch(token, payload)
      }
      onSuccess(result, isEdit ? 'Cập nhật thông tin lô thành công!' : `Khởi tạo lô ${result.batchCode} và sinh mã QR thành công!`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && Array.isArray(err.details)) {
          const fieldMap = {}
          for (const d of err.details) {
            if (d.field) fieldMap[d.field] = d.message
          }
          setErrors(fieldMap)
        }
        setGeneralError(errorMessage(err))
      } else {
        setGeneralError('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingBatch) {
    return (
      <div className="state-block" role="status">
        <div className="spinner-olive" />
        <p>Đang tải dữ liệu lô hàng cần chỉnh sửa…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="state-block error-block">
        <p>{loadError}</p>
        <button type="button" className="button secondary" onClick={onCancel}>
          ← Quay lại danh sách
        </button>
      </div>
    )
  }

  const previewImgSrc = resolveBatchImage(form.productName, form.imageUrl)
  const hasCustomImage = Boolean(form.imageUrl.trim())
  const isDataImage = form.imageUrl.trim().startsWith('data:image/')

  return (
    <div className="batch-form-layout">
      <div className="batch-form-main-card">
        <div className="form-card-header">
          <span className="modal-kicker">
            {isEdit ? 'HIỆU CHỈNH LÔ HÀNG' : 'KHỞI TẠO LÔ SẢN PHẨM MỚI'}
          </span>
          <h2>
            {isEdit ? `Cập nhật lô ${batch?.batchCode || ''}` : 'Đăng ký lô thực phẩm mới'}
          </h2>
          <p className="form-card-subtitle">
            {isEdit
              ? 'Chỉ được chỉnh sửa tên sản phẩm, nguồn gốc, sản lượng và ảnh khi lô còn ở trạng thái Khởi tạo.'
              : 'Điền thông tin nông sản và ảnh sản phẩm. Hệ thống tự động sinh mã FR-YYYY-NNNN và tem QR chống giả.'}
          </p>
        </div>

        {!isEditable && (
          <div className="lock-warning-banner" role="alert">
            <div className="lock-warning-icon"><IconLock /></div>
            <div>
              <strong>Lô hàng này đã bị khóa chỉnh sửa</strong>
              <p>
                Trạng thái hiện tại: <strong>{STATUS_META[batch?.currentStatus]?.label || batch?.currentStatus}</strong>. Dữ liệu gốc chỉ có thể sửa khi lô còn ở trạng thái <code>Khởi tạo</code> để bảo toàn tính bất biến.
              </p>
            </div>
          </div>
        )}

        {generalError && (
          <div className="notice error" role="alert">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="batch-productName">
              Tên sản phẩm nông sản <span className="req-star">*</span>
            </label>
            <div className="input-wrap">
              <input
                id="batch-productName"
                name="productName"
                type="text"
                placeholder="Ví dụ: Nhãn xuồng Mỹ Đức"
                value={form.productName}
                maxLength={150}
                disabled={!isEditable || submitting}
                aria-invalid={Boolean(errors.productName)}
                onChange={(e) => {
                  setForm({ ...form, productName: e.target.value })
                  setErrors({ ...errors, productName: '' })
                }}
              />
            </div>
            {errors.productName && <span className="field-error">{errors.productName}</span>}

            {!isEdit && (
              <div className="suggestion-tags">
                <span className="suggestion-label">Gợi ý nhanh:</span>
                {PRODUCT_SUGGESTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => {
                      setForm({ ...form, productName: tag })
                      setErrors({ ...errors, productName: '' })
                    }}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-row-2col">
            <div className="field">
              <label htmlFor="batch-origin">
                Nguồn gốc / Vùng canh tác <span className="req-star">*</span>
              </label>
              <div className="input-wrap">
                <input
                  id="batch-origin"
                  name="origin"
                  type="text"
                  placeholder="Ví dụ: Mỹ Đức, Châu Phú, An Giang"
                  value={form.origin}
                  maxLength={255}
                  disabled={!isEditable || submitting}
                  aria-invalid={Boolean(errors.origin)}
                  onChange={(e) => {
                    setForm({ ...form, origin: e.target.value })
                    setErrors({ ...errors, origin: '' })
                  }}
                />
              </div>
              {errors.origin && <span className="field-error">{errors.origin}</span>}
            </div>

            <div className="field">
              <label htmlFor="batch-quantity">
                Sản lượng (kg) <span className="req-star">*</span>
              </label>
              <div className="input-wrap with-unit">
                <input
                  id="batch-quantity"
                  name="quantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="9999999999.99"
                  placeholder="500.00"
                  value={form.quantity}
                  disabled={!isEditable || submitting}
                  aria-invalid={Boolean(errors.quantity)}
                  onChange={(e) => {
                    setForm({ ...form, quantity: e.target.value })
                    setErrors({ ...errors, quantity: '' })
                  }}
                />
                <span className="input-unit">kg</span>
              </div>
              {errors.quantity && <span className="field-error">{errors.quantity}</span>}
            </div>
          </div>

          {/* Product Image Upload / URL Field */}
          <div className="field">
            <label htmlFor="batch-imageUrl">
              Hình ảnh sản phẩm <span className="field-optional-tag">(Khuyến nghị · Hiển thị đồng bộ trên cổng tra cứu)</span>
            </label>
            <div className="image-upload-box">
              <div className="image-upload-preview">
                <img
                  src={previewImgSrc}
                  alt={form.productName.trim() || 'Ảnh sản phẩm'}
                  onError={(e) => { e.currentTarget.src = '/products/warehouse.jpg' }}
                />
                <span className={`image-source-pill ${hasCustomImage ? 'is-custom' : ''}`}>
                  {hasCustomImage ? 'Ảnh đã chọn' : 'Ảnh mặc định'}
                </span>
              </div>
              <div className="image-upload-controls">
                <div className="image-upload-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={!isEditable || submitting || processingImage}
                    onChange={handleImageFileChange}
                  />
                  <button
                    type="button"
                    className="button secondary sm"
                    disabled={!isEditable || submitting || processingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {processingImage ? 'Đang xử lý ảnh…' : 'Tải ảnh từ máy (JPG/PNG/WebP)'}
                  </button>
                  {hasCustomImage && (
                    <button
                      type="button"
                      className="text-button danger-link"
                      disabled={!isEditable || submitting}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, imageUrl: '' }))
                        setErrors((prev) => ({ ...prev, imageUrl: '' }))
                      }}
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>
                <input
                  id="batch-imageUrl"
                  name="imageUrl"
                  type="url"
                  placeholder="Hoặc dán đường dẫn ảnh công khai (https://...)"
                  value={isDataImage ? '' : form.imageUrl}
                  disabled={!isEditable || submitting}
                  aria-invalid={Boolean(errors.imageUrl)}
                  onChange={(e) => {
                    setForm({ ...form, imageUrl: e.target.value })
                    setErrors({ ...errors, imageUrl: '' })
                  }}
                />
                <small className="image-upload-hint">
                  {isDataImage
                    ? 'Đã tải ảnh từ máy và tự động nén tối ưu. Ảnh này sẽ hiển thị ngay khi khởi tạo và trên cổng tra cứu công khai.'
                    : 'Chọn ảnh chụp nông sản từ máy tính hoặc dán link ảnh trực tiếp. Để trống sẽ dùng ảnh minh họa mặc định.'}
                </small>
              </div>
            </div>
            {errors.imageUrl && <span className="field-error">{errors.imageUrl}</span>}
          </div>

          <div className="audit-info-banner">
            <div className="audit-info-icon"><IconClipboard /></div>
            <div className="audit-info-text">
              <strong>Lưu vết kiểm toán tự động:</strong>{' '}
              <span>
                {isEdit
                  ? 'Thay đổi sẽ được lưu vào chuỗi nhật ký kiểm toán SHA-256.'
                  : 'Hệ thống tự cấp mã định danh FR-YYYY-NNNN, khởi tạo sự kiện CREATED và sinh tem QR chống giả.'}
              </span>
            </div>
          </div>

          <div className="form-action-group">
            <button
              type="button"
              className="button secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!isEditable || submitting || processingImage}
            >
              {submitting
                ? isEdit
                  ? 'Đang lưu…'
                  : 'Đang khởi tạo…'
                : isEdit
                ? 'Lưu thay đổi'
                : 'Tạo lô & Sinh mã QR'}
            </button>
          </div>
        </form>
      </div>

      <aside className="batch-form-preview-aside">
        <div className="preview-sticky-card">
          <div className="preview-card-header">
            <span className="modal-kicker">XEM TRƯỚC TEM LÔ</span>
            <span className="preview-indicator">Trực tiếp</span>
          </div>

          <div className="batch-preview-box">
            <div className="preview-product-media">
              <img
                src={previewImgSrc}
                alt={form.productName.trim() || 'Xem trước sản phẩm'}
                onError={(e) => { e.currentTarget.src = '/products/warehouse.jpg' }}
              />
            </div>

            <div className="preview-batch-top">
              <code className="batch-code-tag">
                {isEdit ? batch?.batchCode : 'FR-2026-XXXX'}
              </code>
              <BatchStatusBadge status={isEdit ? batch?.currentStatus : 'CREATED'} />
            </div>

            <h3 className="preview-product-name">
              {form.productName.trim() || 'Tên sản phẩm của bạn'}
            </h3>

            <div className="preview-meta-list">
              <div className="preview-meta-item">
                <span className="meta-label">Nguồn gốc</span>
                <span className="meta-value">
                  {form.origin.trim() || 'Chưa nhập nguồn gốc'}
                </span>
              </div>
              <div className="preview-meta-item">
                <span className="meta-label">Sản lượng</span>
                <span className="meta-value highlight">
                  {form.quantity && !Number.isNaN(Number(form.quantity))
                    ? formatQuantity(form.quantity)
                    : '0 kg'}
                </span>
              </div>
              <div className="preview-meta-item">
                <span className="meta-label">Đơn vị sở hữu</span>
                <span className="meta-value">
                  {batch?.organizationName || user?.organizationName || 'Đơn vị hiện tại'}
                </span>
              </div>
            </div>

            <div className="preview-qr-placeholder">
              <div className="qr-mini-icon"><IconQr /></div>
              <span>Mã QR bảo mật HMAC sẽ được sinh ngay sau khi lưu</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
