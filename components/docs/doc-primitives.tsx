import Link from 'next/link';
import { Info, Lightbulb, AlertTriangle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DocPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-base text-muted-foreground">{description}</p>
    </div>
  );
}

const calloutStyles = {
  info: { icon: Info, cls: 'border-primary/30 bg-accent/50 text-foreground' },
  tip: {
    icon: Lightbulb,
    cls: 'border-[var(--status-vigente-ring)]/30 bg-[var(--status-vigente-bg)] text-[var(--status-vigente-text)]',
  },
  warning: {
    icon: AlertTriangle,
    cls: 'border-[var(--status-por-vencer-ring)]/30 bg-[var(--status-por-vencer-bg)] text-[var(--status-por-vencer-text)]',
  },
} as const;

export function DocCallout({
  variant = 'info',
  children,
}: {
  variant?: keyof typeof calloutStyles;
  children: React.ReactNode;
}) {
  const { icon: Icon, cls } = calloutStyles[variant];
  return (
    <div className={cn('my-5 flex gap-3 rounded-xl border p-4 text-sm', cls)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="[&>p]:m-0">{children}</div>
    </div>
  );
}

export function DocSteps({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <ol className="my-6 flex flex-col gap-5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-foreground">{s.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <Icon size={22} className="text-primary" aria-hidden="true" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
