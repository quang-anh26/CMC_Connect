import React from 'react'
import '../styles/states.css'

/**
 * Shown when a list has nothing to display yet.
 *   <EmptyState icon="▶" title="Chưa có video" description="Hãy thử từ khóa khác." />
 * `action` (optional) is any element, e.g. a button that creates the first item.
 */
export default function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <div className={`ui-state ui-state--empty${compact ? ' ui-state--compact' : ''}`} role="status">
      {icon && (
        <span className="ui-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <strong className="ui-state__title">{title}</strong>}
      {description && <span className="ui-state__text">{description}</span>}
      {action}
    </div>
  )
}
