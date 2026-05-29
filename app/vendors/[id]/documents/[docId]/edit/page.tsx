import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { DocumentEventTimeline } from '@/components/vendor-pass/document-event-timeline';
import { RenewDocumentButton } from '@/components/vendor-pass/renew-document-button';
import { EditDocumentClient } from './edit-document-client';
import { documentStatus } from '@/lib/status';
import type { VendorDocument } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: vendorId, docId } = await params;
  const sb = await createClient();
  const { data: vendor } = await sb.from('vendors').select('id,name').eq('id', vendorId).single();
  if (!vendor) notFound();

  const { data: doc } = await sb.from('documents').select('*').eq('id', docId).eq('vendor_id', vendorId).single();
  if (!doc) notFound();

  const d = doc as VendorDocument;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Editar documento"
          backHref={`/vendors/${vendorId}`}
          backLabel="Volver al proveedor"
          breadcrumbs={[
            { label: 'Proveedores', href: '/vendors' },
            { label: vendor.name, href: `/vendors/${vendorId}` },
            { label: 'Editar documento' },
          ]}
        />
        <EditDocumentClient
          vendorId={vendorId}
          documentId={docId}
          initial={{
            document_type: d.document_type,
            document_name: d.document_name,
            issued_at: d.issued_at,
            expires_at: d.expires_at,
            criticality: d.criticality,
            file_url: d.file_url ?? '',
            file_hash: d.file_hash ?? '',
            notes: d.notes ?? '',
          }}
        />

        {d.lifecycle_status === 'anchored' &&
          documentStatus(d) !== 'vigente' &&
          !d.superseded_by_document_id && (
            <RenewDocumentButton documentId={docId} vendorId={vendorId} />
          )}

        <DocumentEventTimeline documentId={docId} />
      </div>
    </AppShell>
  );
}
