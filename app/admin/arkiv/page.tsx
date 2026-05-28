import { AppShell } from '@/components/vendor-pass/app-shell';
import { PageHeader } from '@/components/vendor-pass/page-header';
import { ArkivAuditPanel } from '@/components/vendor-pass/arkiv-audit-panel';

export const dynamic = 'force-dynamic';

export default function AdminArkivPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Auditoría Arkiv"
          description="Paridad entre Postgres y entidades en Arkiv Network"
          backHref="/"
          backLabel="Volver al dashboard"
        />
        <ArkivAuditPanel />
      </div>
    </AppShell>
  );
}
