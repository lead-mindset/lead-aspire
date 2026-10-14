"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import { ChatPanel } from "./chat";
import styles from "./dallas.module.css";

/**
 * Floating Dallas coach: talks to the Dallas Foundry agent through
 * /api/dallas/coach/chat (same look as the New York coach).
 */
export function CoachWidget({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Dallas.coach");

  return (
    <div className={styles.coachDock}>
      {/* Hidden, not unmounted, so the conversation survives closing it. */}
      <ChatPanel
        path="/coach/chat"
        hidden={!open}
        onClose={() => setOpen(false)}
        labels={{
          title: t("title"),
          subtitle: t("subtitle"),
          greeting: t("greeting"),
          thinking: t("thinking"),
          error: t("error"),
          placeholder: t("placeholder"),
          inputLabel: t("inputLabel"),
          send: t("send"),
          close: t("close"),
        }}
      />
      <button
        type="button"
        className={styles.coachLauncher}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? t("close") : t("open")}
        title={t("open")}
      >
        <Image
          src={withBasePath("/dashboard/astronaut.png")}
          alt=""
          width={64}
          height={64}
        />
      </button>
    </div>
  );
}
