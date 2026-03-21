interface ProgressBarProps {
  /** 進捗値（0〜100） */
  value: number;
  className?: string;
}

export function ProgressBar({ value, className = "" }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`h-4 w-full overflow-hidden rounded-full bg-primary/20 ${className}`}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
