'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, CalendarClock, KeyRound, User } from 'lucide-react';

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
  { label: 'Proveedores', href: '/vendors', icon: Users, match: (p: string) => p.startsWith('/vendors') && !p.includes('/new') },
  { label: 'Vencimientos', href: '/expirations', icon: CalendarClock, match: (p: string) => p.startsWith('/expirations') },
  { label: 'Integr.', href: '/integrations', icon: KeyRound, match: (p: string) => p.startsWith('/integrations') },
  { label: 'Perfil', href: '/settings', icon: User, match: (p: string) => p.startsWith('/settings') },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-bottom-nav border-t border-bottom-nav-border',
        'safe-area-pb', // for iOS home indicator
        'md:hidden', // hide on desktop where sidebar is used
      )}
      aria-label="Navegación principal"
    >
      <ul
        role="list"
        className="flex items-stretch h-16"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 h-full w-full',
                  'text-bottom-nav-foreground transition-colors',
                  active && 'text-bottom-nav-active',
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.75}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-[10px] leading-none font-medium',
                    active ? 'text-bottom-nav-active' : 'text-bottom-nav-foreground',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
