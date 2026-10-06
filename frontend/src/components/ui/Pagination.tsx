"use client";

import { useTranslations } from "next-intl";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { useControlled } from "./useControlled";

export type PaginationProps = {
  /** Show only when there is more than one page. For more than 7, pass a window. */
  total: number;
  page?: number;
  defaultPage?: number;
  onChange?: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  label?: string;
  className?: string;
};

export function Pagination({
  total,
  page,
  defaultPage = 1,
  onChange,
  prevLabel,
  nextLabel,
  label,
  className,
}: PaginationProps) {
  const t = useTranslations("UI");
  const [current, setCurrent] = useControlled(page, defaultPage, onChange);
  const pages = Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);

  return (
    <nav
      className={cx("ld-pager", className)}
      aria-label={label ?? t("pagination")}
    >
      <button
        type="button"
        className="ld-pager-step"
        disabled={current <= 1}
        onClick={() => setCurrent(current - 1)}
      >
        <Icon name="chevron-left" size={16} />
        {prevLabel ?? t("previous")}
      </button>
      {pages.map((n) => (
        <button
          key={n}
          type="button"
          className={cx("ld-pager-page", n === current && "is-current")}
          aria-current={n === current ? "page" : undefined}
          onClick={() => setCurrent(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className="ld-pager-step"
        disabled={current >= total}
        onClick={() => setCurrent(current + 1)}
      >
        {nextLabel ?? t("next")}
        <Icon name="chevron-right" size={16} />
      </button>
    </nav>
  );
}
