import { cn } from '@/lib/utils';

type Props = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

const segmentColors: Record<number, string> = {
  0: 'bg-muted',
  1: 'bg-destructive',
  2: 'bg-yellow-400 dark:bg-yellow-500',
  3: 'bg-blue-400 dark:bg-blue-500',
  4: 'bg-green-500',
};

const labelColors: Record<number, string> = {
  0: 'text-muted-foreground',
  1: 'text-destructive',
  2: 'text-yellow-600 dark:text-yellow-400',
  3: 'text-blue-600 dark:text-blue-400',
  4: 'text-green-600 dark:text-green-400',
};

export function PasswordStrengthMeter({ score, label }: Props) {
  const color = segmentColors[score] ?? segmentColors[0];
  const textColor = labelColors[score] ?? labelColors[0];

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite" aria-label={`Fuerza de contraseña: ${label}`}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i <= score ? color : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className={cn('text-xs font-medium', textColor)}>{label}</p>
    </div>
  );
}
