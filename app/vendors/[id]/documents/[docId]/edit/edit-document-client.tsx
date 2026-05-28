'use client';

import { useRouter } from 'next/navigation';
import { DocumentForm, type DocumentFormState } from '@/components/vendor-pass/document-form';

export function EditDocumentClient({
  vendorId,
  documentId,
  initial,
}: {
  vendorId: string;
  documentId: string;
  initial: DocumentFormState;
}) {
  const router = useRouter();
  return (
    <DocumentForm
      vendorId={vendorId}
      documentId={documentId}
      initial={initial}
      submitLabel="Guardar cambios"
      onCancel={() => router.push(`/vendors/${vendorId}`)}
    />
  );
}
