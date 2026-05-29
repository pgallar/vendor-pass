import type { Metadata } from 'next';
import { DocsHeader } from '@/components/docs/docs-header';
import { DocsSidebar } from '@/components/docs/docs-sidebar';

export const metadata: Metadata = {
  title: 'Documentación — VendorPass',
  description:
    'Guía de uso de VendorPass: proveedores, documentos, anclaje en Arkiv y pasaporte de cumplimiento.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DocsHeader />
      <div className="mx-auto flex max-w-7xl gap-10 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">
            <DocsSidebar />
          </div>
        </aside>
        <main className="min-w-0 max-w-3xl flex-1">{children}</main>
      </div>
    </div>
  );
}
