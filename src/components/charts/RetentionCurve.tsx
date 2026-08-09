import type { RetentionPoint, DropOffPoint } from '@/lib/analytics';

interface RetentionCurveProps {
  data: RetentionPoint[];
  dropOffs: DropOffPoint[];
}

export function RetentionCurve({ data, dropOffs }: RetentionCurveProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-ink-400">
        No reading data yet
      </div>
    );
  }

  const maxPercentage = 100;
  const dropOffPages = new Set(dropOffs.map((d) => d.page));

  return (
    <div>
      <div className="flex items-end gap-1.5 h-48 mb-3">
        {data.map((point) => {
          const isDropOff = dropOffPages.has(point.page);
          const heightRatio = point.percentage / maxPercentage;
          return (
            <div key={point.page} className="flex-1 flex flex-col items-center gap-1.5 group relative">
              <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-ink-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                  <div className="font-semibold">Page {point.page}</div>
                  <div className="text-ink-300">{point.readers} readers · {point.percentage}%</div>
                </div>
              </div>
              <div
                className={`w-full rounded-t-md transition-all duration-700 origin-bottom animate-grow-bar ${isDropOff ? 'bg-gradient-to-t from-coral-400 to-coral-300' : 'bg-gradient-to-t from-accent-500 to-accent-300'}`}
                style={{ height: `${Math.max(heightRatio * 100, 2)}%` }}
              />
              <span className="text-[10px] text-ink-300 font-mono">{point.page}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-ink-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent-400" /> Retained
          </span>
          {dropOffs.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-coral-400" /> Drop-off
            </span>
          )}
        </div>
        <span>{data.length} pages</span>
      </div>
    </div>
  );
}
