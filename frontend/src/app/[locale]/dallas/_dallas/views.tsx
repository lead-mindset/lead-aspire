"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  CAUSE_KEYS,
  CAUSES_REQUIRED,
  CLASS_COLORS,
  CLASS_KEYS,
  KPIS,
  MAX_CHANGES,
  METRIC_KEYS,
  METRICS_MAX,
  MISSING_KEYS,
  MISSING_MAX,
  MOCK_MEMBERS,
  OUTCOME_KEYS,
  REC_KEYS,
  RECS,
  ROLE_KEYS,
  ROLES,
  SITUATION_MAX,
  STRATEGY_MAX,
  WORKLOAD_KEYS,
  WORKLOADS,
  type ClassKey,
  type RecKey,
} from "./data";
import {
  baseStrategy,
  countChanges,
  projectImpact,
  reviseAt,
  toggleLimited,
  type DallasState,
} from "./logic";
import type { Update } from "./DallasApp";
import styles from "./dallas.module.css";

type ViewProps = { state: DallasState; update: Update };

const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(" ");

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={styles.headText}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
}

/** A checkbox row; rows past the selection limit fade but stay clickable to deselect others. */
function CheckRow({
  label,
  checked,
  full,
  filled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  full?: boolean;
  filled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cx(
        styles.check,
        filled && styles.checkFilled,
        checked && styles.checkOn,
        full && styles.checkFull,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={full}
        onChange={onToggle}
      />
      {label}
    </label>
  );
}

// ---------- 01 Team ----------

export function TeamView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas.teamSetup");
  const assigned = Object.values(state.members).filter(Boolean).length;

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <Heading title={t("title")} subtitle={t("subtitle")} />
        <span className={styles.pill}>
          {t("assigned", { count: assigned, total: ROLE_KEYS.length })}
        </span>
      </div>
      <div className={styles.roles}>
        {ROLE_KEYS.map((key) => (
          <div
            key={key}
            className={styles.role}
            style={{ "--role": ROLES[key].color } as CSSProperties}
          >
            <span className={styles.roleBadge} aria-hidden="true">
              {ROLES[key].abbr}
            </span>
            <b className={styles.roleTitle}>{t(`roles.${key}.title`)}</b>
            <span className={styles.roleDesc}>{t(`roles.${key}.desc`)}</span>
            <select
              className={styles.select}
              aria-label={t(`roles.${key}.title`)}
              value={state.members[key] ?? ""}
              onChange={(e) =>
                update((s) => ({
                  members: { ...s.members, [key]: e.target.value },
                }))
              }
            >
              <option value="">{t("assign")}</option>
              {MOCK_MEMBERS.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- 02 Brief ----------

export function BriefView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas");

  return (
    <section className={cx(styles.grid, styles.gridWide)}>
      <div className={cx(styles.card, styles.briefCard)}>
        <h1 className={styles.briefTitle}>{t("brief.title")}</h1>
        <div className={styles.mailHead}>
          <div>
            <b>{t("brief.from")}</b> {t("brief.fromValue")}
          </div>
          <div>
            <b>{t("brief.to")}</b> {t("brief.toValue")}
          </div>
          <div>
            <b>{t("brief.subject")}</b> {t("brief.subjectValue")}
          </div>
        </div>
        <div className={styles.mailBody}>
          <p>{t("brief.greeting")}</p>
          <p>{t("brief.p1")}</p>
          <p>{t("brief.p2")}</p>
          <p>
            {t("brief.signoff")}
            <br />
            {t("brief.signature")}
          </p>
        </div>
      </div>

      <div className={cx(styles.card, styles.briefCard)}>
        <h2 className={styles.tasksTitle}>{t("brief.tasks")}</h2>
        <label className={styles.question}>
          <span className={styles.questionLabel}>{t("brief.q1")}</span>
          <textarea
            className={styles.textarea}
            rows={4}
            placeholder={t("answerPlaceholder")}
            value={state.briefAnswer}
            onChange={(e) => update({ briefAnswer: e.target.value })}
          />
        </label>
        <fieldset className={cx(styles.question, "m-0 border-0 p-0")}>
          <div className={styles.cardTitleRow}>
            <legend className={cx(styles.questionLabel, "float-left p-0")}>
              {t("brief.q2")}
            </legend>
            <span className={styles.count}>
              {t("selected", { count: state.missing.length, max: MISSING_MAX })}
            </span>
          </div>
          {MISSING_KEYS.map((key) => {
            const checked = state.missing.includes(key);
            return (
              <CheckRow
                key={key}
                filled
                label={t(`brief.missing.${key}`)}
                checked={checked}
                full={!checked && state.missing.length >= MISSING_MAX}
                onToggle={() =>
                  update((s) => ({
                    missing: toggleLimited(s.missing, key, MISSING_MAX),
                  }))
                }
              />
            );
          })}
        </fieldset>
      </div>
    </section>
  );
}

// ---------- 03 Discover ----------

export function DiscoverView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas");
  const [tab, setTab] = useState<"overview" | "details">("overview");
  const key = WORKLOAD_KEYS[state.workload];
  const wl = WORKLOADS[key];

  return (
    <section className={styles.section}>
      <Heading title={t("discover.title")} subtitle={t("discover.subtitle")} />

      <div className={styles.kpis}>
        {KPIS.map((kpi) => (
          <div key={kpi.key} className={styles.kpi}>
            <b className={styles.kpiValue}>{kpi.value}</b>
            <span className={styles.kpiLabel}>
              {t(`discover.kpis.${kpi.key}.label`)}
            </span>
            <span
              className={cx(
                styles.kpiDelta,
                kpi.tone === "bad" && styles.bad,
                kpi.tone === "good" && styles.good,
              )}
            >
              {t(`discover.kpis.${kpi.key}.delta`)}
            </span>
          </div>
        ))}
      </div>

      <div className={cx(styles.grid, styles.gridWide)}>
        <div className={cx(styles.tableCard, styles.tableScroll)}>
          <div className={cx(styles.wlHead, styles.tableHead)}>
            <span>{t("discover.columns.workload")}</span>
            <span>{t("discover.columns.tokens")}</span>
            <span>{t("discover.columns.cost")}</span>
            <span>{t("discover.columns.adoption")}</span>
            <span>{t("discover.columns.value")}</span>
          </div>
          {WORKLOAD_KEYS.map((k, i) => {
            const row = WORKLOADS[k];
            const on = i === state.workload;
            return (
              <button
                key={k}
                type="button"
                className={cx(styles.wlRow, on && styles.wlRowOn)}
                aria-pressed={on}
                onClick={() => update({ workload: i })}
              >
                <span className={styles.wlName}>
                  {t(`workloads.${k}.name`)}
                </span>
                <span>{row.tokens}</span>
                <span>{row.cost}</span>
                <span>{row.adoption}</span>
                <span
                  className={cx(styles.value, styles[`value-${row.value}`])}
                >
                  {t(`values.${row.value}`)}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.card}>
          <div className={styles.wlDetailHead}>
            <b className="font-display text-[20px]">
              {t(`workloads.${key}.name`)}
            </b>
            <span className={cx(styles.muted, "text-[14.5px]")}>
              {t(`workloads.${key}.desc`)}
            </span>
          </div>
          <div className={styles.tabs} role="tablist">
            {(["overview", "details"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={cx(styles.tab, tab === name && styles.tabOn)}
                onClick={() => setTab(name)}
              >
                {t(`discover.${name}`)}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>
                    {t("discover.tokenUsage")}
                  </span>
                  <b className={styles.statValue}>{wl.tokens}</b>
                  <span className={cx(styles.statLabel, styles.bad)}>
                    {t(`workloads.${key}.trend`)}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>
                    {t("discover.monthlyCost")}
                  </span>
                  <b className={styles.statValue}>{wl.cost}</b>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>
                    {t("discover.impact")}
                  </span>
                  <b
                    className={cx(
                      styles.statValue,
                      styles[`value-${wl.value}`],
                    )}
                    style={{ background: "none" }}
                  >
                    {t(`values.${wl.value}`)}
                  </b>
                </div>
              </div>
              <ul className={styles.notes}>
                {Array.from({ length: wl.notes }, (_, i) => (
                  <li key={i}>{t(`workloads.${key}.notes.${i}`)}</li>
                ))}
              </ul>
            </>
          ) : (
            <dl className={styles.details}>
              <div className={styles.detailRow}>
                <dt>{t("discover.owner")}</dt>
                <dd>{t(`workloads.${key}.owner`)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>{t("discover.model")}</dt>
                <dd>{wl.model}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>{t("discover.users")}</dt>
                <dd>{t(`workloads.${key}.users`)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>{t("discover.monitoring")}</dt>
                <dd>{t(`workloads.${key}.monitoring`)}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- 04 Diagnose ----------

export function DiagnoseView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas");

  return (
    <section className={styles.section}>
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
              {t("selected", {
                count: state.causes.length,
                max: CAUSES_REQUIRED,
              })}
            </span>
          </div>
          <span className={cx(styles.muted, "text-[14.5px]")}>
            {t("diagnose.causesHelp")}
          </span>
          {CAUSE_KEYS.map((key) => {
            const checked = state.causes.includes(key);
            return (
              <CheckRow
                key={key}
                label={t(`diagnose.causes.${key}`)}
                checked={checked}
                full={!checked && state.causes.length >= CAUSES_REQUIRED}
                onToggle={() =>
                  update((s) => ({
                    causes: toggleLimited(s.causes, key, CAUSES_REQUIRED),
                  }))
                }
              />
            );
          })}
        </fieldset>
      </div>
    </section>
  );
}

// ---------- 05 Advise ----------

const EFFECTS = [
  { key: "cost", lowerIsBetter: true, color: "var(--success)" },
  { key: "value", lowerIsBetter: false, color: "var(--brand-purple-light)" },
  { key: "adoption", lowerIsBetter: false, color: "var(--warn)" },
  { key: "risk", lowerIsBetter: true, color: "oklch(0.65 0.15 155)" },
] as const;

export function AdviseView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas");
  const [tab, setTab] = useState<"available" | "strategy">("available");
  const { fx, time } = projectImpact(state.strategy);
  const list =
    tab === "available"
      ? REC_KEYS
      : REC_KEYS.filter((key) => state.strategy.includes(key));

  return (
    <section className={styles.section}>
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
                      revised: null,
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
    </section>
  );
}

// ---------- 06 Respond ----------

export function RespondView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas");
  const base = baseStrategy(state);
  const revised = state.revised ?? base;
  const changes = countChanges(base, revised);

  return (
    <section className={styles.section}>
      <Heading title={t("respond.title")} subtitle={t("respond.subtitle")} />
      <div className={styles.alerts}>
        <div className={cx(styles.alert, styles.alertRed)}>
          <b className={styles.alertTitle}>{t("respond.cfoTitle")}</b>
          <span>
            {t.rich("respond.cfo", { b: (chunks) => <b>{chunks}</b> })}
          </span>
        </div>
        <div className={cx(styles.alert, styles.alertGold)}>
          <b className={styles.alertTitle}>{t("respond.cisoTitle")}</b>
          <span>{t("respond.ciso")}</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <div className="flex flex-col gap-1">
            <b className={styles.cardTitle}>{t("respond.updateTitle")}</b>
            <span className={cx(styles.muted, "text-[14.5px]")}>
              {t("respond.updateHelp", { max: MAX_CHANGES })}
            </span>
          </div>
          <span
            className={cx(
              styles.changes,
              changes >= MAX_CHANGES && styles.changesMax,
            )}
            aria-live="polite"
          >
            {t("respond.changes", { count: changes, max: MAX_CHANGES })}
          </span>
        </div>
        <div className={styles.grid}>
          <div className={styles.recColumn}>
            <span className={styles.columnLabel}>{t("respond.current")}</span>
            {base.map((key, i) => (
              <div key={key} className={styles.baseItem}>
                <span className={styles.slotNum}>{i + 1}</span>
                {t(`recs.${key}.title`)}
              </div>
            ))}
          </div>
          <div className={styles.recColumn}>
            <span className={styles.columnLabel}>{t("respond.revised")}</span>
            {revised.map((value, i) => {
              const changed = value !== base[i];
              return (
                <div key={i} className={styles.revisedRow}>
                  <span
                    className={cx(
                      styles.slotNum,
                      changed && styles.slotNumChanged,
                    )}
                  >
                    {i + 1}
                  </span>
                  <select
                    aria-label={t("respond.slot", { n: i + 1 })}
                    className={cx(
                      styles.select,
                      styles.revisedSelect,
                      changed && styles.revisedSelectChanged,
                    )}
                    value={value}
                    onChange={(e) => {
                      const next = reviseAt(
                        base,
                        revised,
                        i,
                        e.target.value as RecKey | "",
                      );
                      if (next) update({ revised: next });
                    }}
                  >
                    <option value="">{t("respond.remove")}</option>
                    {REC_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`recs.${key}.title`)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 07 Deliver ----------

export function DeliverView({ state, update }: ViewProps) {
  const t = useTranslations("Dallas");

  return (
    <section className={styles.section}>
      <Heading title={t("deliver.title")} subtitle={t("deliver.subtitle")} />
      <div className={styles.grid}>
        <div className={styles.stack}>
          <label className={styles.field}>
            <b className={styles.fieldTitle}>{t("deliver.situation")}</b>
            <span className={styles.fieldHelp}>
              {t("deliver.situationHelp", { max: SITUATION_MAX })}
            </span>
            <textarea
              className={styles.textarea}
              rows={4}
              maxLength={SITUATION_MAX}
              placeholder={t("answerPlaceholder")}
              value={state.situation}
              onChange={(e) => update({ situation: e.target.value })}
            />
            <span className={styles.charCount}>
              {state.situation.length}/{SITUATION_MAX}
            </span>
          </label>
          <label className={styles.field}>
            <b className={styles.fieldTitle}>{t("deliver.rootCause")}</b>
            <span className={styles.fieldHelp}>
              {t("deliver.rootCauseHelp")}
            </span>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder={t("answerPlaceholder")}
              value={state.rootCause}
              onChange={(e) => update({ rootCause: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <b className={styles.fieldTitle}>{t("deliver.msRec")}</b>
            <span className={styles.fieldHelp}>{t("deliver.msRecHelp")}</span>
            <textarea
              className={styles.textarea}
              rows={5}
              placeholder={t("answerPlaceholder")}
              value={state.msRec}
              onChange={(e) => update({ msRec: e.target.value })}
            />
          </label>
        </div>

        <div className={styles.stack}>
          <fieldset className={cx(styles.field, "m-0 gap-2.5")}>
            <legend className={cx(styles.fieldTitle, "float-left p-0")}>
              {t("deliver.outcomes")}
            </legend>
            <span className={styles.fieldHelp}>
              {t("deliver.outcomesHelp")}
            </span>
            {OUTCOME_KEYS.map((key) => {
              const on = key in state.outcomes;
              const label = t(`deliver.outcomeItems.${key}`);
              return (
                <div key={key} className={styles.outcome}>
                  <label className={styles.outcomeLabel}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        update((s) => {
                          const outcomes = { ...s.outcomes };
                          if (on) delete outcomes[key];
                          else outcomes[key] = "";
                          return { outcomes };
                        })
                      }
                    />
                    {label}
                  </label>
                  <div className={styles.outcomeTarget}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={styles.number}
                      aria-label={t("deliver.target", { outcome: label })}
                      disabled={!on}
                      value={state.outcomes[key] ?? ""}
                      onChange={(e) =>
                        update((s) => ({
                          outcomes: { ...s.outcomes, [key]: e.target.value },
                        }))
                      }
                    />
                    <span className={styles.muted}>%</span>
                  </div>
                </div>
              );
            })}
          </fieldset>

          <fieldset className={cx(styles.field, "m-0 gap-2.5")}>
            <div className={styles.cardTitleRow}>
              <legend className={cx(styles.fieldTitle, "float-left p-0")}>
                {t("deliver.metrics")}
              </legend>
              <span className={styles.count}>
                {t("selected", {
                  count: state.metrics.length,
                  max: METRICS_MAX,
                })}
              </span>
            </div>
            <span className={styles.fieldHelp}>{t("deliver.metricsHelp")}</span>
            {METRIC_KEYS.map((key) => {
              const checked = state.metrics.includes(key);
              return (
                <CheckRow
                  key={key}
                  label={t(`deliver.metricItems.${key}`)}
                  checked={checked}
                  full={!checked && state.metrics.length >= METRICS_MAX}
                  onToggle={() =>
                    update((s) => ({
                      metrics: toggleLimited(s.metrics, key, METRICS_MAX),
                    }))
                  }
                />
              );
            })}
          </fieldset>
        </div>
      </div>

      <label className={styles.field}>
        <b className={styles.fieldTitle}>{t("deliver.statement")}</b>
        <span className={styles.fieldHelp}>{t("deliver.statementHelp")}</span>
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder={t("deliver.statementPlaceholder")}
          value={state.statement}
          onChange={(e) => update({ statement: e.target.value })}
        />
      </label>
    </section>
  );
}
