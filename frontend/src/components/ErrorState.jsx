import React from 'react'
import '../styles/states.css'

/**
 * Shown when loading failed. Pass `onRetry` to show a retry button.
 *   <ErrorState title="Không tải được video" message={error} onRetry={reload} />
 */
export default function ErrorState({
  title = 'Có lỗi xảy ra',
  message,
  onRetry,
  retryLabel = 'Thử lại',
  compact = false,
}) {
  return (
    <div className={`ui-state ui-state--error${compact ? ' ui-state--compact' : ''}`} role="alert">
      {!compact && (
        <span className="ui-state__icon" aria-hidden="true">
          !
        </span>
      )}
      {title && !compact && <strong className="ui-state__title">{title}</strong>}
      {message && <span className="ui-state__text">{message}</span>}
      {onRetry && (
        <button type="button" className="ui-state__action" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}
