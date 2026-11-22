import { useEffect, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { STATUS_META, formatQuantity } from './batchConstants.js'
import { IconQr, IconLock, IconClipboard } from '../components/Icons.jsx'

const PRODUCT_SUGGESTIONS = [
  'Cà phê Arabica Cầu Đất',
  'Cà phê Robusta rang xay',
  'Sầu riêng Ri6 Cái Mơn',
  'Gạo ST25 Hữu Cơ Sóc Trăng',
  'Chè Ô Long Mộc Châu',
  'Thanh Long Ruột Đỏ VietGAP',
]

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
  const [loadedBatch, setLoadedBatch] = useState(initialBatch)
  const [loadingBatch, setLoadingBatch] = useState(Boolean(isEdit && !initialBatch && batchId))
  const [loadError, setLoadError] = useState('')

  const [form, setForm] = useState({
    productName: initialBatch?.productName || '',
    origin: initialBatch?.origin || '',
    quantity: initialBatch?.quantity != null ? String(initialBatch.quantity) : '',
  })

  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  function validate() {
    const next = {}
    const pName = form.productName.trim()
    const pOrigin = form.origin.trim()
    const pQty = Number(form.quantity)

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

    const payload = {
      productName: form.productName.trim(),
      origin: form.origin.trim(),
      quantity: Math.round(Number(form.quantity) * 100) / 100,
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
        <p>Đang tải thông tin lô hàng để chỉnh sửa…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="state-block" role="alert">
        <h2>Không thể tải lô hàng</h2>
        <p>{loadError}</p>
        <button type="button" className="button secondary" onClick={onCancel}>Quay lại</button>
      </div>
    )
  }

  return (
    <div className="batch-form-layout">
      <div className="batch-form-main-card">
        <div className="form-card-header">
          <div className="header-badge-row">
            <span className="modal-kicker">
              {isEdit ? 'HIỆU CHỈNH THÔNG TIN LÔ' : 'KHỞI TẠO LÔ NÔNG SẢN MỚI'}
            </span>
            {isEdit && <BatchStatusBadge status={batch?.currentStatus} />}
          </div>
          <h2>{isEdit ? `Cập nhật lô ${batch?.batchCode}` : 'Khởi tạo lô thực phẩm mới'}</h2>
          <p className="form-card-subtitle">
            {isEdit
              ? 'Chỉnh sửa thông tin xuất xứ hoặc sản lượng khi lô còn ở bước khởi tạo tại nông trại.'
              : 'Hệ thống sẽ tự động cấp mã định danh duy nhất chuẩn FR-YYYY-NNNN và mã QR bảo mật bằng chữ ký số HMAC.'}
          </p>
        </div>

        {!isEditable && (
          <div className="callout-locked-banner" role="alert">
            <span className="locked-icon"><IconLock /></span>
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
                placeholder="Ví dụ: Cà phê Arabica Cầu Đất Thượng Hạng"
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
                  placeholder="Ví dụ: Cầu Đất, Đà Lạt, Lâm Đồng"
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
              disabled={!isEditable || submitting}
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
