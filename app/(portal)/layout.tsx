import { PortalShell } from '@/components/vendor-pass/portal-shell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
