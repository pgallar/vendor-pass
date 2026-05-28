export type Criticality = 'critical' | 'normal';
export type DocumentStatus = 'vigente' | 'por_vencer' | 'vencido';
export type VendorStatus = 'ok' | 'atencion' | 'bloqueado';
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
}

export interface VendorWithStatus extends Vendor {
  status: VendorStatus;
  documents: (VendorDocument & { status: DocumentStatus })[];
}
