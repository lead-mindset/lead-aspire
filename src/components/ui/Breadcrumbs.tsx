import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type BreadcrumbItem = { label: ReactNode; href?: string };

export type BreadcrumbsProps = {
  /** First item gets a home icon; the last is the current page. */
  items: BreadcrumbItem[];
  label?: string;
  className?: string;
};

/** Use from the third level down; skip on top-level pages. */
export function Breadcrumbs({ items, label, className }: BreadcrumbsProps) {
  const t = useTranslations("UI");

  return (
    <nav
      className={cx("ld-crumbs", className)}
      aria-label={label ?? t("breadcrumbs")}
    >
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={index}>
              {last ? (
                <span aria-current="page" className="ld-crumb is-current">
                  {item.label}
                </span>
              ) : (
                <a href={item.href ?? "#"} className="ld-crumb">
                  {index === 0 && <Icon name="home" size={16} />}
                  {item.label}
                </a>
              )}
              {!last && (
                <Icon name="chevron-right" size={14} className="ld-crumb-sep" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
