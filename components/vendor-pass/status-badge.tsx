import { cn } from '@/lib/utils'
import type { AnyStatus } from '@/lib/types'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  AlertCircle,
  ShieldX,
} from 'lucide-react'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AnyStatus,
  {
    label: string
    icon: React.ElementType
    bg: string
    text: string
    ring: string
  }
> = {
  vigente: {
    label: 'Vigente',
    icon: CheckCircle2,
    bg: 'bg-[oklch(0.951_0.052_142.5)]',
    text: 'text-[oklch(0.337_0.12_142.5)]',
    ring: 'ring-[oklch(0.527_0.154_142.5)]/30',
  },
  por_vencer: {
    label: 'Por vencer',
    icon: AlertTriangle,
    bg: 'bg-[oklch(0.973_0.077_70.5)]',
    text: 'text-[oklch(0.375_0.105_70.5)]',
    ring: 'ring-[oklch(0.612_0.168_70.5)]/30',
  },
  vencido: {
    label: 'Vencido',
    icon: XCircle,
    bg: 'bg-[oklch(0.936_0.071_27.4)]',
    text: 'text-[oklch(0.354_0.14_27.4)]',
    ring: 'ring-[oklch(0.577_0.245_27.325)]/30',
  },
  ok: {
    label: 'OK',
    icon: ShieldCheck,
    bg: 'bg-[oklch(0.951_0.052_142.5)]',
    text: 'text-[oklch(0.337_0.12_142.5)]',
    ring: 'ring-[oklch(0.527_0.154_142.5)]/30',
  },
  atencion: {
    label: 'Atención',
    icon: AlertCircle,
    bg: 'bg-[oklch(0.973_0.077_70.5)]',
    text: 'text-[oklch(0.375_0.105_70.5)]',
    ring: 'ring-[oklch(0.612_0.168_70.5)]/30',
  },
  bloqueado: {
    label: 'Bloqueado',
    icon: ShieldX,
    bg: 'bg-[oklch(0.936_0.071_27.4)]',
    text: 'text-[oklch(0.354_0.14_27.4)]',
    ring: 'ring-[oklch(0.577_0.245_27.325)]/30',
  },
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  status: AnyStatus
  /** Show only icon, no label text */
  iconOnly?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusBadge({
  status,
  iconOnly = false,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }

  const iconSizes = {
    sm: 12,
    md: 13,
    lg: 15,
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full ring-1',
        cfg.bg,
        cfg.text,
        cfg.ring,
        sizeClasses[size],
        className,
      )}
    >
      <Icon size={iconSizes[size]} aria-hidden="true" />
      {!iconOnly && <span>{cfg.label}</span>}
    </span>
  )
}
