interface RatingBreakdownProps {
  ratings: { label: string; value: number; key: string }[];
  max?: number;
}

export function RatingBreakdown({ ratings, max = 10 }: RatingBreakdownProps) {
  return (
    <div className="space-y-3">
      {ratings.map((rating) => {
        const percentage = (rating.value / max) * 100;
        return (
          <div key={rating.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink-600 dark:text-ink-300">{rating.label}</span>
              <span className="text-sm font-bold text-ink-900 dark:text-white tabular-nums">{rating.value.toFixed(1)}</span>
            </div>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-500 transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
