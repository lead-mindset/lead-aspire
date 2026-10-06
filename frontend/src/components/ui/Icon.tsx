import { cx } from "./cx";

const PATHS = {
  "arrow-left": ["M19 12H5", "M11 18l-6-6 6-6"],
  "arrow-right": ["M5 12h14", "M13 6l6 6-6 6"],
  "chevron-down": ["M6 9l6 6 6-6"],
  "chevron-right": ["M9 6l6 6-6 6"],
  "chevron-left": ["M15 6l-6 6 6 6"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  plus: ["M12 5v14", "M5 12h14"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  home: ["M4 11l8-7 8 7", "M6 9.5V20h12V9.5"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-4-4"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 7.5v.5"],
  user: [
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5",
  ],
  eye: [
    "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
  "eye-off": [
    "M3 3l18 18",
    "M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8",
    "M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6",
    "M9.9 9.9a3 3 0 0 0 4.2 4.2",
  ],
  alert: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5v5", "M12 16v.5"],
  "check-circle": [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    "M8 12.5l2.8 2.8L16 10",
  ],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  sun: [
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M12 2v2",
    "M12 20v2",
    "M4.9 4.9l1.4 1.4",
    "M17.7 17.7l1.4 1.4",
    "M2 12h2",
    "M20 12h2",
    "M4.9 19.1l1.4-1.4",
    "M17.7 6.3l1.4-1.4",
  ],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Accessible label. Without it the icon is decorative and hidden. */
  label?: string;
  className?: string;
};

/**
 * 24px outlined icon in currentColor, 2px stroke. For icons beyond this set
 * use Phosphor Icons (weight "regular"); do not mix icon libraries.
 */
export function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  label,
  className,
}: IconProps) {
  return (
    <svg
      className={cx("ld-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
