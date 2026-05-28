'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { RefreshCw } from 'lucide-react';

export function ArkivSyncActions() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    const res = await fetch('/api/arkiv/sync', { method: 'POST' });
    setSyncing(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error en sincronización');
      return;
    }
    const data = await res.json();
    const synced = data.sync?.synced ?? 0;
    const failed = data.sync?.failed ?? 0;
    const emails = data.emails?.sent ?? 0;
    setMessage(
      synced === 0
        ? 'No hay documentos para sincronizar'
        : failed > 0
          ? `Sync parcial: ${synced} ok, ${failed} fallidos`
          : `Sincronizados ${synced} documento${synced === 1 ? '' : 's'}${emails ? ` · ${emails} email(s)` : ''}`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={syncing}
        onClick={handleSync}
        className="min-h-11"
      >
        {!syncing && <RefreshCw size={14} aria-hidden="true" />}
        Sync now
      </Button>
      {message && <p className="text-[11px] text-muted-foreground text-right max-w-[180px]">{message}</p>}
      {error && <p className="text-[11px] text-destructive text-right max-w-[180px]">{error}</p>}
    </div>
  );
}
