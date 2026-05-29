import type { LifecycleStatus, VendorDocument } from '@/lib/types';

/** Campos que quedan congelados una vez que el documento se ancló en Arkiv. */
export const IMMUTABLE_FIELDS = [
  'issued_at',
  'expires_at',
  'file_hash',
  'document_type',
] as const satisfies readonly (keyof VendorDocument)[];

type ImmutableField = (typeof IMMUTABLE_FIELDS)[number];

/** Transiciones permitidas del ciclo de vida. `anchored` es terminal (la renovación es Feature 4). */
const ALLOWED_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  draft: ['pending_anchor', 'anchored'],
  pending_anchor: ['anchored', 'draft'],
  anchored: [],
};

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Solo los borradores son editables libremente. */
export function canEdit(doc: Pick<VendorDocument, 'lifecycle_status'>): boolean {
  return doc.lifecycle_status === 'draft';
}

export type AnchorCheck = { ok: true } | { ok: false; reason: string };

/** Un documento puede anclarse si no está ya anclado y tiene evidencia con hash. */
export function canAnchor(
  doc: Pick<VendorDocument, 'lifecycle_status' | 'file_hash'>,
): AnchorCheck {
  if (doc.lifecycle_status === 'anchored') {
    return { ok: false, reason: 'El documento ya está anclado en Arkiv.' };
  }
  if (!doc.file_hash) {
    return { ok: false, reason: 'Falta la evidencia: no hay hash del archivo para anclar.' };
  }
  return { ok: true };
}

/** Devuelve los campos inmutables que cambiarían respecto del documento actual. */
export function immutableFieldsChanged(
  current: Pick<VendorDocument, ImmutableField>,
  patch: Partial<Record<ImmutableField, unknown>>,
): ImmutableField[] {
  return IMMUTABLE_FIELDS.filter(
    field => field in patch && patch[field] !== undefined && patch[field] !== current[field],
  );
}
