"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Footer } from "@/components/brand/Footer";
import { THEME_STORAGE_KEY } from "@/components/theme/themeScript";
import { Link, usePathname } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
// Same look as the New York app; lab-only pieces live in nyc.module.css.
import styles from "../../new-york/_aspire/aspire.module.css";
import { COPILOT_CHAT_URL, STEPS, STEP_KEYS } from "./data";
import { useLabProgress } from "./progress";
import lab from "./nyc.module.css";

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the theme still applies for this page.
  }
}

export function LabShell({ children }: { children: ReactNode }) {
  const t = useTranslations("NycSchools");
  const pathname = usePathname();
  const { completed } = useLabProgress();

  const navClass = (href: string, extra = "") =>
    [styles.navItem, extra, pathname === href ? styles.navItemActive : ""].filter(Boolean).join(" ");

  return (
    <div className={styles.shell}>
      <aside className={`dark ${styles.sidebar}`}>
        <div className={styles.brand}>
          <Image src={withBasePath("/lead-mark.png")} alt="" width={48} height={34} className={styles.brandMark} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>LEAD</span>
            <span className={styles.brandSub}>{t("brandSub")}</span>
          </div>
        </div>

        <nav aria-label={t("nav.label")} style={{ display: "contents" }}>
          <Link
            href="/nycschools"
            className={navClass("/nycschools")}
            aria-current={pathname === "/nycschools" ? "page" : undefined}
          >
            {t("nav.home")}
          </Link>
          <span className={styles.navSection}>{t("nav.journey")}</span>
          {STEP_KEYS.map((key) => {
            const href = `/nycschools/${key}`;
            return (
              <Link
                key={key}
                href={href}
                className={navClass(href, styles.navPhase)}
                aria-current={pathname === href ? "page" : undefined}
              >
                <span className={`${styles.navNum} ${STEPS[key].tone === "red" ? styles.toneRed : styles.tonePurple}`}>
                  {STEPS[key].num}
                </span>
                <span className={styles.navLabel}>{t(`steps.${key}.title`)}</span>
                {completed.includes(key) && (
                  <span className={styles.navCheck} aria-label={t("nav.completed")}>
                    ✓
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarSpacer} />

        <div className={lab.setup}>
          <span className={lab.setupTitle}>{t("setup.title")}</span>
          <p className={lab.setupBody}>{t("setup.body")}</p>
          <a href={COPILOT_CHAT_URL} target="_blank" rel="noopener noreferrer" className={styles.pillButton}>
            {t("setup.open")}
          </a>
        </div>
        <button type="button" className={styles.themeToggle} onClick={toggleTheme}>
          <span className={styles.themeToLight}>{t("theme.toLight")}</span>
          <span className={styles.themeToDark}>{t("theme.toDark")}</span>
        </button>
      </aside>

      <div className={styles.main}>
        {/* The root layout already provides <main>. */}
        <div>{children}</div>
        <div className={styles.footer}>
          <Footer />
        </div>
      </div>
    </div>
  );
}
