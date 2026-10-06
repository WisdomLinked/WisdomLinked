export default function SetupProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={`${completed} of ${total} complete`}
        className="flex gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < completed ? 'bg-[#234C6A]' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs" aria-hidden>
        <span className="font-medium text-gray-700">
          {completed} of {total} complete
        </span>
        <span className="text-gray-500">{percent}%</span>
      </div>
    </div>
  );
}
