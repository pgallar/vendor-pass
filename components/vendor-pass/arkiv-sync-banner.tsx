import Link from 'next/link';
import { readSyncState } from '@/lib/arkiv/sync-state';
import { getStoreSource } from '@/lib/arkiv/validations';
import { cn } from '@/lib/utils';
import { Database, Clock } from 'lucide-react';

export function ArkivSyncBanner() {
  const state = readSyncState();
  const source = getStoreSource();
  const stale =
    state?.completedAt != null &&
    Date.now() - new Date(state.completedAt).getTime() > 25 * 60 * 60 * 1000;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border text-sm',
        stale
          ? 'bg-[oklch(0.973_0.077_70.5)] border-[oklch(0.612_0.168_70.5)]/30'
          : 'bg-secondary/60 border-border',
      )}
    >
      <Database size={16} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">
          Cumplimiento vía {source === 'arkiv' ? 'Arkiv Network' : 'memoria local'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
          <Clock size={11} aria-hidden="true" />
          {state?.completedAt
            ? `Última sync: ${new Date(state.completedAt).toLocaleString('es-MX')}`
            : 'Sin sync registrada — ejecuta npm run sync:arkiv'}
          {stale && ' · los estados pueden estar desactualizados'}
        </p>
      </div>
      <Link href="/expirations" className="text-xs text-primary font-medium shrink-0">
        Vencimientos
      </Link>
    </div>
  );
}
