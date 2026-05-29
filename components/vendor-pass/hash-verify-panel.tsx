'use client';

import { useState } from 'react';
import { FileInput } from '@/components/vendor-pass/form-field';
import { hashFileBrowser, hashesMatch } from '@/lib/crypto/file-hash';
import { ShieldCheck, ShieldAlert, AlertCircle, Hash } from 'lucide-react';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'hashing' }
  | { kind: 'match'; computed: string }
  | { kind: 'mismatch'; computed: string }
  | { kind: 'error'; message: string };

export function HashVerifyPanel({
  expectedHash,
  desync = false,
}: {
  expectedHash: string | null;
  desync?: boolean;
}) {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  if (!expectedHash) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary border border-border">
        <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          No hay hash registrado para este documento; la integridad del archivo no es verificable.
        </p>
      </div>
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ kind: 'hashing' });
    try {
      const computed = await hashFileBrowser(file);
      setState(
        hashesMatch(expectedHash, computed)
          ? { kind: 'match', computed }
          : { kind: 'mismatch', computed },
      );
    } catch {
      setState({ kind: 'error', message: 'No se pudo calcular el hash del archivo.' });
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-primary shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Comprobar integridad</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Subí el archivo que tenés en mano. Se calcula su hash SHA-256 en tu navegador (no se envía a
        ningún servidor) y se compara con el registrado.
      </p>

      {desync && (
        <div className="flex items-start gap-2 text-xs text-amber-600">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          Atención: el hash de la base de datos no coincide con el anclado en Arkiv (posible
          desincronización). La comparación usa el de Arkiv.
        </div>
      )}

      <FileInput
        id="hash_check_file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={handleFile}
        dropLabel="Seleccionar el archivo a comprobar"
      />

      {state.kind === 'hashing' && (
        <p className="text-sm text-muted-foreground">Calculando hash…</p>
      )}

      {state.kind === 'match' && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary border border-border">
          <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">El archivo coincide</p>
            <p className="text-xs text-muted-foreground">
              Es el mismo archivo que se registró. Su integridad está verificada.
            </p>
          </div>
        </div>
      )}

      {state.kind === 'mismatch' && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary border border-destructive">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-destructive">El archivo NO coincide</p>
              <p className="text-xs text-muted-foreground">
                Este archivo es distinto del que se registró. No uses esta copia como evidencia válida.
              </p>
            </div>
          </div>
          <code className="text-[11px] font-mono break-all text-muted-foreground">
            Calculado: {state.computed}
          </code>
        </div>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
    </section>
  );
}
