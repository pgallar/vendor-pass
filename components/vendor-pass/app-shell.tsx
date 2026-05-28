import * as React from 'react'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { cn } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AppShellProps {
  children: React.ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />

      {/* Page content */}
      <main
        id="main-content"
        className={cn(
          'flex-1 min-w-0',
          // On mobile: padding bottom to clear bottom nav; on desktop: no bottom padding
          'pb-20 md:pb-0',
          className,
        )}
      >
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
