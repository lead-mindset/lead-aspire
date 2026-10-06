"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { THEME_STORAGE_KEY } from "./themeScript";

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return "light";
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked (private mode): the theme still applies for this page.
  }
}

type ThemeToggleProps = {
  /** "icon": header icon button. "menu": full-width item with a label. */
  variant?: "icon" | "menu";
  className?: string;
};

/**
 * Switches between the design system's light and dark themes.
 * Icons and labels swap with CSS on <html data-theme>, so server and client
 * render the same markup.
 */
export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const t = useTranslations("Header");

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cx(
          "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-label text-ink hover:bg-primary-soft",
          className,
        )}
      >
        <span className="flex items-center gap-2 in-data-[theme=dark]:hidden">
          <Icon name="moon" size={18} />
          {t("darkTheme")}
        </span>
        <span className="hidden items-center gap-2 in-data-[theme=dark]:flex">
          <Icon name="sun" size={18} />
          {t("lightTheme")}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      className={cx("ld-header-icon", className)}
    >
      <span className="flex in-data-[theme=dark]:hidden">
        <Icon name="moon" size={20} />
      </span>
      <span className="hidden in-data-[theme=dark]:flex">
        <Icon name="sun" size={20} />
      </span>
    </button>
  );
}
