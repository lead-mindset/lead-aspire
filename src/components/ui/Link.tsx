import type { AnchorHTMLAttributes } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/** Link classes, for Next/next-intl <Link> inside the app: className={linkClasses()}. */
export function linkClasses(className?: string) {
  return cx("ld-link", className);
}

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  iconLeft?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
};

/**
 * Plain anchor, always underlined. Use it for external links and to move
 * between LEAD apps (full path, full page load). Inside this app, use the
 * next-intl <Link> from @/i18n/navigation with linkClasses().
 */
export function Link({
  iconLeft,
  iconRight,
  disabled,
  className,
  children,
  href,
  ...rest
}: LinkProps) {
  return (
    <a
      {...rest}
      href={disabled ? undefined : href}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : rest.tabIndex}
      className={cx("ld-link", disabled && "is-disabled", className)}
    >
      {iconLeft && <Icon name={iconLeft} size={16} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={16} />}
    </a>
  );
}
