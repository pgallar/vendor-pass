'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, CalendarClock, ShieldCheck, Database } from 'lucide-react';
import { AuthUserFooter } from '@/components/vendor-pass/auth-user-footer';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { label: 'Proveedores', href: '/vendors', icon: Users, match: (p: string) => p.startsWith('/vendors') && p !== '/vendors/new' },
  { label: 'Vencimientos', href: '/expirations', icon: CalendarClock, match: (p: string) => p.startsWith('/expirations') },
  { label: 'Auditoría Arkiv', href: '/admin/arkiv', icon: Database, match: (p: string) => p.startsWith('/admin/arkiv') },
];

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}

function NavLink({ href, label, icon: Icon, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
      )}
    >
      <Icon size={18} aria-hidden="true" strokeWidth={active ? 2.5 : 1.75} />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col w-60 shrink-0',
        'bg-sidebar text-sidebar-foreground',
        'border-r border-sidebar-border',
        'h-screen sticky top-0 overflow-y-auto',
      )}
      aria-label="Navegacion principal"
    >
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-sidebar-primary-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-accent-foreground leading-none">VendorPass</p>
          <p className="text-[10px] text-sidebar-foreground/60 mt-0.5">Cumplimiento</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4" aria-label="Secciones principales">
        <ul role="list" className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => (
            <li key={item.href}>
              <NavLink href={item.href} label={item.label} icon={item.icon} active={item.match(pathname)} />
            </li>
          ))}
        </ul>
      </nav>

      <AuthUserFooter />
    </aside>
  );
}
