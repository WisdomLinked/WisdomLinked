import SegmentedProgressBar from '../profileCompletion/SegmentedProgressBar';

export default function SetupProgressBar({ completed, total }: { completed: number; total: number }) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const segments = Array.from({ length: total }, (_, i) => ({
    ratio: i < completed ? 1 : 0,
  }));

  return (
    <SegmentedProgressBar
      segments={segments}
      label="Setup progress"
      valueText={`${completed} of ${total} complete`}
      percentText={`${percent}%`}
      ariaValueNow={completed}
      ariaValueMax={total}
      ariaValueText={`${completed} of ${total} complete`}
    />
  );
}
