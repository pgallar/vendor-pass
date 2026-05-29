import type {
  DocumentEventPayloads,
  DocumentEventType,
  VendorDocument,
} from '@/lib/types';

/** Campos de negocio que se versionan en el snapshot/diff. */
const TRACKED_FIELDS = [
  'document_type',
  'document_name',
  'issued_at',
  'expires_at',
  'criticality',
  'file_url',
  'file_hash',
  'notes',
] as const;

export function documentSnapshot(doc: VendorDocument): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of TRACKED_FIELDS) out[f] = doc[f];
  return out;
}

export function diffDocumentFields(
  prev: VendorDocument,
  next: VendorDocument,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of TRACKED_FIELDS) {
    if (prev[f] !== next[f]) changes[f] = { from: prev[f], to: next[f] };
  }
  return changes;
}

/** Entradas aceptadas por cada tipo de evento (lo que el caller debe proveer). */
type BuildInput = {
  created: { document: VendorDocument };
  anchored: DocumentEventPayloads['anchored'];
  updated: { changes: DocumentEventPayloads['updated']['changes'] } | { prev: VendorDocument; next: VendorDocument };
  status_recomputed: DocumentEventPayloads['status_recomputed'];
  renewed: DocumentEventPayloads['renewed'];
  revoked: Partial<DocumentEventPayloads['revoked']>;
  file_replaced: DocumentEventPayloads['file_replaced'];
};

function required<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null) {
    throw new Error(`buildEventPayload: falta el campo obligatorio "${name}"`);
  }
  return value;
}

export function buildEventPayload<T extends DocumentEventType>(
  type: T,
  input: BuildInput[T],
): DocumentEventPayloads[T] {
  switch (type) {
    case 'created': {
      const i = input as BuildInput['created'];
      return { snapshot: documentSnapshot(required(i.document, 'document')) } as DocumentEventPayloads[T];
    }
    case 'anchored': {
      const i = input as BuildInput['anchored'];
      return {
        entityKey: required(i.entityKey, 'entityKey'),
        status: required(i.status, 'status'),
        fileHash: i.fileHash ?? null,
      } as DocumentEventPayloads[T];
    }
    case 'updated': {
      const i = input as BuildInput['updated'];
      const changes = 'changes' in i ? i.changes : diffDocumentFields(i.prev, i.next);
      return { changes } as DocumentEventPayloads[T];
    }
    case 'status_recomputed': {
      const i = input as BuildInput['status_recomputed'];
      return {
        oldStatus: required(i.oldStatus, 'oldStatus'),
        newStatus: required(i.newStatus, 'newStatus'),
      } as DocumentEventPayloads[T];
    }
    case 'renewed': {
      const i = input as BuildInput['renewed'];
      return { supersedesDocumentId: required(i.supersedesDocumentId, 'supersedesDocumentId') } as DocumentEventPayloads[T];
    }
    case 'revoked': {
      const i = input as BuildInput['revoked'];
      return { reason: i.reason ?? '' } as DocumentEventPayloads[T];
    }
    case 'file_replaced': {
      const i = input as BuildInput['file_replaced'];
      return { oldHash: i.oldHash ?? null, newHash: i.newHash ?? null } as DocumentEventPayloads[T];
    }
    default:
      throw new Error(`buildEventPayload: tipo desconocido "${type}"`);
  }
}

/** Tipos de evento que se exponen públicamente (no sensibles). */
export const PUBLIC_EVENT_TYPES: DocumentEventType[] = ['anchored', 'status_recomputed', 'renewed'];

export function isPublicEvent(type: DocumentEventType): boolean {
  return PUBLIC_EVENT_TYPES.includes(type);
}
