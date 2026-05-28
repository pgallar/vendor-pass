'use client';

import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { DocumentForm } from '@/components/vendor-pass/document-form';

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const vendorId = params.id;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Agregar documento"
          backHref={`/vendors/${vendorId}`}
          backLabel="Volver al proveedor"
          breadcrumbs={[
            { label: 'Proveedores', href: '/vendors' },
            { label: vendorId, href: `/vendors/${vendorId}` },
            { label: 'Nuevo documento' },
          ]}
        />
        <DocumentForm
          vendorId={vendorId}
          initial={{
            document_type: '',
            document_name: '',
            issued_at: '',
            expires_at: '',
            criticality: 'critical',
            file_url: '',
            file_hash: '',
            notes: '',
          }}
          submitLabel="Guardar documento"
          onCancel={() => router.push(`/vendors/${vendorId}`)}
        />
      </div>
    </AppShell>
  );
}
