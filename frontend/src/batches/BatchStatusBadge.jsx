import { STATUS_META } from './batchConstants.js'

export function BatchStatusBadge({ status, showDescription = false, size = 'normal' }) {
  const meta = STATUS_META[status] || {
    label: status || 'Không rõ',
    badgeClass: 'status-default',
    description: '',
  }

  return (
    <div className={`batch-status-wrap ${size}`}>
      <span className={`batch-status-pill ${meta.badgeClass}`} title={meta.description}>
        <span className="batch-status-dot" aria-hidden="true" />
        <span className="batch-status-label">{meta.label}</span>
      </span>
      {showDescription && meta.description && (
        <span className="batch-status-desc">{meta.description}</span>
      )}
    </div>
  )
}
