'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/vendor-pass/button';
import { FormField, Input } from '@/components/vendor-pass/form-field';
import { KeyRound, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';
import type { ApiKey, ApiKeyCreated } from '@/lib/types';

const MAX_ACTIVE_KEYS = 5;

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/api-keys');
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeCount = keys.length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Ingresá un nombre para identificar la clave.');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error creando la API key');
      return;
    }
    const data = await res.json();
    setCreated(data.key as ApiKeyCreated);
    setCopied(false);
    setName('');
    load();
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(id: string) {
    if (!confirm('¿Revocar esta API key? Las integraciones que la usen dejarán de funcionar.')) return;
    const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="flex flex-col gap-6">
      {created && (
        <section className="bg-card border-2 border-primary rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound size={16} className="text-primary" aria-hidden="true" />
            API key «{created.name}» creada
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-600">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            Copiala ahora: por seguridad, <strong>no vas a poder verla de nuevo</strong>.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs break-all bg-secondary rounded-lg p-2.5 text-foreground">
              {created.plaintext}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              className="min-h-11 shrink-0"
            >
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" className="self-end" onClick={() => setCreated(null)}>
            Listo, la guardé
          </Button>
        </section>
      )}

      <form onSubmit={handleCreate} noValidate className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Crear API key</h2>
        <FormField id="key_name" label="Nombre" hint={`${activeCount}/${MAX_ACTIVE_KEYS} claves activas`}>
          <Input
            id="key_name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Automatización n8n"
            leftAddon={<KeyRound size={15} />}
            className="min-h-11"
            disabled={activeCount >= MAX_ACTIVE_KEYS}
          />
        </FormField>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={creating}
          className="w-full min-h-11"
          disabled={activeCount >= MAX_ACTIVE_KEYS}
        >
          {activeCount >= MAX_ACTIVE_KEYS ? 'Máximo de 5 alcanzado' : 'Generar API key'}
        </Button>
      </form>

      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tus API keys</h2>
        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!loading && keys.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no creaste ninguna API key.</p>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {keys.map(k => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}</p>
                <p className="text-[11px] text-muted-foreground">
                  Creada {new Date(k.created_at).toLocaleDateString('es-AR')}
                  {k.last_used_at ? ` · último uso ${new Date(k.last_used_at).toLocaleDateString('es-AR')}` : ' · sin usar'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(k.id)}
                leftIcon={<Trash2 size={14} />}
                className="text-destructive shrink-0 min-h-11"
              >
                Revocar
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
