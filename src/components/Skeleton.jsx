import PropTypes from 'prop-types'

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div aria-hidden="true" className={`skeleton-shimmer ${className}`} />
}

Skeleton.propTypes = {
  className: PropTypes.string,
}

export function PageSkeleton({ cards = 3, rows = 5 }) {
  return (
    <div className="space-y-6 py-2" role="status" aria-label="Carregando conteúdo">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, idx) => (
          <div key={idx} className="surface-card p-6 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="surface-card p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        {Array.from({ length: rows }).map((_, idx) => (
          <Skeleton key={idx} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

PageSkeleton.propTypes = {
  cards: PropTypes.number,
  rows: PropTypes.number,
}
