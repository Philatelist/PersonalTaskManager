import styles from "./ProgressRing.module.css";

interface ProgressRingProps {
  progress: number;
  size?: number;
}

export function ProgressRing({ progress, size = 32 }: ProgressRingProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const percent = Math.round(progress * 100);

  return (
    <span
      className={styles.ring}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size}>
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className={styles.progress}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </span>
  );
}
