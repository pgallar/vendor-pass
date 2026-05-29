import { DOCUMENT_TYPE_VALUES } from '@/lib/documents';
import type { Criticality, ExtractedDocument } from '@/lib/types';
import type { DocumentInput } from '@/lib/api-keys/types';

export type DocumentFieldOverrides = {
  document_type?: string;
  document_name?: string;
  issued_at?: string;
  expires_at?: string;
  criticality?: Criticality;
  notes?: string | null;
};

function mergeNotes(extracted: ExtractedDocument | null, overrideNotes?: string | null): string | null {
  const parts: string[] = [];
  if (extracted?.summary) parts.push(extracted.summary);
  if (extracted?.issuer) parts.push(`Emisor: ${extracted.issuer}`);
  if (extracted?.policy_number) parts.push(`Póliza/certificado: ${extracted.policy_number}`);
  if (extracted?.coverage) parts.push(`Cobertura: ${extracted.coverage}`);
  const fromAi = parts.join('\n').trim();
  const manual = typeof overrideNotes === 'string' ? overrideNotes.trim() : '';
  if (manual && fromAi) return `${manual}\n\n${fromAi}`;
  return manual || fromAi || null;
}

/** Combina extracción IA con overrides explícitos para armar el insert del documento. */
export function buildDocumentInputFromExtraction(
  vendorId: string,
  file: { fileUrl: string; fileHash: string },
  extracted: ExtractedDocument | null,
  overrides: DocumentFieldOverrides,
): DocumentInput {
  const document_type = overrides.document_type ?? extracted?.document_type ?? '';
  const document_name =
    overrides.document_name?.trim() ||
    extracted?.document_name?.trim() ||
    '';
  const issued_at = overrides.issued_at ?? extracted?.issued_at ?? '';
  const expires_at = overrides.expires_at ?? extracted?.expires_at ?? '';
  const criticality = overrides.criticality ?? extracted?.criticality ?? 'critical';

  if (!document_type || !DOCUMENT_TYPE_VALUES.includes(document_type)) {
    throw new Error(
      `document_type requerido (valores: ${DOCUMENT_TYPE_VALUES.join(', ')}). ` +
        'Proveelo o usá extracción IA (extract_with_ai).',
    );
  }
  if (!document_name) {
    throw new Error('document_name requerido. Proveelo o usá extracción IA.');
  }
  if (!issued_at || !expires_at) {
    throw new Error(
      'issued_at y expires_at son requeridos (YYYY-MM-DD). Proveelos o usá extracción IA.',
    );
  }

  return {
    vendor_id: vendorId,
    document_type,
    document_name,
    issued_at,
    expires_at,
    criticality,
    file_url: file.fileUrl,
    file_hash: file.fileHash,
    notes: mergeNotes(extracted, overrides.notes),
  };
}
