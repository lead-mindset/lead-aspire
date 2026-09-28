"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { useControlled } from "./useControlled";

export type ToggleProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Always give a visible label. */
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/** On/off switch that applies immediately. In forms with a save step, use a checkbox. */
export function Toggle({
  checked,
  defaultChecked = false,
  onChange,
  label,
  disabled,
  className,
}: ToggleProps) {
  const id = useId();
  const [on, setOn] = useControlled(checked, defaultChecked, onChange);

  return (
    <label
      className={cx("ld-toggle", disabled && "is-disabled", className)}
      htmlFor={id}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={cx("ld-toggle-track", on && "is-on")}
        onClick={() => setOn(!on)}
      >
        <span className="ld-toggle-knob">
          <Icon name={on ? "check" : "x"} size={12} strokeWidth={3} />
        </span>
      </button>
      {label && <span className="ld-toggle-label">{label}</span>}
    </label>
  );
}
