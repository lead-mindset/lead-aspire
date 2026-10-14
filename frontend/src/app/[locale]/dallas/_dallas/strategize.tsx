"use client";

// Strategize: tabs like Discover's. "Guides & resources" is New York's
// Strategize page (./resources.tsx); Diagnose and Advise are the earlier
// Dallas phases of the same names, kept as practice for team brainstorming.
// They are not graded and never block Continue, but the team's choices are
// saved and shared (answers.ts, under the Strategize phase).

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  CAUSE_KEYS,
  CAUSES_MAX,
  CLASS_COLORS,
  CLASS_KEYS,
  REC_KEYS,
  RECS,
  STRATEGY_MAX,
  WORKLOAD_KEYS,
  type ClassKey,
} from "./data";
import { projectImpact, toggleLimited, type DallasState } from "./logic";
import type { Update } from "./DallasApp";
import { PhaseHero, PhaseResources } from "./resources";
import styles from "./dallas.module.css";

const TABS = ["guides", "diagnose", "advise"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, string> = {
  guides: "M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5",
  diagnose: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20",
  advise: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z",
};

const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(" ");

type Props = { state: DallasState; update: Update; teamName: string };

export function StrategizeView({ state, update, teamName }: Props) {
  const t = useTranslations("Dallas.strategizeTabs");
  const [tab, setTab] = useState<Tab>("guides");
  const next = TABS[TABS.indexOf(tab) + 1];

  function open(name: Tab) {
    setTab(name);
    document
      .getElementById("strategize-tabs")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className={styles.section}>
      <PhaseHero phase="strategize" />

      <div
        id="strategize-tabs"
        className={styles.discoverTabs}
        role="tablist"
        aria-label={t("tabsLabel")}
      >
        {TABS.map((name, i) => (
          <button
            key={name}
            id={`strategize-tab-${name}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls="strategize-panel"
            className={cx(
              styles.discoverTab,
              tab === name && styles.discoverTabOn,
            )}
            onClick={() => open(name)}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={TAB_ICONS[name]} />
            </svg>
            {i + 1}. {t(`tabs.${name}`)}
          </button>
        ))}
      </div>

      <div
        id="strategize-panel"
        role="tabpanel"
        aria-labelledby={`strategize-tab-${tab}`}
        className={styles.section}
      >
        {tab === "guides" && (
          <PhaseResources phase="strategize" teamName={teamName} />
        )}
        {tab === "diagnose" && <Diagnose state={state} update={update} />}
        {tab === "advise" && <Advise state={state} update={update} />}
      </div>

      {next && (
        <div className={styles.discoverNext}>
          <button
            type="button"
            className={styles.nextBtn}
            onClick={() => open(next)}
          >
            {t("nextTab", { tab: t(`tabs.${next}`) })} →
          </button>
        </div>
      )}
    </section>
  );
}

/** Tells teams Diagnose and Advise are for practice, not for the score. */
function PracticeNote() {
  const t = useTranslations("Dallas.strategizeTabs.practice");
  return (
    <div className={styles.practiceNote} role="note">
      <b>{t("title")}</b>
      <span>{t("text")}</span>
    </div>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={styles.headText}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
}

type TabProps = { state: DallasState; update: Update };

// ---------- Diagnose ----------

function Diagnose({ state, update }: TabProps) {
  const t = useTranslations("Dallas");

  return (
    <>
      <PracticeNote />
      <Heading title={t("diagnose.title")} subtitle={t("diagnose.subtitle")} />
      <div className={styles.grid}>
        <div className={styles.tableCard}>
          <div className={cx(styles.diagRow, styles.tableHead)}>
            <span>{t("diagnose.workload")}</span>
            <span>{t("diagnose.classification")}</span>
          </div>
          {WORKLOAD_KEYS.map((key) => {
            const value = (state.diag[key] ?? "") as ClassKey | "";
            return (
              <div key={key} className={styles.diagRow}>
                <b className="font-semibold">{t(`workloads.${key}.name`)}</b>
                <select
                  aria-label={t(`workloads.${key}.name`)}
                  className={cx(
                    styles.select,
                    styles.classSelect,
                    value && styles.classSelectSet,
                  )}
                  style={
                    value
                      ? ({ "--cls": CLASS_COLORS[value] } as CSSProperties)
                      : undefined
                  }
                  value={value}
                  onChange={(e) =>
                    update((s) => ({
                      diag: { ...s.diag, [key]: e.target.value },
                    }))
                  }
                >
                  <option value="">{t("diagnose.select")}</option>
                  {CLASS_KEYS.map((cls) => (
                    <option key={cls} value={cls}>
                      {t(`diagnose.classes.${cls}`)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <fieldset className={cx(styles.card, "m-0 gap-3")}>
          <div className={styles.cardTitleRow}>
            <legend className={cx(styles.cardTitle, "float-left p-0")}>
              {t("diagnose.causesTitle")}
            </legend>
            <span className={styles.count}>
              {t("selected", { count: state.causes.length, max: CAUSES_MAX })}
            </span>
          </div>
          <span className={cx(styles.muted, "text-[14.5px]")}>
            {t("diagnose.causesHelp")}
          </span>
          {CAUSE_KEYS.map((key) => {
            const checked = state.causes.includes(key);
            const full = !checked && state.causes.length >= CAUSES_MAX;
            return (
              <label
                key={key}
                className={cx(
                  styles.check,
                  checked && styles.checkOn,
                  full && styles.checkFull,
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={full}
                  onChange={() =>
                    update((s) => ({
                      causes: toggleLimited(s.causes, key, CAUSES_MAX),
                    }))
                  }
                />
                {t(`diagnose.causes.${key}`)}
              </label>
            );
          })}
        </fieldset>
      </div>
    </>
  );
}

// ---------- Advise ----------

const EFFECTS = [
  { key: "cost", lowerIsBetter: true, color: "var(--success)" },
  { key: "value", lowerIsBetter: false, color: "var(--brand-purple-light)" },
  { key: "adoption", lowerIsBetter: false, color: "var(--warn)" },
  { key: "risk", lowerIsBetter: true, color: "oklch(0.65 0.15 155)" },
] as const;

function Advise({ state, update }: TabProps) {
  const t = useTranslations("Dallas");
  const [tab, setTab] = useState<"available" | "strategy">("available");
  const { fx, time } = projectImpact(state.strategy);
  const list =
    tab === "available"
      ? REC_KEYS
      : REC_KEYS.filter((key) => state.strategy.includes(key));

  return (
    <>
      <PracticeNote />
      <Heading title={t("advise.title")} subtitle={t("advise.subtitle")} />
      <div className={cx(styles.grid, styles.gridWide)}>
        <div className={styles.tableCard}>
          <div className={styles.recTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "available"}
              className={cx(
                styles.recTab,
                tab === "available" && styles.recTabOn,
              )}
              onClick={() => setTab("available")}
            >
              {t("advise.available")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "strategy"}
              className={cx(
                styles.recTab,
                tab === "strategy" && styles.recTabOn,
              )}
              onClick={() => setTab("strategy")}
            >
              {t("advise.strategy", {
                count: state.strategy.length,
                max: STRATEGY_MAX,
              })}
            </button>
          </div>
          {list.map((key) => {
            const on = state.strategy.includes(key);
            return (
              <div key={key} className={styles.rec}>
                <div className={styles.recText}>
                  <b className={styles.recTitle}>{t(`recs.${key}.title`)}</b>
                  <span className={styles.recSub}>{t(`recs.${key}.sub`)}</span>
                </div>
                <span className={styles.recCost}>{RECS[key].cost}</span>
                <span className={styles.recTime}>{t(`recs.${key}.time`)}</span>
                <button
                  type="button"
                  className={cx(styles.recBtn, on && styles.recBtnOn)}
                  aria-pressed={on}
                  aria-label={`${on ? t("advise.added") : t("advise.add")}: ${t(`recs.${key}.title`)}`}
                  disabled={!on && state.strategy.length >= STRATEGY_MAX}
                  onClick={() =>
                    update((s) => ({
                      strategy: toggleLimited(s.strategy, key, STRATEGY_MAX),
                    }))
                  }
                >
                  {on ? t("advise.added") : t("advise.add")}
                </button>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className={styles.empty}>{t("advise.empty")}</div>
          )}
        </div>

        <div className={cx(styles.card, "gap-[18px]")}>
          <b className={styles.cardTitle}>
            {t("advise.impact")}{" "}
            <span className={styles.impactLive}>{t("advise.live")}</span>
          </b>
          {EFFECTS.map((effect, i) => {
            const v = fx[i];
            // fx holds savings for cost and risk (positive = goes down) and gains for the rest.
            const down = effect.lowerIsBetter ? v > 0 : v < 0;
            return (
              <div
                key={effect.key}
                className={styles.impact}
                style={{ "--fx": effect.color } as CSSProperties}
              >
                <div className={styles.impactHead}>
                  <span>{t(`advise.effects.${effect.key}`)}</span>
                  <b>{v === 0 ? "—" : `${down ? "↓" : "↑"} ${Math.abs(v)}%`}</b>
                </div>
                <div className={styles.impactTrack}>
                  <div
                    className={styles.impactFill}
                    style={{ width: `${Math.min(100, Math.abs(v) * 3.5)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className={styles.impactTime}>
            <span>{t("advise.timeToImplement")}</span>
            <b>{time ? t(`advise.time.${time}`) : "—"}</b>
          </div>
        </div>
      </div>
    </>
  );
}
