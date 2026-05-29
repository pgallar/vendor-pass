import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { VendorStatus } from '@/lib/types';
import { PendingReviewsBadge } from './pending-reviews-badge';

export const VENDOR_DETAIL_TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'pasaporte', label: 'Pasaporte' },
  { key: 'portal', label: 'Portal' },
] as const;

export type VendorDetailTab = (typeof VENDOR_DETAIL_TABS)[number]['key'];

export function isVendorDetailTab(value: string | undefined): value is VendorDetailTab {
  return VENDOR_DETAIL_TABS.some(t => t.key === value);
}

export function VendorDetailTabBar({
  vendorId,
  activeTab,
  documentCount,
  status,
  pendingCount,
}: {
  vendorId: string;
  activeTab: VendorDetailTab;
  documentCount: number;
  status: VendorStatus;
  pendingCount: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del proveedor"
      className="flex items-center gap-1 p-1 bg-secondary rounded-xl overflow-x-auto"
    >
      {VENDOR_DETAIL_TABS.map(tab => {
        const active = tab.key === activeTab;
        const href = tab.key === 'resumen'
          ? `/vendors/${vendorId}`
          : `/vendors/${vendorId}?tab=${tab.key}`;

        return (
          <Link
            key={tab.key}
            id={`vendor-tab-${tab.key}`}
            href={href}
            role="tab"
            aria-selected={active}
            aria-controls={`vendor-panel-${tab.key}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-11',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.key === 'documentos' && (
              <span className="text-[10px] tabular-nums opacity-70">({documentCount})</span>
            )}
            {tab.key === 'resumen' && status !== 'ok' && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                aria-label="Requiere atención"
              />
            )}
            {tab.key === 'portal' && pendingCount > 0 && (
              <PendingReviewsBadge count={pendingCount} />
            )}
          </Link>
        );
      })}
    </div>
  );
}
