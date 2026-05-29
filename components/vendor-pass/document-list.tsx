import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import { DocumentRowActions } from './document-row-actions';
import { AnchorDocumentButton } from './anchor-document-button';
import type { VendorDocument, DocumentStatus } from '@/lib/types';
import { FileText, Calendar, Plus, ShieldCheck, Lock } from 'lucide-react';
import { Button } from './button';
import Link from 'next/link';

type Doc = VendorDocument & { status: DocumentStatus };

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getDaysLabel(expiresAt: string, status: DocumentStatus): string | null {
  const diff = Math.ceil((new Date(expiresAt + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
  if (status === 'vencido') return diff < 0 ? `vencido hace ${Math.abs(diff)} días` : 'vencido';
  if (diff === 0) return 'vence hoy';
  if (diff <= 30) return `${diff} días`;
  return null;
}

const LIFECYCLE_LABEL: Record<Doc['lifecycle_status'], string> = {
  draft: 'Borrador',
  pending_anchor: 'Listo para anclar',
  anchored: 'Anclado en Arkiv',
};

function LifecycleBadge({ status }: { status: Doc['lifecycle_status'] }) {
  if (status === 'anchored') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
        <Lock size={10} aria-hidden="true" />
        {LIFECYCLE_LABEL.anchored}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
      {LIFECYCLE_LABEL[status]}
    </span>
  );
}

function DocumentRow({ doc, vendorId }: { doc: Doc; vendorId?: string }) {
  const daysLabel = getDaysLabel(doc.expires_at, doc.status);

  return (
    <li className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-secondary flex items-center justify-center" aria-hidden="true">
        <FileText size={16} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{doc.document_type}</span>
          <span className="text-xs text-muted-foreground" aria-hidden="true">·</span>
          <span className={cn(
            'flex items-center gap-1 text-xs',
            doc.status === 'vencido' && 'text-[oklch(0.354_0.14_27.4)]',
            doc.status === 'por_vencer' && 'text-[oklch(0.375_0.105_70.5)]',
            doc.status === 'vigente' && 'text-muted-foreground',
          )}>
            <Calendar size={11} aria-hidden="true" />
            {formatDate(doc.expires_at)}
            {daysLabel && <span>({daysLabel})</span>}
          </span>
          {doc.criticality === 'critical' && (
            <span className="text-[10px] font-medium text-muted-foreground">Crítico</span>
          )}
          <LifecycleBadge status={doc.lifecycle_status} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {doc.lifecycle_status === 'anchored' && (
          <Link
            href={`/verify/${doc.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary font-medium min-h-11 px-2"
            title="Verificar en Arkiv"
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Verificar</span>
          </Link>
        )}
        {doc.lifecycle_status !== 'anchored' && <AnchorDocumentButton documentId={doc.id} />}
        {vendorId && <DocumentRowActions documentId={doc.id} vendorId={vendorId} />}
        <StatusBadge status={doc.status} size="sm" />
      </div>
    </li>
  );
}

export interface DocumentListProps {
  documents: Doc[];
  vendorId?: string;
  className?: string;
  showAddCta?: boolean;
}

export function DocumentList({ documents, vendorId, className, showAddCta = false }: DocumentListProps) {
  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No hay documentos registrados.</p>;
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <ul role="list">{documents.map(d => <DocumentRow key={d.id} doc={d} vendorId={vendorId} />)}</ul>
      {showAddCta && vendorId && (
        <div className="pt-3">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/vendors/${vendorId}/documents/new`} className="inline-flex items-center justify-center gap-1.5">
              <Plus size={14} aria-hidden="true" />
              Agregar documento
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
