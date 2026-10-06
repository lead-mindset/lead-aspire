"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Footer } from "@/components/brand/Footer";
import { THEME_STORAGE_KEY } from "@/components/theme/themeScript";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { COACH_ENABLED } from "@/lib/features";
import { createClient } from "@/lib/supabase/client";
import { initialsFrom, useAspire } from "./AspireProvider";
import { CoachWidget } from "./CoachWidget";
import { DocViewer } from "./DocViewer";
import { SubmitDialog } from "./SubmitDialog";
import { WhiteboardDialog } from "./WhiteboardDialog";
import { PHASES, PHASE_KEYS } from "./data";
import styles from "./aspire.module.css";

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

export function AspireShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Aspire");
  const pathname = usePathname();
  const router = useRouter();
  const { viewer, completed } = useAspire();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navClass = (href: string, extra = "") =>
    [styles.navItem, extra, pathname === href ? styles.navItemActive : ""].filter(Boolean).join(" ");

  return (
    <div className={styles.shell} data-aspire-shell>
      <aside className={`dark ${styles.sidebar}`}>
        <div className={styles.brand}>
          <Image src={withBasePath("/lead-mark.png")} alt="" width={48} height={34} className={styles.brandMark} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>LEAD</span>
            <span className={styles.brandSub}>{t("brandSub")}</span>
          </div>
        </div>

        <nav aria-label={t("nav.label")} style={{ display: "contents" }}>
          <Link href="/new-york" className={navClass("/new-york")} aria-current={pathname === "/new-york" ? "page" : undefined}>
            {t("nav.home")}
          </Link>
          <span className={styles.navSection}>{t("nav.journey")}</span>
          {PHASE_KEYS.map((key) => {
            const href = `/new-york/${key}`;
            const done = completed.includes(key);
            return (
              <Link
                key={key}
                href={href}
                className={navClass(href, styles.navPhase)}
                aria-current={pathname === href ? "page" : undefined}
              >
                <span className={`${styles.navNum} ${PHASES[key].tone === "red" ? styles.toneRed : styles.tonePurple}`}>
                  {PHASES[key].num}
                </span>
                <span className={styles.navLabel}>{t(`phases.${key}.title`)}</span>
                {done && (
                  <span className={styles.navCheck} aria-label={t("nav.completed")}>
                    ✓
                  </span>
                )}
              </Link>
            );
          })}
          {viewer.isOrganizer && (
            <>
              <span className={styles.navSection}>{t("nav.organizers")}</span>
              <Link
                href="/new-york/projects"
                className={navClass("/new-york/projects")}
                aria-current={pathname === "/new-york/projects" ? "page" : undefined}
              >
                {t("nav.projects")}
              </Link>
            </>
          )}
        </nav>

        <div className={styles.sidebarSpacer} />


        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            {initialsFrom(viewer.email)}
          </span>
          <div className={styles.userText}>
            <span className={styles.userName} title={viewer.email}>
              {viewer.email}
            </span>
            <span className={styles.userMeta}>
              {viewer.isOrganizer
                ? t("user.organizer")
                : t("user.meta", { team: viewer.teamName ?? t("team.fallbackName") })}
            </span>
          </div>
          <button type="button" className={styles.signOut} onClick={signOut}>
            {t("user.signOut")}
          </button>
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

      {COACH_ENABLED && <CoachWidget />}
      <DocViewer />
      <SubmitDialog />
      <WhiteboardDialog />
    </div>
  );
}
