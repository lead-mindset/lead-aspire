"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { THEME_STORAGE_KEY } from "@/components/theme/themeScript";
import { withBasePath } from "@/lib/basePath";
import styles from "./LoginForm.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export function LoginForm() {
  const locale = useLocale();
  const t = useTranslations("LoginPage");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
    } catch {
      setError(t("apiConnectionError"));
      setPending(false);
      return;
    }

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? t("error"));
      setPending(false);
      return;
    }

    // The backend resolves the user's city and group from their access.
    const { city_code } = (await response.json()) as { city_code: string };

    const { createClient } = await import("@/lib/supabase/client");
    const { error: sessionError } = await createClient().auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });

    if (sessionError) {
      setError(t("error"));
      setPending(false);
      return;
    }

    const destination = city_code === "NYC" ? "/new-york" : "/dashboard";
    window.location.assign(withBasePath(`/${locale}${destination}`));
  }

  return (
    <main className={styles.page}>
      <button type="button" className={styles.themeToggle} onClick={toggleTheme}>
        <span className={styles.themeToLight}>{t("themeToLight")}</span>
        <span className={styles.themeToDark}>{t("themeToDark")}</span>
      </button>
      <div className={styles.shell}>
        <section className={`dark ${styles.brandPanel}`} aria-label={t("brandLabel")}>
          <div className={styles.logo}>
            <Image src={withBasePath("/lead-mark.png")} alt="" width={72} height={48} className={styles.logoImage} />
            <div className={styles.logoText}>
              <span className={styles.logoName}>LEAD</span>
              <span className={styles.logoLabel}>{t("brandLine")}</span>
            </div>
          </div>

          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t("eyebrow")}</p>
            <h1 className={styles.heading}>
              {t("heading")}
              <span className={styles.headingAccent}>{t("headingAccent")}</span>
            </h1>
            <p className={styles.introText}>{t("intro")}</p>
          </div>

        </section>

        <section className={styles.formPanel}>
          <form className={styles.card} onSubmit={handleSubmit}>
            <header className={styles.cardHeader}>
              <h2 className={styles.cardHeading}>{t("welcome")}</h2>
              <p className={styles.cardIntro}>{t("formIntro")}</p>
            </header>

            <label className={styles.label} htmlFor="email">
              {t("emailLabel")}
            </label>
            <input
              className={styles.input}
              id="email"
              name="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
            />

            <label className={styles.label} htmlFor="password">
              {t("passwordLabel")}
            </label>
            <div className={styles.passwordRow}>
              <input
                className={styles.input}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
              />
              <button
                className={styles.showPassword}
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
              >
                {showPassword ? t("hidePassword") : t("showPassword")}
              </button>
            </div>

            {error && (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            )}

            <button
              className={styles.submit}
              type="submit"
              disabled={pending}
            >
              {pending ? t("submitting") : t("submit")}{" "}
              <span aria-hidden="true">→</span>
            </button>
            <p className={styles.support}>
              {t("support")}{" "}
              <a
                className={styles.supportLink}
                href="mailto:support@leadaspire.org"
              >
                {t("supportLink")}
              </a>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
