import { useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { formatQuantity } from './batchConstants.js'
import { IconQr, IconLock, IconClipboard } from '../components/Icons.jsx'

const PRODUCT_SUGGESTIONS = [
  'Cà phê Arabica Cầu Đất',
  'Gạo ST25 Hữu Cơ',
  'Chè Ô Long Mộc Châu',
  'Hạt Điều Rang Muối',
  'Thanh Long Ruột Đỏ VietGAP',
  'Bưởi Da Xanh Bến Tre',
]

export function BatchForm({
  mode = 'create', // 'create' | 'update'
  batch = null,
  token,
  user,
  preview = false,
  onSuccess,
  onCancel,
}) {
  const isEdit = mode === 'update'
  const isEditable = !isEdit || batch?.currentStatus === 'CREATED'

  const [form, setForm] = useState({
    productName: batch?.productName || '',
    origin: batch?.origin || '',
    quantity: batch?.quantity != null ? String(batch.quantity) : '',
  })

  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      next.quantity = 'Số lượng tối đa 2 chữ số thập phân (ví dụ: 1250.50).'
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

    if (preview) {
      // Mock update/create in preview mode
      const simulatedResult = {
        batchId: isEdit ? batch.batchId : Math.floor(Math.random() * 900) + 200,
        batchCode: isEdit ? batch.batchCode : `BATCH-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        productName: payload.productName,
        origin: payload.origin,
        quantity: payload.quantity,
        currentStatus: isEdit ? batch.currentStatus : 'CREATED',
        creationDate: isEdit ? batch.creationDate : new Date().toISOString(),
        createdBy: user?.userId || 1,
        organizationId: user?.organizationId || 1,
        organizationName: user?.organizationName || 'Nông trại mẫu',
        qrData: isEdit
          ? batch.qrData
          : `http://localhost:5173/trace/BATCH-2026-PREVIEW.mock-signature`,
      }
      onSuccess(simulatedResult, isEdit ? 'Đã cập nhật thông tin lô hàng.' : 'Đã khởi tạo lô thực phẩm mới thành công!')
      return
    }

    setSubmitting(true)
    try {
      let result
      if (isEdit) {
        result = await api.updateBatch(token, batch.batchId, payload)
      } else {
        result = await api.createBatch(token, payload)
      }
      onSuccess(result, isEdit ? 'Cập nhật thông tin lô thành công!' : 'Khởi tạo lô và sinh mã QR thành công!')
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

  return (
    <div className="batch-form-layout">
      <div className="batch-form-main-card">
        <div className="form-card-header">
          <div className="header-badge-row">
            <span className="eyebrow">
              {isEdit ? 'HIỆU CHỈNH THÔNG TIN LÔ' : 'QUẢN LÝ NGUỒN GỐC NÔNG SẢN'}
            </span>
            {isEdit && <BatchStatusBadge status={batch?.currentStatus} />}
          </div>
          <h2>{isEdit ? `Cập nhật lô ${batch?.batchCode}` : 'Khởi tạo lô thực phẩm mới'}</h2>
          <p className="form-card-subtitle">
            {isEdit
              ? 'Chỉnh sửa thông tin xuất xứ hoặc khối lượng của lô hàng khi còn ở bước khởi tạo nông trại.'
              : 'Ghi nhận lô nông sản mới vào hệ thống chuỗi cung ứng. Hệ thống sẽ tự động cấp mã lô duy nhất và mã QR có chữ ký số.'}
          </p>
        </div>

        {!isEditable && (
          <div className="callout-locked-banner" role="alert">
            <span className="locked-icon"><IconLock /></span>
            <div>
              <strong>Lô hàng này đã bị khóa chỉnh sửa</strong>
              <p>
                Trạng thái hiện tại: <strong>{batch?.currentStatus}</strong>. Theo nguyên tắc minh bạch
                của chuỗi cung ứng thực phẩm, thông tin nguồn gốc chỉ được phép hiệu chỉnh khi lô hàng còn
                ở trạng thái khởi tạo (<code>CREATED</code>). Mọi sự kiện tiếp theo (vận chuyển, chế biến) sẽ bảo lưu
                vĩnh viễn dữ liệu gốc để chống gian lận.
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
          {/* Tên sản phẩm */}
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
            <div className="field-hint-row">
              <span className="char-count">{form.productName.length}/150 ký tự</span>
            </div>

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

          {/* Nguồn gốc xuất xứ */}
          <div className="field">
            <label htmlFor="batch-origin">
              Nguồn gốc / Nông trại canh tác <span className="req-star">*</span>
            </label>
            <div className="input-wrap">
              <input
                id="batch-origin"
                name="origin"
                type="text"
                placeholder="Ví dụ: Xã Trạm Hành, TP. Đà Lạt, Lâm Đồng"
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
            <div className="field-hint-row">
              <span className="char-count">{form.origin.length}/255 ký tự</span>
            </div>
          </div>

          {/* Số lượng */}
          <div className="field">
            <label htmlFor="batch-quantity">
              Số lượng sản phẩm (kg) <span className="req-star">*</span>
            </label>
            <div className="input-wrap with-unit">
              <input
                id="batch-quantity"
                name="quantity"
                type="number"
                step="0.01"
                min="0.01"
                max="9999999999.99"
                placeholder="1000.00"
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
            <span className="field-subtext">
              Nhập số dương, tối đa 2 chữ số thập phân (ví dụ: 500 hoặc 1250.75).
            </span>
          </div>

          {/* Policy banner */}
          <div className="audit-info-banner">
            <div className="audit-info-icon"><IconClipboard /></div>
            <div className="audit-info-text">
              <strong>Quy tắc bất biến & Kiểm toán:</strong>
              <span>
                {isEdit
                  ? 'Mọi thay đổi về tên sản phẩm, nguồn gốc hoặc số lượng sẽ được ghi nhận vào nhật ký kiểm toán (Audit Log) lưu vết người thực hiện.'
                  : 'Sau khi tạo, hệ thống sẽ tự động gán mã định danh duy nhất BATCH-YYYY-NNNN và kích hoạt sự kiện CREATED.'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
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

      {/* Live Preview Card */}
      <aside className="batch-form-preview-aside">
        <div className="preview-sticky-card">
          <div className="preview-card-header">
            <span className="eyebrow">XEM TRƯỚC THẺ LÔ</span>
            <span className="preview-indicator">Trực tiếp</span>
          </div>

          <div className="batch-preview-box">
            <div className="preview-batch-top">
              <span className="preview-batch-code">
                {isEdit ? batch?.batchCode : 'BATCH-2026-XXXX'}
              </span>
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
                <span className="meta-label">Số lượng</span>
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
              <span>Mã QR bảo mật sẽ được hệ thống sinh tự động ngay khi lưu</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
