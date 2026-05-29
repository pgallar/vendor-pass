import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl flex items-center gap-2 px-4 py-3">
          <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
          <Link href="/portal" className="text-sm font-semibold text-foreground">
            Portal del proveedor · VendorPass
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
