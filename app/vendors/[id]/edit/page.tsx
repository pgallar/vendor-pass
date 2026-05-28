import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { VendorForm } from '@/components/vendor-pass/vendor-form';
import type { Vendor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: vendor } = await sb.from('vendors').select('*').eq('id', id).single();
  if (!vendor) notFound();

  const v = vendor as Vendor;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Editar proveedor"
          backHref={`/vendors/${id}`}
          backLabel="Volver al proveedor"
          breadcrumbs={[
            { label: 'Proveedores', href: '/vendors' },
            { label: v.name, href: `/vendors/${id}` },
            { label: 'Editar' },
          ]}
        />
        <VendorForm
          vendorId={id}
          initial={{
            name: v.name,
            category: v.category ?? '',
            owner_name: v.owner_name ?? '',
            owner_email: v.owner_email ?? '',
            area: v.area ?? '',
            notes: v.notes ?? '',
          }}
        />
      </div>
    </AppShell>
  );
}
