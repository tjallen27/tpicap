export function LoadingSkeleton() {
  return (
    <div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} data-testid="skeleton-row" className="skeleton-row" />
      ))}
    </div>
  );
}
