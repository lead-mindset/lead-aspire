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
  const [teamId, setTeamId] = useState("");
  const selectedTeam = teams?.find((team) => String(team.id) === teamId);

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
    setTeamId("");
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
          className={`dark ${styles.brandPanel} ${styles.dallasBrandPanel}`}
          aria-label={t("brandLabel")}
        >
          <Image
            src={withBasePath("/dallas/login-background.png")}
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
            className={styles.dallasBackground}
            priority
          />
          <div className={styles.logo}>
            <Image
              src={withBasePath("/dallas/lead-mark.png")}
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
              {t("heading-foot")}
            </h1>

            <p className={styles.introText}>{t("intro")}</p>
          </div>
          <div className={styles.featureList}>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="3" />
                  <circle cx="5.5" cy="10" r="2.25" />
                  <circle cx="18.5" cy="10" r="2.25" />
                  <path d="M6.5 19c.35-3 2.25-4.75 5.5-4.75s5.15 1.75 5.5 4.75M2.5 18c.2-2.05 1.25-3.25 3-3.25 1.05 0 1.85.4 2.4 1.15M21.5 18c-.2-2.05-1.25-3.25-3-3.25" />
                </svg>
              </span>
              <span>
                <strong>{t("features.team.title")}</strong>
                <small>{t("features.team.body")}</small>
              </span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8.75 15.5C7.2 14.4 6.25 12.6 6.25 10.6A5.75 5.75 0 0 1 12 4.85a5.75 5.75 0 0 1 5.75 5.75c0 2- .95 3.8-2.5 4.9-.7.5-1.1 1.25-1.1 2.1h-4.3c0-.85-.4-1.6-1.1-2.1Z" />
                  <path d="M10 20h4M10.5 17.7h3" />
                </svg>
              </span>
              <span>
                <strong>{t("features.challenge.title")}</strong>
                <small>{t("features.challenge.body")}</small>
              </span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 19V13M12 19V8M19 19V4" />
                </svg>
              </span>
              <span>
                <strong>{t("features.recommendation.title")}</strong>
                <small>{t("features.recommendation.body")}</small>
              </span>
            </div>
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

              <div className={styles.nameRow}>
                <div>
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
                </div>
                <div>
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
                </div>
              </div>

              <label className={styles.label} htmlFor="team">
                {t("profile.team")}
              </label>
              <select
                className={styles.input}
                id="team"
                name="team"
                required
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
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
              <p className={styles.teamNote}>
                <span className={styles.teamNoteIcon} aria-hidden="true">
                  i
                </span>
                {t("profile.teamFinal")}
              </p>

              {selectedTeam && (
                <section
                  className={styles.teamConfirm}
                  aria-labelledby="team-confirm-heading"
                >
                  <span className={styles.teamConfirmIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="8" r="3" />
                      <circle cx="17" cy="9" r="2.25" />
                      <path d="M3.5 19c.4-3.2 2.45-5 5.5-5s5.1 1.8 5.5 5M15.5 14.3c.45-.1.95-.15 1.5-.15 2.45 0 3.95 1.5 4.25 4.35" />
                    </svg>
                  </span>
                  <div className={styles.teamConfirmBody}>
                    <h3
                      id="team-confirm-heading"
                      className={styles.teamConfirmHeading}
                    >
                      {t("profile.confirmHeading")}
                    </h3>
                    <p className={styles.teamConfirmIntro}>
                      {t("profile.confirmIntro")}
                    </p>
                    <div className={styles.teamConfirmCard}>
                      <span className={styles.teamBadge}>
                        {String(selectedTeam.number).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{selectedTeam.name}</strong>
                        <small>{t("profile.confirmEvent")}</small>
                      </span>
                    </div>
                  </div>
                </section>
              )}

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
