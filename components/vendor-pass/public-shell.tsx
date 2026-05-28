import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">VendorPass</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Verificación pública</p>
          </div>
          <Link href="/login" className="ml-auto text-xs text-primary font-medium min-h-11 inline-flex items-center">
            Iniciar sesión
          </Link>
        </div>
      </header>
      <main id="main-content" className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
