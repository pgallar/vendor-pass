export type Criticality = 'critical' | 'normal';
export type DocumentStatus = 'vigente' | 'por_vencer' | 'vencido';
export type VendorStatus = 'ok' | 'atencion' | 'bloqueado';
export type LifecycleStatus = 'draft' | 'pending_anchor' | 'anchored';
export type AnyStatus = DocumentStatus | VendorStatus;

export interface Vendor {
  id: string;
  name: string;
  category: string | null;
  owner_name: string | null;
  owner_email: string | null;
  area: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: string;
  document_name: string;
  issued_at: string;
  expires_at: string;
  criticality: Criticality;
  file_url: string | null;
  file_hash: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lifecycle_status: LifecycleStatus;
  anchored_at: string | null;
  arkiv_entity_key: string | null;
}

export interface VendorWithStatus extends Vendor {
  status: VendorStatus;
  documents: (VendorDocument & { status: DocumentStatus })[];
}

/** Salida cruda del modelo (forced tool use) — todos los campos opcionales. */
export interface RawExtraction {
  document_type?: string;
  document_name?: string;
  issued_at?: string;
  expires_at?: string;
  criticality?: string;
  issuer?: string;
  policy_number?: string;
  coverage?: string;
  summary?: string;
  confidence?: number;
}

/** Resultado normalizado y validado, listo para precargar el formulario. */
export interface ExtractedDocument {
  document_type: string;          // valor de enum DOCUMENT_TYPES, o '' si no se reconoce
  document_name: string;
  issued_at: string;              // 'YYYY-MM-DD' o ''
  expires_at: string;             // 'YYYY-MM-DD' o ''
  criticality: Criticality;
  issuer: string;
  policy_number: string;
  coverage: string;
  summary: string;
  confidence: number;             // 0..1
  fields_found: string[];         // claves con valor — para los sellos "✨ IA"
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  avatar_url: string | null;
  updated_at: string;
}

/** Respuesta de GET /api/profile: perfil editable + datos de cuenta de solo lectura. */
export interface ProfileResponse {
  profile: Profile;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string | null;
}

/** Metadatos de una API key — NUNCA incluye el secreto. */
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

/** Respuesta de creación: incluye el texto plano visible UNA sola vez. */
export interface ApiKeyCreated {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  plaintext: string;
}
