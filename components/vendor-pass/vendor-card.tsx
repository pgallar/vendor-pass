import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import type { VendorWithStatus } from '@/lib/types';
import { Building2, FileText, ChevronRight, Mail } from 'lucide-react';

export interface VendorCardProps {
  vendor: VendorWithStatus;
  linkable?: boolean;
  className?: string;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function VendorCard({ vendor, linkable = true, className }: VendorCardProps) {
  const vencidos = vendor.documents.filter(d => d.status === 'vencido').length;
  const porVencer = vendor.documents.filter(d => d.status === 'por_vencer').length;
  const total = vendor.documents.length;

  const main = (
    <>
      <div
        className="shrink-0 w-11 h-11 rounded-xl bg-brand-muted flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-sm font-bold text-brand-muted-foreground">{getInitials(vendor.name)}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-foreground truncate">{vendor.name}</p>
          <StatusBadge status={vendor.status} iconOnly size="sm" />
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Building2 size={11} aria-hidden="true" />
          <span className="truncate">{vendor.category ?? vendor.area ?? '—'}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText size={11} aria-hidden="true" />
            <span>{total} docs</span>
          </div>
          {vencidos > 0 && (
            <span className="text-xs font-medium text-[oklch(0.354_0.14_27.4)]">
              {vencidos} vencido{vencidos > 1 ? 's' : ''}
            </span>
          )}
          {porVencer > 0 && (
            <span className="text-xs font-medium text-[oklch(0.375_0.105_70.5)]">
              {porVencer} por vencer
            </span>
          )}
        </div>
      </div>

      {linkable && <ChevronRight size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />}
    </>
  );

  return (
    <article
      className={cn(
        'bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-colors',
        linkable && 'hover:border-primary/40 hover:bg-accent/30',
        className,
      )}
    >
      {linkable ? (
        <Link href={`/vendors/${vendor.id}`} className="flex flex-1 items-center gap-3 min-w-0">
          {main}
        </Link>
      ) : (
        <div className="flex flex-1 items-center gap-3 min-w-0">{main}</div>
      )}

      {vendor.owner_email && (
        <a
          href={`mailto:${vendor.owner_email}`}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
          aria-label={`Enviar correo a ${vendor.name}`}
        >
          <Mail size={14} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}
