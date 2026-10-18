import React from 'react'
import '../styles/states.css'

/**
 * Shown while data is loading.
 *   <LoadingState label="Đang tải video..." />                      spinner (default)
 *   <LoadingState variant="skeleton" lines={4} skeletonHeight={96} />  grey placeholder blocks
 *   <LoadingState compact label="Đang tải thêm..." />               small, for "load more"
 */
export default function LoadingState({ label = 'Đang tải...', variant = 'spinner', lines = 3, skeletonHeight = 72, compact = false }) {
  if (variant === 'skeleton') {
    return (
      <div className="ui-skeleton-list" role="status" aria-busy="true">
        <span className="ui-visually-hidden">{label}</span>
        {Array.from({ length: lines }, (_, index) => (
          <div className="ui-skeleton" key={index} style={{ height: skeletonHeight }} aria-hidden="true" />
        ))}
      </div>
    )
  }

  return (
    <div className={`ui-state ui-state--loading${compact ? ' ui-state--compact' : ''}`} role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
