'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, RefreshCw, Download } from 'lucide-react';
import { Button } from './button';
import type { ParityAuditResult } from '@/lib/arkiv/verify-parity';

export function ArkivAuditPanel() {
  const [result, setResult] = useState<ParityAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/arkiv/audit');
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error cargando auditoría');
      return;
    }
    setResult(await res.json());
  }

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/arkiv/audit')
      .then(async res => {
        if (cancelled) return;
        setLoading(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? 'Error cargando auditoría');
          return;
        }
        setResult(await res.json());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando auditoría…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border',
          result.ok
            ? 'bg-[oklch(0.936_0.071_145)] border-[oklch(0.612_0.168_145)]/30'
            : 'bg-[oklch(0.936_0.071_27.4)] border-[oklch(0.612_0.168_27.4)]/30',
        )}
      >
        {result.ok ? (
          <CheckCircle2 size={20} className="text-[oklch(0.354_0.14_145)] shrink-0" aria-hidden="true" />
        ) : (
          <XCircle size={20} className="text-[oklch(0.354_0.14_27.4)] shrink-0" aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {result.ok ? 'Postgres y Arkiv en paridad' : 'Discrepancias detectadas'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Postgres: {result.postgresCount} · Arkiv: {result.arkivCount}
          </p>
        </div>
        <div className="ml-auto flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} className="min-h-11">
            <RefreshCw size={14} aria-hidden="true" />
            Actualizar
          </Button>
          <Button asChild variant="primary" size="sm" className="min-h-11">
            <a href="/api/arkiv/audit/pdf" target="_blank" rel="noopener noreferrer">
              <Download size={14} aria-hidden="true" />
              Descargar PDF
            </a>
          </Button>
        </div>
      </div>

      {result.missingInArkiv.length > 0 && (
        <AuditList title="Faltantes en Arkiv" items={result.missingInArkiv} />
      )}
      {result.orphanInArkiv.length > 0 && (
        <AuditList title="Huérfanos en Arkiv" items={result.orphanInArkiv} />
      )}
      {result.mismatches.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">Estados desincronizados</h3>
          <ul role="list" className="text-xs font-mono flex flex-col gap-1">
            {result.mismatches.map(m => (
              <li key={m.documentId}>
                {m.documentId}: postgres={m.postgres} arkiv={m.arkiv}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AuditList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">{title} ({items.length})</h3>
      <ul role="list" className="text-xs font-mono flex flex-col gap-1">
        {items.map(id => (
          <li key={id}>{id}</li>
        ))}
      </ul>
    </section>
  );
}
