"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Footer } from "@/components/brand/Footer";
import { THEME_STORAGE_KEY } from "@/components/theme/themeScript";
import { useRouter } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";
import {
  MOCK_BOARD,
  MOCK_PODIUM,
  PHASE_KEYS,
  PHASE_MINUTES,
  type PhaseKey,
  type Screen,
} from "./data";
import {
  baseStrategy,
  blockReason,
  INITIAL_STATE,
  nextScreen,
  type DallasState,
} from "./logic";
import {
  memberName,
  teamBadge,
  type DallasStudent,
  type DallasTeam,
} from "./student";
import {
  AdviseView,
  BriefView,
  DeliverView,
  DiagnoseView,
  DiscoverView,
  RespondView,
  TeamView,
} from "./views";
import styles from "./dallas.module.css";

export type Update = (
  patch:
    Partial<DallasState> | ((s: DallasState) => Partial<DallasState> | null),
) => void;

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

/**
 * Dallas challenge (design: LEAD Aspire Dallas). The student and team come
 * from /api/dallas/me; the challenge state still lives in memory.
 */
export function DallasApp({
  student,
  team,
}: {
  student: DallasStudent;
  team: DallasTeam;
}) {
  const router = useRouter();
  const [state, setState] = useState<DallasState>(INITIAL_STATE);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const update: Update = (patch) =>
    setState((s) => {
      const next = typeof patch === "function" ? patch(s) : patch;
      return next ? { ...s, ...next } : s;
    });

  function go(screen: Screen) {
    update((s) => ({
      screen,
      // Respond starts from the current strategy; Advise resets it when the strategy changes.
      revised:
        screen === "respond" && !s.revised ? [...baseStrategy(s)] : s.revised,
    }));
    setSecondsLeft(screen === "results" ? 0 : PHASE_MINUTES[screen] * 60);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    const id = setInterval(
      () => setSecondsLeft((left) => (left > 0 ? left - 1 : 0)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/dallas/login");
    router.refresh();
  }

  if (state.screen === "results") {
    return (
      <ResultsView
        team={team}
        onBack={() => go("deliver")}
        onSignOut={signOut}
      />
    );
  }

  return (
    <Shell
      state={state}
      team={team}
      members={student.members.map(memberName)}
      phase={state.screen}
      secondsLeft={secondsLeft}
      go={go}
      onSignOut={signOut}
      update={update}
    />
  );
}

type ShellProps = {
  state: DallasState;
  team: DallasTeam;
  members: string[];
  phase: PhaseKey;
  secondsLeft: number;
  go: (screen: Screen) => void;
  onSignOut: () => void;
  update: Update;
};

function Shell({
  state,
  team,
  members,
  phase,
  secondsLeft,
  go,
  onSignOut,
  update,
}: ShellProps) {
  const t = useTranslations("Dallas");
  const index = PHASE_KEYS.indexOf(phase);
  const doneCount = state.done.length;
  const left = PHASE_KEYS.length - doneCount;
  const blocked = blockReason(phase, state);
  const teamName = t("teamName", { num: team.number });

  function next() {
    if (blocked) return;
    update((s) => ({
      done: s.done.includes(phase) ? s.done : [...s.done, phase],
    }));
    go(nextScreen(phase));
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className={styles.shell}>
      <aside className={`dark ${styles.sidebar}`}>
        <div className={styles.brand}>
          <Image
            src={withBasePath("/lead-mark.png")}
            alt=""
            width={48}
            height={34}
            className={styles.brandMark}
          />
          <div className={styles.brandText}>
            <span className={styles.brandName}>LEAD</span>
            <span className={styles.brandSub}>{t("brandSub")}</span>
          </div>
        </div>

        <nav aria-label={t("nav.label")} style={{ display: "contents" }}>
          <span className={styles.navSection}>{t("nav.section")}</span>
          {PHASE_KEYS.map((key, i) => {
            const active = key === phase;
            return (
              <button
                key={key}
                type="button"
                onClick={() => go(key)}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`${styles.navNum} ${i % 2 ? styles.tonePurple : styles.toneRed}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.navLabel}>{t(`phases.${key}`)}</span>
                {state.done.includes(key) && (
                  <span
                    className={styles.navCheck}
                    aria-label={t("nav.completed")}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarSpacer} />

        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            {teamBadge(team)}
          </span>
          <div className={styles.userText}>
            <span className={styles.userName}>{teamName}</span>
            <span className={styles.userMeta}>{t("city")}</span>
          </div>
          <button type="button" className={styles.signOut} onClick={onSignOut}>
            {t("user.signOut")}
          </button>
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
        >
          <span className={styles.themeToLight}>{t("theme.toLight")}</span>
          <span className={styles.themeToDark}>{t("theme.toDark")}</span>
        </button>
      </aside>

      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.teamBar}>
            <div className={styles.teamId}>
              <span className={styles.teamLogo} aria-hidden="true">
                {teamBadge(team)}
              </span>
              <div className={styles.teamIdText}>
                <b className={styles.teamIdName}>{teamName}</b>
                <span className={`${styles.muted} text-[13px]`}>
                  {t("challenge")}
                </span>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressHead}>
                <b>
                  {t("progress.label", {
                    pct: Math.round((doneCount / PHASE_KEYS.length) * 100),
                  })}
                </b>
                <span className={styles.muted}>
                  {left === 0
                    ? t("progress.complete")
                    : t("progress.left", { count: left })}
                </span>
              </div>
              <div className={styles.progressSegments}>
                {PHASE_KEYS.map((key) => (
                  <div
                    key={key}
                    title={t(`phases.${key}`)}
                    className={[
                      styles.segment,
                      state.done.includes(key) ? styles.segmentDone : "",
                      key === phase ? styles.segmentActive : "",
                    ].join(" ")}
                  >
                    <div className={styles.segmentBar} />
                    <span className={styles.segmentLabel}>
                      {t(`phases.${key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {index > 0 && (
              <span
                role="timer"
                title={t("progress.timer")}
                aria-label={t("progress.timer")}
                className={`${styles.timer} ${secondsLeft < 300 ? styles.timerLow : ""}`}
              >
                {mm}:{ss}
              </span>
            )}
          </div>

          {phase === "team" && (
            <TeamView state={state} update={update} members={members} />
          )}
          {phase === "brief" && <BriefView state={state} update={update} />}
          {phase === "discover" && (
            <DiscoverView state={state} update={update} />
          )}
          {phase === "diagnose" && (
            <DiagnoseView state={state} update={update} />
          )}
          {phase === "advise" && <AdviseView state={state} update={update} />}
          {phase === "respond" && <RespondView state={state} update={update} />}
          {phase === "deliver" && <DeliverView state={state} update={update} />}

          <div className={styles.stepNav}>
            <button
              type="button"
              className={styles.backBtn}
              disabled={index === 0}
              onClick={() => go(PHASE_KEYS[index - 1])}
            >
              {t("footer.back")}
            </button>
            <div className={styles.stepNavRight}>
              {blocked && (
                <span className={`${styles.muted} text-[14px]`}>
                  {t(`footer.hints.${blocked}`)}
                </span>
              )}
              <button
                type="button"
                className={styles.nextBtn}
                disabled={!!blocked}
                onClick={next}
              >
                {phase === "deliver"
                  ? t("footer.submit")
                  : t("footer.continue")}
              </button>
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <Footer />
        </div>
      </div>
    </div>
  );
}

function ResultsView({
  team,
  onBack,
  onSignOut,
}: {
  team: DallasTeam;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const t = useTranslations("Dallas");

  return (
    <div className={`dark ${styles.shell} ${styles.results}`}>
      <div className={styles.resultsInner}>
        <div className={styles.resultsHead}>
          <span className={styles.eyebrow}>{t("results.eyebrow")}</span>
          <h1 className={styles.resultsTitle}>{t("results.title")}</h1>
          <p className={`${styles.muted} m-0 text-[18px]`}>
            {t("results.subtitle")}
          </p>
        </div>

        <ol className={styles.podium}>
          {MOCK_PODIUM.map((entry) => {
            const first = entry.rank === 1;
            return (
              <li
                key={entry.rank}
                className={`${styles.podiumItem} ${styles[`place${entry.rank}`]} ${first ? styles.podiumFirst : ""}`}
              >
                <span className={styles.placeBadge}>{entry.rank}</span>
                <b className={styles.podiumTeam}>
                  {t("teamName", { num: entry.team })}
                </b>
                <span className={styles.podiumPoints}>
                  {t("results.points", { points: entry.points })}
                </span>
                {entry.team === teamBadge(team) && (
                  <span className={styles.yourTeam}>
                    {t("results.yourTeam")}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className={styles.resultsHead}>
          <h2 className="m-0 font-display text-[22px] font-bold">
            {t("results.finalists")}
          </h2>
          <span className={`${styles.muted} text-[16px]`}>
            {t("results.finalistsHelp")}
          </span>
        </div>

        <ol className={styles.board} start={MOCK_BOARD[0]?.rank}>
          {MOCK_BOARD.map((entry) => (
            <li key={entry.rank} className={styles.boardItem}>
              <span className={styles.boardRank}>{entry.rank}</span>
              <div className={styles.boardText}>
                <span className={`${styles.muted} text-[13px]`}>
                  {t("teamName", { num: entry.team })}
                </span>
                <b>{entry.points}</b>
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.resultsActions}>
          <button type="button" className={styles.ghostBtn} onClick={onBack}>
            {t("results.back")}
          </button>
          <button type="button" className={styles.ghostBtn} onClick={onSignOut}>
            {t("user.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
