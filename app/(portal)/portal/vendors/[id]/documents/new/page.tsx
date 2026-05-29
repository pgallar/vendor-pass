import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePortalMember } from '@/lib/portal/membership';
import { PortalDocumentForm } from '@/components/vendor-pass/portal-document-form';

export default async function PortalNewDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/vendors/${id}/documents/new`);

  const role = await requirePortalMember(supabase, user.id, id);
  if (role !== 'uploader') notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-foreground">Subir documento</h1>
      <PortalDocumentForm vendorId={id} />
    </div>
  );
}
