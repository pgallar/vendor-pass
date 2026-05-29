import { getInitials } from '@/lib/profile/validation';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, email, size = 40, className }: AvatarProps) {
  const dimension = { width: size, height: size };
  if (src) {
    // URL externa de S3; <img> evita configurar dominios de next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        style={dimension}
        className={cn('rounded-full object-cover bg-secondary shrink-0', className)}
      />
    );
  }
  return (
    <span
      style={dimension}
      className={cn(
        'rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-semibold shrink-0',
        className,
      )}
    >
      <span style={{ fontSize: size * 0.4 }}>{getInitials(name, email)}</span>
    </span>
  );
}
