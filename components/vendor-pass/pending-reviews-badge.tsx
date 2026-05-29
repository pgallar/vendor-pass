export function PendingReviewsBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-semibold min-w-5 h-5 px-1.5">
      {count}
    </span>
  );
}
