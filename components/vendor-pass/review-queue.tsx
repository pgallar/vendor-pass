'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vendor-pass/button';

export interface ReviewDoc {
  id: string;
  document_name: string;
  document_type: string;
  expires_at: string;
}

export function ReviewQueue({ docs }: { docs: ReviewDoc[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function approve(id: string, anchor: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/documents/${id}/approve${anchor ? '?anchor=1' : ''}`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert((await res.json().catch(() => ({}))).error ?? 'Error al aprobar');
  }

  async function reject(id: string) {
    const reason = prompt('Motivo del rechazo (visible para el proveedor):');
    if (!reason || !reason.trim()) return;
    setBusyId(id);
    const res = await fetch(`/api/documents/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert((await res.json().catch(() => ({}))).error ?? 'Error al rechazar');
  }

  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay documentos pendientes de aprobación.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {docs.map(d => (
        <li key={d.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{d.document_name}</p>
            <p className="text-xs text-muted-foreground">{d.document_type} · vence {d.expires_at}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" loading={busyId === d.id} onClick={() => approve(d.id, true)}>
              Aprobar y anclar
            </Button>
            <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => approve(d.id, false)}>
              Solo aprobar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === d.id} onClick={() => reject(d.id)}>
              Rechazar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
