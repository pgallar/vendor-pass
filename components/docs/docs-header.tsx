import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/vendor-pass/button';

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck size={20} className="text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-foreground">VendorPass</span>
          <span className="text-sm font-medium text-muted-foreground">Docs</span>
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href="/login">Acceder</Link>
        </Button>
      </div>
    </header>
  );
}
