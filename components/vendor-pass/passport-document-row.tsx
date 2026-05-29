import Link from 'next/link';
import { StatusBadge } from '@/components/vendor-pass/status-badge';
import type { PassportDocument } from '@/lib/passport/build-vendor-passport';
import { FileText, Calendar, Hash } from 'lucide-react';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function PassportDocumentRow({ doc }: { doc: PassportDocument }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-secondary flex items-center justify-center" aria-hidden="true">
        <FileText size={16} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.documentName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{doc.documentType}</span>
          <span aria-hidden="true">·</span>
          <Calendar size={11} aria-hidden="true" />
          <span>{formatDate(doc.expiresAt)}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {doc.lifecycle === 'anchored' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[oklch(0.93_0.05_155)] text-[oklch(0.36_0.1_155)]">
              Anclado en red
            </span>
          )}
          {doc.lifecycle === 'pending_anchor' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Pendiente de anclaje
            </span>
          )}
          {doc.lifecycle === 'draft' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Borrador
            </span>
          )}
          {doc.hashRegistered && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-foreground">
              <Hash size={10} aria-hidden="true" /> Hash registrado
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/verify/${doc.id}`}
          className="text-xs text-primary font-medium min-h-11 inline-flex items-center px-2"
        >
          Verificar
        </Link>
        <StatusBadge status={doc.status} size="sm" />
      </div>
    </li>
  );
}
