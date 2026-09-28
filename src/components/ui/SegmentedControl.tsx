"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { useControlled } from "./useControlled";

export type SegmentedControlOption = { value: string; label: ReactNode };

export type SegmentedControlProps = {
  /** Two to four options, one short word each. */
  options: SegmentedControlOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Accessible name of the group. */
  label?: string;
  disabled?: boolean;
  className?: string;
};

/** Mutually exclusive options side by side, to switch a view (e.g. ES / EN). */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  label,
  disabled,
  className,
}: SegmentedControlProps) {
  const [selected, setSelected] = useControlled(
    value,
    defaultValue ?? options[0]?.value ?? "",
    onChange,
  );

  return (
    <div
      className={cx("ld-seg", className)}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={cx("ld-seg-item", isSelected && "is-selected")}
            disabled={disabled}
            onClick={() => setSelected(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
