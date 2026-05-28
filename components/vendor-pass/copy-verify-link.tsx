'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';

export function CopyVerifyLink({ documentId }: { documentId: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify/${documentId}`
      : `/verify/${documentId}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('No se pudo copiar el enlace');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">Enlace de verificación pública</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono bg-secondary px-2 py-1.5 rounded-md break-all">{url}</code>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium min-h-11 px-3 rounded-lg border border-border',
            'hover:bg-secondary transition-colors',
          )}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
