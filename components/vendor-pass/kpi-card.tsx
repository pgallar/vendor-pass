import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface KpiCardProps {
  label: string
  value: number | string
  /** Small text shown below the value, e.g. "de 120 proveedores" */
  sublabel?: string
  /** Change indicator text, e.g. "+3 este mes" */
  delta?: string
  /** true = green up arrow, false = red down arrow, undefined = neutral */
  deltaPositive?: boolean
  /** Lucide icon component */
  icon: LucideIcon
  /** Override the icon container color */
  iconColor?: 'indigo' | 'amber' | 'green' | 'red' | 'teal'
  /** Whether the card is in a loading state */
  loading?: boolean
  className?: string
}

// ─── Icon color map ───────────────────────────────────────────────────────────

const iconColorMap = {
  indigo: {
    wrapper: 'bg-[oklch(0.93_0.06_264.1)]',
    icon: 'text-[oklch(0.401_0.168_264.1)]',
  },
  amber: {
    wrapper: 'bg-[oklch(0.973_0.077_70.5)]',
    icon: 'text-[oklch(0.375_0.105_70.5)]',
  },
  green: {
    wrapper: 'bg-[oklch(0.951_0.052_142.5)]',
    icon: 'text-[oklch(0.337_0.12_142.5)]',
  },
  red: {
    wrapper: 'bg-[oklch(0.936_0.071_27.4)]',
    icon: 'text-[oklch(0.354_0.14_27.4)]',
  },
  teal: {
    wrapper: 'bg-[oklch(0.945_0.065_199.9)]',
    icon: 'text-[oklch(0.318_0.1_199.9)]',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sublabel,
  delta,
  deltaPositive,
  icon: Icon,
  iconColor = 'indigo',
  loading = false,
  className,
}: KpiCardProps) {
  const colors = iconColorMap[iconColor]

  return (
    <article
      className={cn(
        'bg-card border border-border rounded-xl p-4 flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground leading-relaxed">{label}</p>
        <div
          className={cn(
            'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
            colors.wrapper,
          )}
          aria-hidden="true"
        >
          <Icon size={18} className={colors.icon} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-16 bg-muted rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
      )}

      {delta && !loading && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            deltaPositive === true && 'text-[oklch(0.337_0.12_142.5)]',
            deltaPositive === false && 'text-[oklch(0.354_0.14_27.4)]',
            deltaPositive === undefined && 'text-muted-foreground',
          )}
        >
          {deltaPositive === true && <TrendingUp size={13} aria-hidden="true" />}
          {deltaPositive === false && <TrendingDown size={13} aria-hidden="true" />}
          {deltaPositive === undefined && <Minus size={13} aria-hidden="true" />}
          <span>{delta}</span>
        </div>
      )}
    </article>
  )
}
