import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LandingHeader } from '@/components/landing/landing-header';
import { LandingSections } from '@/components/landing/landing-sections';
import { LandingFooter } from '@/components/landing/landing-footer';

export const metadata: Metadata = {
  title: 'VendorPass — Cumplimiento de proveedores verificable en blockchain',
  description:
    'Centralizá los documentos de tus proveedores, anclalos en Arkiv Network y compartí un pasaporte de cumplimiento verificable e inmutable.',
};

export default async function LandingPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader authenticated={!!user} />
      <main className="flex-1">
        <LandingSections />
      </main>
      <LandingFooter />
    </div>
  );
}
