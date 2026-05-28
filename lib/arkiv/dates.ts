const MS_PER_DAY = 86_400_000;

export function daysUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  const expires = new Date(expiresAt + 'T00:00:00Z');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((expires.getTime() - today.getTime()) / MS_PER_DAY);
}

export function isExpiringWithinDays(expiresAt: string, days: number, now: Date = new Date()): boolean {
  const diff = daysUntilExpiry(expiresAt, now);
  return diff >= 0 && diff <= days;
}
