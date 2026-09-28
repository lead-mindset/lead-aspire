import { useTranslations } from "next-intl";
import { cx } from "./cx";

export type ProgressBarProps = {
  /** 0 to 100. */
  value: number;
  label?: string;
  className?: string;
};

/** Progress of a known task, in accent (LEAD violet). Always shows the percentage. */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const t = useTranslations("UI");
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));

  return (
    <div className={cx("ld-progress", className)}>
      <div className="ld-progress-head">
        {label && <span className="ld-progress-label">{label}</span>}
        <span className="ld-progress-value">{v}%</span>
      </div>
      <div
        className="ld-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-label={label ?? t("progress")}
      >
        <div className="ld-progress-fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
