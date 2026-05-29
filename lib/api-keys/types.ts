import type { Criticality } from '@/lib/types';

export type VendorInput = {
  name: string;
  category?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  area?: string | null;
  notes?: string | null;
};

export type DocumentInput = {
  vendor_id: string;
  document_type: string;
  document_name: string;
  issued_at: string;
  expires_at: string;
  criticality: Criticality;
  file_url?: string | null;
  file_hash?: string | null;
  notes?: string | null;
};
