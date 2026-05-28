import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <ShieldCheck size={22} className="text-primary-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground leading-none">VendorPass</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cumplimiento de proveedores</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
