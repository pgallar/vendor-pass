import type { VendorStatus } from '@/lib/types';
import type { ComplianceReason } from '@/lib/status';
import { StatusBadge } from './status-badge';
import { AlertTriangle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function reasonMessage(reason: ComplianceReason): string {
  const date = formatDate(reason.expiresAt);
  if (reason.status === 'vencido') {
    return `${reason.documentName} venció el ${date}`;
  }
  return `${reason.documentName} vence el ${date}`;
}

export interface VendorComplianceSummaryProps {
  status: VendorStatus;
  reasons: ComplianceReason[];
  className?: string;
}

export function VendorComplianceSummary({ status, reasons, className }: VendorComplianceSummaryProps) {
  if (status === 'ok' || reasons.length === 0) return null;

  const isBlocked = status === 'bloqueado';

  return (
    <section
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3',
        isBlocked
          ? 'bg-[oklch(0.936_0.071_27.4)] border-[oklch(0.612_0.168_27.4)]/30'
          : 'bg-[oklch(0.973_0.077_70.5)] border-[oklch(0.612_0.168_70.5)]/30',
        className,
      )}
      aria-labelledby="compliance-summary-heading"
    >
      <div className="flex items-start gap-3">
        {isBlocked ? (
          <Ban size={18} className="text-[oklch(0.354_0.14_27.4)] shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <AlertTriangle size={18} className="text-[oklch(0.375_0.105_70.5)] shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id="compliance-summary-heading" className="text-sm font-semibold text-foreground">
              {isBlocked ? 'Proveedor bloqueado' : 'Requiere atención'}
            </h2>
            <StatusBadge status={status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isBlocked
              ? 'Hay documentos críticos vencidos que impiden operar con este proveedor.'
              : 'Hay documentos críticos por vencer en los próximos 30 días.'}
          </p>
        </div>
      </div>
      <ul role="list" className="flex flex-col gap-2 pl-1">
        {reasons.map(r => (
          <li key={r.documentId} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{reasonMessage(r)}</span>
            <StatusBadge status={r.status} size="sm" />
          </li>
        ))}
      </ul>
    </section>
  );
}
