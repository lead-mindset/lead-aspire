"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type TooltipProps = {
  /** One or two sentences. Never links or actions. */
  content: ReactNode;
  /** The trigger. Defaults to an info icon button. */
  children?: ReactNode;
  triggerLabel?: string;
  defaultOpen?: boolean;
  className?: string;
};

export function Tooltip({
  content,
  children,
  triggerLabel,
  defaultOpen = false,
  className,
}: TooltipProps) {
  const t = useTranslations("UI");
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const show = () => setOpen(true);
  const hide = () => {
    if (!defaultOpen) setOpen(false);
  };

  return (
    <span
      className={cx("ld-tip", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children ?? (
        <button
          type="button"
          className="ld-tip-trigger"
          aria-label={triggerLabel ?? t("moreInfo")}
          aria-describedby={id}
        >
          <Icon name="info" size={18} />
        </button>
      )}
      <span
        role="tooltip"
        id={id}
        className={cx("ld-tip-bubble", open && "is-open")}
      >
        {content}
      </span>
    </span>
  );
}
