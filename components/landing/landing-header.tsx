import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function LandingHeader({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck size={20} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-foreground">VendorPass</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Secciones">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Funciones
          </a>
          <a href="#como-funciona" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#arkiv" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Arkiv
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {authenticated ? (
            <Button variant="primary" size="sm" asChild>
              <Link href="/dashboard">Ir al panel</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Acceder</Link>
              </Button>
              <Button variant="primary" size="sm" asChild>
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
