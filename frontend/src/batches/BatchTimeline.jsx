import { useEffect, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import {
  STATUS_META,
  SUPPLY_CHAIN_STEPS,
  BATCH_STATUSES,
  ROLE_LABELS_VI,
  formatDateTime,
  formatRelativeTime,
  canUserAddEvent,
} from './batchConstants.js'
import { BatchStatusBadge } from './BatchStatusBadge.jsx'
import { AddEventModal } from './AddEventModal.jsx'
import {
  IconBuilding,
  IconMapPin,
  IconClock,
  IconPlus,
  IconTimeline,
  IconUser,
  IconSparkles,
  IconAlertTriangle,
  StepIcon,
} from '../components/Icons.jsx'

export function BatchTimeline({
  batch,
  user,
  token,
  onBatchUpdated,
}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!batch?.batchId || !token) return
    let active = true

    api
      .listEvents(token, batch.batchId)
      .then((data) => {
        if (!active) return
        setEvents(Array.isArray(data) ? data : [])
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setEvents([])
        setError(err instanceof ApiError ? errorMessage(err) : 'Không thể tải hành trình sự kiện.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [batch?.batchId, token, reloadTick])

  const currentStatusIndex = BATCH_STATUSES.indexOf(batch?.currentStatus || 'CREATED')
  const completedCount = Math.max(1, currentStatusIndex + 1)
  const progressPercent = Math.min(100, Math.round((completedCount / SUPPLY_CHAIN_STEPS.length) * 100))

  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
  })

  const permission = canUserAddEvent(user, batch)
  const canAdd = permission.allowed

  function handleEventAdded(newEvent, updatedBatch) {
    setEvents((prev) => [...prev, newEvent])
    setShowAddModal(false)
    if (onBatchUpdated) {
      onBatchUpdated(updatedBatch)
    }
  }

  const completedTypes = new Set(events.map((e) => e.eventType))
  const upcomingSteps = SUPPLY_CHAIN_STEPS.filter((s) => !completedTypes.has(s.type))

  return (
    <div className="timeline-section-wrapper">
      <div className="timeline-header-card">
        <div className="timeline-header-top">
          <div className="timeline-headline">
            <span className="eyebrow-accent">
              <IconTimeline /> HÀNH TRÌNH CHUỖI CUNG ỨNG MINH BẠCH
            </span>
            <h2 className="timeline-main-title">Dòng Thời Gian &amp; Biên Niên Sự Kiện</h2>
            <p className="timeline-sub-desc">
              Ghi nhận toàn bộ các mốc kiểm định, vận chuyển và chế biến của lô thực phẩm qua từng mắt xích.
            </p>
          </div>

          <div className="timeline-header-actions">
            <div className="sort-button-group" role="group" aria-label="Sắp xếp sự kiện">
              <button
                type="button"
                className={`sort-pill ${sortOrder === 'asc' ? 'active' : ''}`}
                onClick={() => setSortOrder('asc')}
              >
                Cũ nhất trước
              </button>
              <button
                type="button"
                className={`sort-pill ${sortOrder === 'desc' ? 'active' : ''}`}
                onClick={() => setSortOrder('desc')}
              >
                Mới nhất trước
              </button>
            </div>

            {canAdd && batch?.currentStatus !== 'SHIPPED' && (
              <button
                type="button"
                className="button primary with-icon pulse-on-hover"
                onClick={() => setShowAddModal(true)}
              >
                <IconPlus /> Thêm sự kiện tiếp theo
              </button>
            )}
          </div>
        </div>

        <div className="chain-progress-bar-wrap">
          <div className="chain-progress-info">
            <span className="progress-label">
              Tiến độ hoàn tất: <strong>{completedCount} / {SUPPLY_CHAIN_STEPS.length} giai đoạn</strong> ({progressPercent}%)
            </span>
            <span className="progress-status-current">
              Trạng thái hiện tại: <strong>{STATUS_META[batch?.currentStatus]?.label || batch?.currentStatus}</strong>
            </span>
          </div>
          <div className="chain-progress-track">
            <div
              className="chain-progress-fill"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="state-block timeline-loading-state" role="status">
          <span className="spinner-lg" />
          <p>Đang tải hành trình sự kiện chuỗi cung ứng…</p>
        </div>
      )}

      {error && !loading && (
        <div className="state-block" role="alert">
          <span className="state-icon"><IconAlertTriangle /></span>
          <h3>Không thể tải sự kiện</h3>
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setLoading(true)
              setError('')
              setReloadTick((t) => t + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && sortedEvents.length === 0 && (
        <div className="state-block">
          <p>Chưa có sự kiện nào được ghi nhận cho lô hàng này.</p>
        </div>
      )}

      {!loading && !error && sortedEvents.length > 0 && (
        <div className="timeline-content-layout">
          <div className="timeline-track-container">
            <div className="timeline-stem-line" aria-hidden="true" />

            {sortedEvents.map((event, index) => {
              const meta = STATUS_META[event.eventType] || {}
              const isCurrent = event.eventType === batch?.currentStatus
              const relativeTime = formatRelativeTime(event.timestamp)

              return (
                <article
                  key={event.eventId || index}
                  className={`timeline-milestone-card ${isCurrent ? 'is-current-stage' : ''}`}
                >
                  <div className="milestone-marker">
                    <span className={`marker-circle ${meta.color || 'emerald'}`}>
                      {index + 1}
                    </span>
                    {isCurrent && <span className="marker-pulse-glow" aria-hidden="true" />}
                  </div>

                  <div className="milestone-card-inner">
                    <div className="milestone-top-banner">
                      <div className="milestone-title-col">
                        <div className="stage-tag-row">
                          <BatchStatusBadge status={event.eventType} size="medium" />
                          {isCurrent && (
                            <span className="current-pulse-badge">
                              <IconSparkles /> Mốc mới nhất
                            </span>
                          )}
                        </div>
                        <h3 className="milestone-stage-name">{meta.label}</h3>
                      </div>

                      <div className="milestone-time-col">
                        <div className="time-primary" title={event.timestamp}>
                          <IconClock /> <strong>{formatDateTime(event.timestamp)}</strong>
                        </div>
                        {relativeTime && (
                          <span className="time-relative">{relativeTime}</span>
                        )}
                      </div>
                    </div>

                    <div className="milestone-facts-matrix">
                      <div className="milestone-fact-cell fact-unit">
                        <span className="cell-label">
                          <IconBuilding /> Đơn vị thực hiện
                        </span>
                        <strong className="cell-value">
                          {event.organizationName || 'Đơn vị tham gia chuỗi cung ứng'}
                        </strong>
                        <div className="cell-sub-actor">
                          <span className="actor-badge">
                            {ROLE_LABELS_VI[event.role] || (event.eventType === 'CREATED' ? 'Nông trại' : 'Đối tác')}
                          </span>
                          {event.actorName && (
                            <span className="actor-name">
                              <IconUser /> {event.actorName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="milestone-fact-cell fact-location">
                        <span className="cell-label">
                          <IconMapPin /> Địa điểm xác thực
                        </span>
                        <strong className="cell-value">{event.location || '—'}</strong>
                        <span className="cell-sub-note">Địa điểm ghi nhận tại hiện trường</span>
                      </div>
                    </div>

                    {event.description && (
                      <div className="milestone-description-box">
                        <span className="desc-heading">Ghi chú &amp; Biên bản kiểm tra:</span>
                        <p className="desc-text">{event.description}</p>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {upcomingSteps.length > 0 && (
            <aside className="upcoming-stages-sidebar">
              <div className="upcoming-card">
                <div className="upcoming-header">
                  <span className="eyebrow">DỰ KIẾN TIẾP THEO</span>
                  <h4>Các bước còn lại trong chuỗi</h4>
                  <p>Lô hàng cần tiếp tục hoàn tất các công đoạn sau để đủ điều kiện phân phối:</p>
                </div>

                <div className="upcoming-steps-list">
                  {upcomingSteps.map((step) => {
                    const stepMeta = STATUS_META[step.type]
                    return (
                      <div key={step.type} className="upcoming-step-item">
                        <span className="upcoming-step-icon">
                          <StepIcon type={step.type} />
                        </span>
                        <div className="upcoming-step-info">
                          <strong>{step.label}</strong>
                          <span className="upcoming-step-role">Phụ trách: {ROLE_LABELS_VI[step.role] || step.roleVi}</span>
                          <small className="upcoming-step-desc">{stepMeta?.description}</small>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {canAdd && (
                  <button
                    type="button"
                    className="button secondary wide with-icon"
                    onClick={() => setShowAddModal(true)}
                  >
                    <IconPlus /> Ghi nhận bước kế tiếp
                  </button>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {showAddModal && (
        <AddEventModal
          batch={batch}
          user={user}
          token={token}
          onSuccess={handleEventAdded}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
