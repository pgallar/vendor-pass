import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck size={18} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">VendorPass</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cumplimiento de proveedores verificable</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/docs" className="hover:text-foreground">
            Documentación
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Acceder
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Crear cuenta
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 VendorPass</p>
      </div>
    </footer>
  );
}
