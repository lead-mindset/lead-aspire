import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "gradient";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonStyle = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
};

/**
 * Button classes, for links that must look like a button:
 * <Link href="/login" className={buttonClasses()}>…</Link>
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className,
}: ButtonStyle = {}) {
  return cx(
    "ld-btn",
    `ld-btn-${variant}`,
    `ld-btn-${size}`,
    iconOnly && "ld-btn-icon",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the one action of the view. gradient: marketing only, never in app UI. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  /** Icon-only button. Requires aria-label. */
  iconOnly?: IconName;
};

export function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  iconOnly,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({
        variant,
        size,
        iconOnly: Boolean(iconOnly),
        className,
      })}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={18} />}
      {iconOnly ? <Icon name={iconOnly} size={18} /> : children}
      {iconRight && <Icon name={iconRight} size={18} />}
    </button>
  );
}
