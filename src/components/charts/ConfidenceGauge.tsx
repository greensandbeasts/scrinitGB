interface ConfidenceGaugeProps {
  score: number;
  level: 'low' | 'moderate' | 'strong' | 'high';
  label: string;
}

const levelColors = {
  low: { stroke: '#fa5a3c', bg: 'bg-coral-50', text: 'text-coral-600' },
  moderate: { stroke: '#f2b22a', bg: 'bg-accent-50', text: 'text-accent-600' },
  strong: { stroke: '#02a4f0', bg: 'bg-sea-50', text: 'text-sea-600' },
  high: { stroke: '#22c564', bg: 'bg-forest-50', text: 'text-forest-600' },
};

export function ConfidenceGauge({ score, level, label }: ConfidenceGaugeProps) {
  const colors = levelColors[level];
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="#eef0f4"
            strokeWidth="10"
          />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold tabular-nums ${colors.text}`}>{score}</span>
          <span className="text-xs text-ink-400">/ 100</span>
        </div>
      </div>
      <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {label}
      </div>
    </div>
  );
}
