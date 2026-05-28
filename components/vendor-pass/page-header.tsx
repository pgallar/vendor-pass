import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  /** Main page title */
  title: string
  /** Optional subtitle / description */
  description?: string
  /** If provided, renders a back chevron linking to this href */
  backHref?: string
  /** Label for back link (screen-reader and tooltip) */
  backLabel?: string
  /** Slot for right-side actions (buttons, menus, etc.) */
  actions?: React.ReactNode
  /** Optional breadcrumb trail */
  breadcrumbs?: Array<{ label: string; href?: string }>
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Volver',
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-1 pb-4 border-b border-border',
        className,
      )}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Migas de pan" className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden="true" className="select-none">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Back button */}
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel}
              className={cn(
                'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                'text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
              )}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
          )}

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight truncate text-balance">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  )
}
