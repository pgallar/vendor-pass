import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Slot for a CTA button or link */
  action?: React.ReactNode
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-14 px-6 text-center',
        className,
      )}
      role="status"
      aria-label={title}
    >
      <div
        className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center"
        aria-hidden="true"
      >
        <Icon size={26} className="text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-1 max-w-xs">
        <p className="text-sm font-semibold text-foreground text-balance">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed text-pretty">
            {description}
          </p>
        )}
      </div>

      {action && <div>{action}</div>}
    </div>
  )
}
