"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Footer } from "@/components/brand/Footer";
import { DALLAS_COACH_ENABLED, DALLAS_TIMER_ENABLED } from "@/lib/features";
import { THEME_STORAGE_KEY } from "@/components/theme/themeScript";
import { useRouter } from "@/i18n/navigation";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";
import { toPatches } from "./answers";
import { assignedRoles, phaseMinutes } from "./content";
import { PHASE_KEYS, type PhaseKey, type Screen } from "./data";
import { Celebration } from "./celebrate";
import { CoachWidget } from "./CoachWidget";
import { HomeView } from "./home";
import { blockReason, nextScreen, type DallasState } from "./logic";
import { useTeamSync, type TeamState } from "./teamSync";
import { PhaseResourcesView } from "./resources";
import { StrategizeView } from "./strategize";
import { TeamsResultsView } from "./teamsResults";
import { DiscoverView, TeamView } from "./views";
import styles from "./dallas.module.css";

export type Update = (
  patch:
    Partial<DallasState> | ((s: DallasState) => Partial<DallasState> | null),
) => void;

const SCREENS: readonly Screen[] = ["home", ...PHASE_KEYS];

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

/** "Lone Star Labs" -> "LS"; "?" until the team has a name. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
  return letters ? letters.slice(0, 2).toUpperCase() : "?";
}

/**
 * Dallas challenge (design: dallas-mockup-v2). The screen is in the URL
 * (?phase=diagnose; none = Home) so a refresh stays put. Answers, timers and
 * progress are shared by the team through the backend (see teamSync.ts).
 */
export function DallasApp({
  initialState,
  isAdmin = false,
}: {
  initialState: TeamState;
  /** Organizer (aspire_profiles.is_admin): also sees "View Teams Results". */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("Dallas");
  const sync = useTeamSync(initialState);
  const [coachOpen, setCoachOpen] = useState(false);
  // Set when the team submits its final recommendation; shown over Home.
  const [celebrating, setCelebrating] = useState(false);
  const [, setTick] = useState(0);

  const raw = useSearchParams().get("phase");
  const screen: Screen =
    SCREENS.includes(raw as Screen) || (isAdmin && raw === "teams")
      ? (raw as Screen)
      : "home";
  const phase = PHASE_KEYS.includes(screen as PhaseKey)
    ? (screen as PhaseKey)
    : null;

  const state: DallasState = sync.shared;
  const teamName = sync.shared.teamName.trim() || t("yourTeam");

  const update: Update = (patch) => {
    const changes = typeof patch === "function" ? patch(state) : patch;
    if (!changes) return;
    const patches = toPatches(sync.shared, { ...sync.shared, ...changes });
    if (Object.keys(patches).length) sync.edit(patches);
  };

  function go(next: Screen) {
    const path = window.location.pathname;
    window.history.pushState(
      null,
      "",
      next === "home" ? path : `${path}?phase=${next}`,
    );
    window.scrollTo(0, 0);
  }

  // Opening a timed phase starts the team's clock (the server keeps the first start).
  const started = phase ? sync.server.phases[phase]?.started_at : null;
  const { open } = sync;
  useEffect(() => {
    if (phase && phaseMinutes(phase) > 0 && !started) void open(phase);
  }, [phase, started, open]);

  // Re-render every second for the countdown; no need when it is hidden.
  useEffect(() => {
    if (!DALLAS_TIMER_ENABLED) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/dallas/login");
    router.refresh();
  }

  const total = phase ? phaseMinutes(phase) * 60 : 0;
  const elapsed = started
    ? Math.floor((sync.serverNow() - Date.parse(started)) / 1000)
    : 0;
  const secondsLeft = Math.max(0, total - elapsed);

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
          <button
            type="button"
            onClick={() => go("home")}
            className={`${styles.navItem} ${screen === "home" ? styles.navItemActive : ""}`}
            aria-current={screen === "home" ? "page" : undefined}
          >
            <span className={styles.navLabel}>{t("nav.home")}</span>
          </button>
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
                  className={`${styles.navNum} ${i % 2 ? styles.toneRed : styles.tonePurple}`}
                  aria-hidden="true"
                >
                  {/* Team Setup is not a numbered step: Discover is 01. */}
                  {i === 0 ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <circle cx="9" cy="8" r="3" />
                      <path d="M3.5 19c.4-3.2 2.45-5 5.5-5s5.1 1.8 5.5 5M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5" />
                    </svg>
                  ) : (
                    String(i).padStart(2, "0")
                  )}
                </span>
                <span className={styles.navLabel}>{t(`phases.${key}`)}</span>
                {sync.done.includes(key) && (
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

        {isAdmin && (
          <>
            <span className={styles.navSection}>{t("nav.organizers")}</span>
            <button
              type="button"
              onClick={() => go("teams")}
              className={`${styles.navItem} ${screen === "teams" ? styles.navItemActive : ""}`}
              aria-current={screen === "teams" ? "page" : undefined}
            >
              <span className={styles.navLabel}>{t("nav.teamsResults")}</span>
            </button>
          </>
        )}

        <div className={styles.sidebarSpacer} />

        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(sync.shared.teamName)}
          </span>
          <div className={styles.userText}>
            <span className={styles.userName}>{teamName}</span>
            <span className={styles.userMeta}>{t("city")}</span>
          </div>
          <button type="button" className={styles.signOut} onClick={signOut}>
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
        {screen === "teams" ? (
          <TeamsResultsView />
        ) : phase ? (
          <PhaseScreen
            phase={phase}
            state={state}
            update={update}
            sync={sync}
            teamName={teamName}
            secondsLeft={secondsLeft}
            go={go}
            onFinish={() => {
              setCelebrating(true);
              go("home");
            }}
          />
        ) : (
          <HomeView
            teamName={teamName}
            hasName={!!sync.shared.teamName.trim()}
            teamNumber={sync.server.team.number}
            rolesAssigned={assignedRoles(sync.shared.members)}
            done={sync.done}
            go={go}
            onAskCoach={() => setCoachOpen(true)}
          />
        )}
        <div className={styles.footer}>
          <Footer />
        </div>
      </div>
      {celebrating && (
        <Celebration
          teamName={teamName}
          onClose={() => setCelebrating(false)}
        />
      )}
      {DALLAS_COACH_ENABLED && (
        <CoachWidget open={coachOpen} setOpen={setCoachOpen} />
      )}
    </div>
  );
}

type PhaseScreenProps = {
  phase: PhaseKey;
  state: DallasState;
  update: Update;
  sync: ReturnType<typeof useTeamSync>;
  teamName: string;
  secondsLeft: number;
  go: (screen: Screen) => void;
  /** After Pitch & Submit is completed: Home with the celebration. */
  onFinish: () => void;
};

function PhaseScreen({
  phase,
  state,
  update,
  sync,
  teamName,
  secondsLeft,
  go,
  onFinish,
}: PhaseScreenProps) {
  const t = useTranslations("Dallas");
  const [submitting, setSubmitting] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const index = PHASE_KEYS.indexOf(phase);
  const doneCount = sync.done.length;
  const left = PHASE_KEYS.length - doneCount;
  const blocked = blockReason(phase, state);
  const phaseState = sync.server.phases[phase];
  const teamLocked = !!sync.server.phases.team?.completed_at;

  async function next() {
    if (blocked || submitting) return;
    setSubmitting(true);
    setRefused(null);
    const reason = await sync.complete(phase);
    setSubmitting(false);
    if (reason) setRefused(reason);
    else if (phase === PHASE_KEYS[PHASE_KEYS.length - 1]) onFinish();
    else go(nextScreen(phase));
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className={styles.content}>
      <div className={styles.teamBar}>
        <div className={styles.teamId}>
          <span
            className={`${styles.slot} ${styles.teamLogoSlot}`}
            aria-hidden="true"
          />
          <div className={styles.teamIdText}>
            <b className={styles.teamIdName}>{teamName}</b>
            <span className={`${styles.muted} text-[13px]`}>
              {t("challenge", { num: sync.server.team.number })}
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
                  sync.done.includes(key) ? styles.segmentDone : "",
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

        {DALLAS_TIMER_ENABLED && phaseMinutes(phase) > 0 && (
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

      <SyncLine
        status={sync.status}
        error={sync.error}
        hasPending={sync.hasPending}
        editor={phaseState?.updated_by_name ?? null}
      />

      {phase === "team" && (
        <TeamView
          state={state}
          update={update}
          members={sync.server.members}
          nameLocked={teamLocked}
        />
      )}
      {phase === "discover" && <DiscoverView />}
      {phase === "strategize" && (
        <StrategizeView state={state} update={update} teamName={teamName} />
      )}
      {(phase === "design" || phase === "pitch") && (
        <PhaseResourcesView phase={phase} teamName={teamName} />
      )}

      <div className={styles.stepNav}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => go(index === 0 ? "home" : PHASE_KEYS[index - 1])}
        >
          {t("footer.back")}
        </button>
        <div className={styles.stepNavRight}>
          {(blocked || refused) && (
            <span
              className={`${styles.muted} text-[14px]`}
              role={refused ? "alert" : undefined}
            >
              {blocked ? t(`footer.hints.${blocked}`) : t("footer.refused")}
            </span>
          )}
          <button
            type="button"
            className={styles.nextBtn}
            disabled={!!blocked || submitting}
            onClick={next}
          >
            {phase === "pitch" ? t("footer.submit") : t("footer.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Last edited by …" for the phase, and whether this browser's edits are saved. */
function SyncLine({
  status,
  error,
  hasPending,
  editor,
}: {
  status: string;
  error: string | null;
  hasPending: boolean;
  editor: string | null;
}) {
  const t = useTranslations("Dallas.sync");
  const saveLabel =
    status === "error"
      ? (error ?? t("error"))
      : status === "saving" || hasPending
        ? t("saving")
        : status === "saved"
          ? t("saved")
          : null;

  return (
    <div className={styles.syncLine}>
      <span>{editor ? t("lastEdited", { name: editor }) : ""}</span>
      {saveLabel && (
        <span
          className={status === "error" ? styles.syncError : undefined}
          role="status"
        >
          {saveLabel}
        </span>
      )}
    </div>
  );
}
