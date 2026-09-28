"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonClasses } from "@/components/ui/Button";
import { Header as UIHeader } from "@/components/ui/Header";
import { Icon } from "@/components/ui/Icon";
import { Link, usePathname } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";

const NAV = [
  { key: "home", href: "/" },
  { key: "dashboard", href: "/dashboard" },
  { key: "designSystem", href: "/design-system" },
] as const;

/** App header: the design system Header wired to this app's routes and locales. */
export function Header() {
  const t = useTranslations("Header");
  const pathname = usePathname();

  const links = NAV.map(({ key, href }) => ({
    label: t(key),
    href,
    active: href === "/" ? pathname === "/" : pathname.startsWith(href),
  }));

  return (
    <>
      <UIHeader
        logoSrc={withBasePath("/lead-mark.png")}
        links={links}
        navLabel={t("nav")}
        cta={
          <>
            <ThemeToggle className="hidden sm:flex" />
            <LocaleSwitcher />
            <Link
              href="/login"
              className={buttonClasses({
                variant: "secondary",
                size: "sm",
                className: "hidden sm:inline-flex",
              })}
            >
              {t("login")}
            </Link>
            {/* Under 640px the design system hides the nav; the app provides this menu. */}
            <details className="relative sm:hidden">
              <summary
                className="ld-header-icon list-none [&::-webkit-details-marker]:hidden"
                aria-label={t("menu")}
              >
                <Icon name="menu" size={20} />
              </summary>
              <ul className="absolute right-0 z-10 mt-2 flex w-48 flex-col rounded-md border border-line bg-surface-raised p-2 [box-shadow:var(--shadow-md)]">
                {[
                  ...links,
                  { label: t("login"), href: "/login", active: false },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={link.active ? "page" : undefined}
                      className="block rounded-sm px-3 py-2 text-label text-ink hover:bg-primary-soft aria-[current=page]:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li className="mt-1 border-t border-line pt-1">
                  <ThemeToggle variant="menu" />
                </li>
              </ul>
            </details>
          </>
        }
      />
      {/* gradient-logo: a thin rule echoing the logo mark. */}
      <div className="gradient-logo h-[2px]" aria-hidden="true" />
    </>
  );
}
