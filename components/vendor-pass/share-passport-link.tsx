'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/vendor-pass/button';
import { Check, Copy, Download, ExternalLink, Link2, Loader2, QrCode, Share2 } from 'lucide-react';

function toAbsoluteUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (typeof window === 'undefined') return href;
  return `${window.location.origin}${href.startsWith('/') ? href : `/${href}`}`;
}

/** GET binario sin pasar por el fetch parcheado de Next (evita flight RSC con nombre UUID). */
function fetchPdfBlob(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.setRequestHeader('Accept', 'application/pdf');
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response;
        if (blob instanceof Blob && blob.size > 0) {
          resolve(blob);
          return;
        }
        reject(new Error('Respuesta vacía'));
        return;
      }
      reject(new Error(`Error ${xhr.status} al generar el PDF`));
    };
    xhr.onerror = () => reject(new Error('Error de red al descargar el PDF'));
    xhr.send();
  });
}

async function assertPdfBlob(blob: Blob) {
  const head = await blob.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(head);
  // %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return;
  throw new Error('La respuesta no es un PDF válido. Recargá la página e intentá de nuevo.');
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Descarga el PDF con fetch → blob → object URL.
 * No usa iframe ni <a href="/api/..."> (Chrome/Next los tratan como navegación
 * y pueden guardar un flight RSC con nombre UUID en lugar del PDF).
 */
export function DownloadPassportPdfButton({
  href,
  filename,
  className,
  compact = false,
}: {
  /** Ruta relativa o URL absoluta del endpoint passport-pdf */
  href: string;
  filename: string;
  className?: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const url = toAbsoluteUrl(href);
      const blob = await fetchPdfBlob(url);
      await assertPdfBlob(blob);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar el PDF');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'md'}
        className={cn(compact ? 'inline-flex items-center gap-1.5' : 'w-full min-h-11', className)}
        disabled={loading}
        onClick={() => void handleDownload()}
      >
        {loading ? (
          <>
            <Loader2 size={compact ? 13 : 16} className="animate-spin" aria-hidden="true" />
            {compact ? 'PDF…' : 'Generando PDF…'}
          </>
        ) : (
          <>
            <Download size={compact ? 13 : 16} aria-hidden="true" />
            {compact ? 'Descargar PDF' : 'Descargar PDF del pasaporte'}
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function useCopyUrl(url: string) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      try {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return true;
      } catch {
        alert('No se pudo copiar el enlace. Copialo manualmente desde el campo.');
        return false;
      }
    }
  }, [url]);

  return { copied, copy };
}

/** Botón compacto para copiar el enlace de descarga del PDF. */
export function CopyPassportUrlButton({ url, className }: { url: string; className?: string }) {
  const { copied, copy } = useCopyUrl(url);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('inline-flex items-center gap-1.5', className)}
      onClick={() => void copy()}
      aria-label={copied ? 'Enlace copiado' : 'Copiar enlace de descarga del PDF'}
    >
      {copied ? (
        <>
          <Check size={13} aria-hidden="true" />
          Copiado
        </>
      ) : (
        <>
          <Copy size={13} aria-hidden="true" />
          Copiar enlace
        </>
      )}
    </Button>
  );
}

export function SharePassportLink({
  pdfUrl,
  pdfDownloadPath,
  qrDataUrl,
  pageUrl,
  vendorName,
  pdfFilename,
  inputId = 'passport-pdf-url',
  className,
}: {
  /** URL absoluta del PDF (QR, copiar, mostrar en input). */
  pdfUrl: string;
  /** Ruta relativa para el botón de descarga (/api/.../passport-pdf). */
  pdfDownloadPath: string;
  qrDataUrl: string;
  /** Página web del pasaporte (opcional). */
  pageUrl?: string;
  vendorName?: string;
  pdfFilename: string;
  inputId?: string;
  className?: string;
}) {
  const { copied, copy } = useCopyUrl(pdfUrl);

  function selectUrl() {
    const el = document.getElementById(inputId);
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.select();
    }
  }

  return (
    <section
      className={cn(
        'bg-card border-2 border-primary/20 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm',
        className,
      )}
      aria-labelledby="share-passport-heading"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-10 h-10 rounded-lg bg-brand-muted flex items-center justify-center"
          aria-hidden="true"
        >
          <Share2 size={18} className="text-brand-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="share-passport-heading" className="text-base font-semibold text-foreground">
            Compartir pasaporte PDF
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {vendorName ? (
              <>
                El QR y el enlace descargan el PDF de{' '}
                <span className="font-medium text-foreground">{vendorName}</span>.
              </>
            ) : (
              <>Escaneá el QR o copiá el enlace para descargar el PDF del pasaporte.</>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="flex flex-col items-center gap-2 mx-auto sm:mx-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <QrCode size={14} aria-hidden="true" />
            Código QR → descarga PDF
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR para descargar el PDF del pasaporte"
            width={200}
            height={200}
            className="rounded-xl border border-border bg-white p-2 w-[200px] h-[200px]"
          />
          <p className="text-[11px] text-muted-foreground text-center max-w-[200px]">
            Al escanear se descarga <span className="font-mono">{pdfFilename}</span>
          </p>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-xs font-medium text-foreground flex items-center gap-1">
              <Link2 size={12} aria-hidden="true" />
              Enlace de descarga del PDF
            </label>
            <div className="flex flex-col gap-2">
              <input
                id={inputId}
                type="url"
                readOnly
                value={pdfUrl}
                onFocus={selectUrl}
                onClick={selectUrl}
                className={cn(
                  'w-full text-xs font-mono bg-secondary border border-border rounded-lg px-3 py-2.5',
                  'text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                )}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full min-h-11"
                onClick={() => void copy()}
              >
                {copied ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    ¡Enlace copiado!
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    Copiar enlace del PDF
                  </>
                )}
              </Button>
            </div>
          </div>

          <DownloadPassportPdfButton
            href={pdfDownloadPath}
            filename={pdfFilename}
          />

          {pageUrl && (
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
              <Link
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Ver estado en línea (siempre actualizado)
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
