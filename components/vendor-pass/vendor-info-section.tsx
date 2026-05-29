import { Building2, Mail, User, MapPin, Calendar } from 'lucide-react';
import type { Vendor } from '@/lib/types';

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

export function VendorInfoSection({ vendor }: { vendor: Vendor }) {
  return (
    <section aria-labelledby="info-heading" className="bg-card border border-border rounded-xl p-4">
      <h2 id="info-heading" className="text-sm font-semibold text-foreground mb-2">
        Información del proveedor
      </h2>
      <InfoRow icon={Building2} label="Categoría" value={vendor.category ?? '—'} />
      <InfoRow icon={User} label="Owner interno" value={vendor.owner_name ?? '—'} />
      {vendor.owner_email && <InfoRow icon={Mail} label="Email del owner" value={vendor.owner_email} />}
      <InfoRow icon={MapPin} label="Área / sitio" value={vendor.area ?? '—'} />
      <InfoRow
        icon={Calendar}
        label="Alta en sistema"
        value={new Date(vendor.created_at).toLocaleDateString('es-MX', {
          day: '2-digit', month: 'long', year: 'numeric',
        })}
      />
      {vendor.notes && (
        <div className="pt-2.5 mt-1 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p className="text-sm text-foreground">{vendor.notes}</p>
        </div>
      )}
    </section>
  );
}
