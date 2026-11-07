import { useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import {
  STATUS_META,
  SUPPLY_CHAIN_STEPS,
  NEXT_EVENT_MAP,
  EVENT_ROLE_MAP,
  canUserAddEvent,
} from './batchConstants.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import {
  IconMapPin,
  IconClock,
  IconBuilding,
  IconInfo,
  IconCheckCircle,
  IconAlertTriangle,
  StepIcon,
} from '../components/Icons.jsx'

function getCurrentLocalDateTime() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16)
  return localISOTime
}

const LOCATION_PRESETS = {
  TRANSPORTED: [
    'Trạm Logistics Cầu Đất, Lâm Đồng',
    'Bến xe trung chuyển Miền Tây, TP.HCM',
    'Tuyến Cao tốc Dầu Giây - Phan Thiết',
    'Trạm cân Quốc lộ 1A, Bình Thuận',
  ],
  RECEIVED: [
    'Kho tiếp nhận nguyên liệu Tân Tạo, TP.HCM',
    'Nhà máy Sơ chế Nông sản Hòa Phú',
    'Khu tiếp nhận nguyên liệu KCN Sóng Thần',
    'Tổng kho tiếp vận Long Bình, Đồng Nai',
  ],
  PROCESSED: [
    'Xưởng rang xay & chế biến công nghệ cao',
    'Dây chuyền sấy lạnh tiệt trùng ISO 22000',
    'Phòng chế biến tinh chế VietGAP',
    'Khu vực phân loại và làm sạch nông sản',
  ],
  PACKAGED: [
    'Phòng đóng gói vô trùng chuẩn HACCP',
    'Khu vực dán nhãn & mã QR chống giả',
    'Xưởng đóng thùng carton xuất khẩu',
    'Phòng hoàn thiện bao bì màng sinh học',
  ],
  SHIPPED: [
    'Trung tâm Phân phối Bán lẻ Toàn quốc',
    'Cảng Cát Lái, TP.HCM (Hàng xuất khẩu)',
    'Hệ thống Tổng kho Bách Hóa Xanh / WinMart',
    'Cửa hàng Giới thiệu Nông sản An toàn',
  ],
}

export function AddEventModal({
  batch,
  user,
  token,
  preview = false,
  onSuccess,
  onClose,
}) {
  const permission = canUserAddEvent(user, batch)
  const defaultNextType = permission.nextType || NEXT_EVENT_MAP[batch?.currentStatus] || 'TRANSPORTED'

  const [eventType, setEventType] = useState(defaultNextType)
  const [organizationName, setOrganizationName] = useState(
    user?.organizationName ||
      user?.organization?.name ||
      (user?.role === 'DISTRIBUTOR'
        ? 'Công ty Vận tải & Logistics Mekong'
        : user?.role === 'PROCESSOR'
        ? 'Nhà máy Chế biến Thực phẩm Đạt Chuẩn'
        : 'Đơn vị phụ trách chuỗi cung ứng')
  )
  const [location, setLocation] = useState('')
  const [timestamp, setTimestamp] = useState(getCurrentLocalDateTime)
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  if (!batch) return null

  const targetMeta = STATUS_META[eventType] || {}
  const presets = LOCATION_PRESETS[eventType] || []

  function validate() {
    const errs = {}
    if (!eventType) {
      errs.eventType = 'Vui lòng chọn loại sự kiện.'
    }
    if (!location.trim()) {
      errs.location = 'Địa điểm diễn ra sự kiện không được để trống.'
    } else if (location.trim().length > 255) {
      errs.location = 'Địa điểm tối đa 255 ký tự.'
    }
    if (!organizationName.trim()) {
      errs.organizationName = 'Tên đơn vị thực hiện không được để trống.'
    }
    if (description && description.length > 1000) {
      errs.description = 'Mô tả tối đa 1000 ký tự.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    if (!validate()) return

    setSubmitting(true)
    const eventTimeIso = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
    const payload = {
      eventType,
      location: location.trim(),
      description: description.trim() || undefined,
    }

    try {
      let createdEvent = null
      let updatedBatch = null

      if (preview || !token) {
        // Mock / Preview Mode
        await new Promise((r) => setTimeout(r, 400))
        createdEvent = {
          eventId: Date.now(),
          batchId: batch.batchId,
          actorId: user?.userId || 99,
          actorName: user?.name || 'Cán bộ kiểm định',
          organizationName: organizationName.trim(),
          role: user?.role || 'DISTRIBUTOR',
          eventType,
          timestamp: eventTimeIso,
          location: location.trim(),
          description: description.trim() || undefined,
        }
        updatedBatch = {
          ...batch,
          currentStatus: eventType,
        }
      } else {
        // Call Real API
        createdEvent = await api.createEvent(token, batch.batchId, payload)
        // Augment with display fields if backend returns minimal DTO
        if (!createdEvent.organizationName) {
          createdEvent.organizationName = organizationName.trim()
        }
        if (!createdEvent.actorName && user?.name) {
          createdEvent.actorName = user.name
        }
        updatedBatch = {
          ...batch,
          currentStatus: eventType,
        }
      }

      if (onSuccess) {
        onSuccess(createdEvent, updatedBatch)
      }
    } catch (err) {
      console.error('Lỗi ghi nhận sự kiện:', err)
      setSubmitError(
        err instanceof ApiError ? errorMessage(err) : 'Không thể ghi nhận sự kiện. Vui lòng thử lại.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-event-title">
      <div className="modal-content modal-large add-event-dialog">
        <header className="modal-header">
          <div>
            <span className="eyebrow">CHUỖI CUNG ỨNG • BƯỚC TIẾP THEO</span>
            <h2 id="modal-event-title">Ghi nhận Sự kiện Chuỗi Cung ứng</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            ✕
          </button>
        </header>

        <div className="modal-batch-glance">
          <div className="glance-item">
            <span className="glance-label">Mã lô hàng:</span>
            <code className="batch-code-tag">{batch.batchCode}</code>
          </div>
          <div className="glance-item">
            <span className="glance-label">Sản phẩm:</span>
            <strong>{batch.productName}</strong>
          </div>
          <div className="glance-item">
            <span className="glance-label">Trạng thái hiện tại:</span>
            <BatchStatusBadge status={batch.currentStatus} />
          </div>
        </div>

        {submitError && (
          <div className="notice error" role="alert">
            <span className="state-icon"><IconAlertTriangle /></span> {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="add-event-form">
          {/* 1. Chọn loại sự kiện kế tiếp */}
          <div className="form-group">
            <label className="field-label" htmlFor="event-type-select">
              1. Loại sự kiện chuỗi cung ứng <span className="req-star">*</span>
            </label>
            <div className="event-type-selector-card">
              <div className="stage-picker-grid">
                {SUPPLY_CHAIN_STEPS.filter((s) => s.type !== 'CREATED').map((step) => {
                  const isNext = step.type === defaultNextType
                  const isSelected = step.type === eventType
                  const allowedRoles = EVENT_ROLE_MAP[step.type] || []
                  const isRoleMatch = allowedRoles.includes(user?.role) || (!user && preview)

                  return (
                    <button
                      key={step.type}
                      type="button"
                      disabled={!isNext}
                      title={!isNext ? 'Chỉ được ghi nhận sự kiện tuần tự kế tiếp theo quy trình chuỗi cung ứng' : undefined}
                      className={`stage-pick-btn ${isSelected ? 'active' : ''} ${
                        isNext ? 'recommended' : ''
                      } ${!isRoleMatch ? 'role-dimmed' : ''}`}
                      onClick={() => {
                        setEventType(step.type)
                        setErrors((prev) => ({ ...prev, eventType: '' }))
                      }}
                    >
                      <div className="pick-head">
                        <span className="pick-icon">
                          <StepIcon type={step.type} />
                        </span>
                        <strong className="pick-title">{step.label}</strong>
                        {isNext ? <span className="pick-chip-next">Bước kế tiếp</span> : <span className="pick-chip-locked">Đã khóa</span>}
                      </div>
                      <span className="pick-role">Phụ trách: {allowedRoles.join(' / ')}</span>
                    </button>
                  )
                })}
              </div>
              {errors.eventType && <span className="field-error">{errors.eventType}</span>}
              <div className="event-type-hint">
                <span className="hint-icon"><IconInfo /></span>
                <span>
                  Đang ghi nhận giai đoạn: <strong>{targetMeta.label}</strong> — {targetMeta.description}
                </span>
              </div>
            </div>
          </div>

          <div className="form-row-2col">
            {/* 2. Đơn vị thực hiện */}
            <div className="field">
              <label htmlFor="event-org">
                2. Đơn vị phụ trách thực hiện <span className="req-star">*</span>
              </label>
              <div className="input-wrap with-leading-icon">
                <span className="leading-icon"><IconBuilding /></span>
                <input
                  id="event-org"
                  type="text"
                  value={organizationName}
                  onChange={(e) => {
                    setOrganizationName(e.target.value)
                    setErrors((prev) => ({ ...prev, organizationName: '' }))
                  }}
                  placeholder="VD: Công ty Vận tải Mekong Xanh"
                  aria-invalid={Boolean(errors.organizationName)}
                />
              </div>
              {errors.organizationName && (
                <span className="field-error">{errors.organizationName}</span>
              )}
            </div>

            {/* 3. Thời gian diễn ra */}
            <div className="field">
              <label htmlFor="event-timestamp">
                3. Thời gian diễn ra <span className="req-star">*</span>
              </label>
              <div className="input-wrap with-leading-icon">
                <span className="leading-icon"><IconClock /></span>
                <input
                  id="event-timestamp"
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                />
              </div>
              <span className="field-hint">Mặc định là thời điểm hiện tại.</span>
            </div>
          </div>

          {/* 4. Địa điểm diễn ra */}
          <div className="field">
            <label htmlFor="event-location">
              4. Địa điểm cụ thể <span className="req-star">*</span>
            </label>
            <div className="input-wrap with-leading-icon">
              <span className="leading-icon"><IconMapPin /></span>
              <input
                id="event-location"
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  setErrors((prev) => ({ ...prev, location: '' }))
                }}
                placeholder="VD: Trạm Kiểm định Nông sản & Logistics Tân Tạo, Bình Tân, TP.HCM"
                aria-invalid={Boolean(errors.location)}
              />
            </div>
            {errors.location && <span className="field-error">{errors.location}</span>}

            {/* Gợi ý địa điểm nhanh */}
            {presets.length > 0 && (
              <div className="quick-presets-box">
                <span className="presets-title">Gợi ý địa điểm nhanh:</span>
                <div className="preset-chips">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="preset-chip"
                      onClick={() => {
                        setLocation(preset)
                        setErrors((prev) => ({ ...prev, location: '' }))
                      }}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Mô tả chi tiết / Thông số kiểm định */}
          <div className="field">
            <label htmlFor="event-description">
              5. Mô tả chi tiết & Ghi chú nghiệp vụ (Tùy chọn)
            </label>
            <textarea
              id="event-description"
              maxLength={1000}
              rows="3"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setErrors((prev) => ({ ...prev, description: '' }))
              }}
              placeholder="VD: Hàng được vận chuyển bằng container lạnh ở dải nhiệt độ 4-6°C. Biên bản kiểm định chất lượng số 182/KCS-2026 đạt yêu cầu."
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && <span className="field-error">{errors.description}</span>}
          </div>

          {/* Footer Actions */}
          <footer className="modal-footer">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="button primary with-icon"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-sm" /> Đang lưu sự kiện…
                </>
              ) : (
                <>
                  <IconCheckCircle /> Xác nhận ghi nhận sự kiện
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
