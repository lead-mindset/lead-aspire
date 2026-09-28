import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link as IntlLink } from "@/i18n/navigation";
import { cx } from "./cx";
import { Icon } from "./Icon";

export type HeaderLink = { label: string; href: string; active?: boolean };

export type HeaderProps = {
  /** Use the lead-mark asset (already prefixed with withBasePath). */
  logoSrc?: string;
  homeHref?: string;
  /** In-app links (locale-aware). Mark exactly one as active. */
  links?: HeaderLink[];
  /** Display name of the signed-in user; shows the avatar button. */
  user?: string;
  /** Extra actions on the right, e.g. a Button or the locale switcher. */
  cta?: ReactNode;
  navLabel?: string;
  searchLabel?: string;
  /** Shows the search button when provided (template addition). */
  onSearch?: () => void;
  className?: string;
};

/**
 * Top bar shared by every LEAD app. Under 640px the nav hides: the app must
 * provide a menu for it (see components/brand/Header).
 */
export function Header({
  logoSrc,
  homeHref = "/",
  links = [],
  user,
  cta,
  navLabel,
  searchLabel,
  onSearch,
  className,
}: HeaderProps) {
  const t = useTranslations("UI");

  return (
    <header className={cx("ld-header", className)}>
      <IntlLink className="ld-header-brand" href={homeHref}>
        {logoSrc && (
          <Image src={logoSrc} alt="" width={54} height={32} priority />
        )}
        <span className="ld-header-word">{t("brandName")}</span>
      </IntlLink>
      <nav className="ld-header-nav" aria-label={navLabel ?? t("mainNav")}>
        {links.map((link) => (
          <IntlLink
            key={link.href}
            href={link.href}
            className={cx("ld-header-link", link.active && "is-active")}
            aria-current={link.active ? "page" : undefined}
          >
            {link.label}
          </IntlLink>
        ))}
      </nav>
      <div className="ld-header-actions">
        {onSearch && (
          <button
            type="button"
            className="ld-header-icon"
            aria-label={searchLabel ?? t("search")}
            onClick={onSearch}
          >
            <Icon name="search" size={20} />
          </button>
        )}
        {user && (
          <button type="button" className="ld-header-user" aria-label={user}>
            <span className="ld-avatar">{user.slice(0, 1).toUpperCase()}</span>
            <Icon name="chevron-down" size={16} />
          </button>
        )}
        {cta}
      </div>
    </header>
  );
}
