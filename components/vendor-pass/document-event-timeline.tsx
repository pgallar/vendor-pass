'use client';

import { useEffect, useState } from 'react';
import { History, ShieldCheck, RefreshCw, FileEdit, FilePlus, FileX, Repeat } from 'lucide-react';
import type { DocumentEvent, DocumentEventType } from '@/lib/types';

const LABELS: Record<DocumentEventType, string> = {
  created: 'Documento creado',
  anchored: 'Anclado en Arkiv',
  updated: 'Datos actualizados',
  status_recomputed: 'Estado recalculado',
  renewed: 'Renovado (reemplaza a otro documento)',
  revoked: 'Documento dado de baja',
  file_replaced: 'Archivo reemplazado',
};

const ICONS: Record<DocumentEventType, React.ComponentType<{ size?: number; className?: string }>> = {
  created: FilePlus,
  anchored: ShieldCheck,
  updated: FileEdit,
  status_recomputed: RefreshCw,
  renewed: Repeat,
  revoked: FileX,
  file_replaced: FileEdit,
};

function describePayload(e: DocumentEvent): string | null {
  const p = e.payload ?? {};
  switch (e.event_type) {
    case 'status_recomputed':
      return `${p.oldStatus} → ${p.newStatus}`;
    case 'anchored':
      return typeof p.entityKey === 'string' ? `entity ${String(p.entityKey).slice(0, 10)}…` : null;
    case 'updated': {
      const changes = (p.changes as Record<string, unknown>) ?? {};
      const keys = Object.keys(changes);
      return keys.length ? `Campos: ${keys.join(', ')}` : null;
    }
    case 'revoked':
      return typeof p.reason === 'string' && p.reason ? `Motivo: ${p.reason}` : null;
    case 'renewed':
      return 'Reemplaza a un documento anterior';
    case 'file_replaced':
      return 'Hash del archivo modificado';
    default:
      return null;
  }
}

export function DocumentEventTimeline({ documentId }: { documentId: string }) {
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/documents/${documentId}/events`)
      .then(r => (r.ok ? r.json() : { events: [] }))
      .then(d => {
        if (alive) setEvents(d.events ?? []);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [documentId]);

  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History size={16} className="text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Historial de cambios</h2>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay eventos registrados.</p>
      )}
      <ol className="flex flex-col gap-3">
        {events
          .slice()
          .reverse()
          .map(e => {
            const Icon = ICONS[e.event_type] ?? History;
            const detail = describePayload(e);
            return (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-secondary p-1.5">
                  <Icon size={14} className="text-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{LABELS[e.event_type] ?? e.event_type}</p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString('es-AR')}
                    {e.actor_user_id ? ' · por un usuario' : ' · sistema'}
                  </p>
                </div>
              </li>
            );
          })}
      </ol>
    </section>
  );
}
