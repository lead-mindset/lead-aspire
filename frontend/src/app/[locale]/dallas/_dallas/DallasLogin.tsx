"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/auth/LoginForm.module.css";
import { THEME_STORAGE_KEY } from "@/components/theme/themeScript";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";
import { API_URL, type DallasTeam } from "./student";

type Step = "credentials" | "profile";

type Props = {
  /** "profile": signed in already but no team yet (e.g. after a refresh). */
  initialStep: Step;
  /** The server could not reach the backend; show a notice above the form. */
  unavailable?: boolean;
};

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

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Dallas login on one screen. Step 1: email + event code; the backend creates
 * the account on first use and returns a Supabase session, stored here with
 * setSession. Step 2 (first login only): name and team, saved once.
 */
export function DallasLogin({ initialStep, unavailable }: Props) {
  const locale = useLocale();
  const t = useTranslations("DallasLogin");
  const [step, setStep] = useState<Step>(initialStep);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(() =>
    unavailable ? t("errors.unavailable") : "",
  );
  const [teams, setTeams] = useState<DallasTeam[] | null>(null);

  const goToDashboard = () =>
    window.location.assign(withBasePath(`/${locale}/dallas`));

  useEffect(() => {
    if (step !== "profile") return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/dallas/teams`, {
          headers: await authHeaders(),
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { teams: DallasTeam[] };
        if (!cancelled) setTeams(body.teams);
      } catch {
        if (!cancelled) setError(t("errors.teams"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, t]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/dallas/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "")
            .trim()
            .toLowerCase(),
          event_code: String(form.get("eventCode") ?? "").trim(),
        }),
      });
    } catch {
      setError(t("errors.connection"));
      setPending(false);
      return;
    }

    if (!response.ok) {
      setError(
        response.status === 503
          ? t("errors.busy")
          : response.status === 422
            ? t("errors.invalidEmail")
            : t("errors.invalid"),
      );
      setPending(false);
      return;
    }

    const session = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      needs_profile: boolean;
    };
    const { error: sessionError } = await createClient().auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (sessionError) {
      setError(t("errors.invalid"));
      setPending(false);
      return;
    }

    if (session.needs_profile) {
      setStep("profile");
      setPending(false);
    } else {
      goToDashboard();
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/dallas/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          first_name: String(form.get("firstName") ?? ""),
          last_name: String(form.get("lastName") ?? ""),
          team_id: Number(form.get("team")),
        }),
      });
    } catch {
      setError(t("errors.connection"));
      setPending(false);
      return;
    }

    // 409: the team was already saved (e.g. from another tab); the dashboard shows it.
    if (response.ok || response.status === 409) {
      goToDashboard();
      return;
    }
    if (response.status === 401 || response.status === 403) {
      setStep("credentials");
      setError(t("errors.sessionExpired"));
    } else {
      setError(t("errors.profile"));
    }
    setPending(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    setStep("credentials");
    setError("");
    setTeams(null);
  }

  return (
    <main className={styles.page}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
      >
        <span className={styles.themeToLight}>{t("themeToLight")}</span>
        <span className={styles.themeToDark}>{t("themeToDark")}</span>
      </button>
      <div className={styles.shell}>
        <section
          className={`dark ${styles.brandPanel}`}
          aria-label={t("brandLabel")}
        >
          <div className={styles.logo}>
            <Image
              src={withBasePath("/lead-mark.png")}
              alt=""
              width={72}
              height={48}
              className={styles.logoImage}
            />
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
          {/* Distinct keys: without them React reuses the Step 1 inputs for
              Step 2, and the typed email and code show up as the names. */}
          {step === "credentials" ? (
            <form key="credentials" className={styles.card} onSubmit={signIn}>
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
                required
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
              />

              <label className={styles.label} htmlFor="eventCode">
                {t("codeLabel")}
              </label>
              <input
                className={styles.input}
                id="eventCode"
                name="eventCode"
                type="text"
                required
                placeholder={t("codePlaceholder")}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />

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
            </form>
          ) : (
            <form key="profile" className={styles.card} onSubmit={saveProfile}>
              <header className={styles.cardHeader}>
                <h2 className={styles.cardHeading}>{t("profile.heading")}</h2>
                <p className={styles.cardIntro}>{t("profile.intro")}</p>
              </header>

              <label className={styles.label} htmlFor="firstName">
                {t("profile.firstName")}
              </label>
              <input
                className={styles.input}
                id="firstName"
                name="firstName"
                required
                maxLength={80}
                autoComplete="given-name"
              />

              <label className={styles.label} htmlFor="lastName">
                {t("profile.lastName")}
              </label>
              <input
                className={styles.input}
                id="lastName"
                name="lastName"
                required
                maxLength={80}
                autoComplete="family-name"
              />

              <label className={styles.label} htmlFor="team">
                {t("profile.team")}
              </label>
              <select
                className={styles.input}
                id="team"
                name="team"
                required
                defaultValue=""
                disabled={!teams}
              >
                <option value="" disabled>
                  {teams
                    ? t("profile.teamPlaceholder")
                    : t("profile.teamsLoading")}
                </option>
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <p className={styles.cardIntro}>{t("profile.teamFinal")}</p>

              {error && (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              )}

              <button
                className={styles.submit}
                type="submit"
                disabled={pending || !teams}
              >
                {pending ? t("profile.saving") : t("profile.submit")}{" "}
                <span aria-hidden="true">→</span>
              </button>
              <p className={styles.support}>
                {t("profile.notYou")}{" "}
                <button
                  type="button"
                  className={styles.supportLink}
                  onClick={signOut}
                >
                  {t("profile.signOut")}
                </button>
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
