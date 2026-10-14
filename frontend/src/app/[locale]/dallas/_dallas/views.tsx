"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";
import {
  KPIS,
  stepNumber,
  TOKEN_TREND,
  TOKEN_TREND_MAX,
  WORKLOAD_KEYS,
  WORKLOADS,
} from "./data";
import type { DallasState } from "./logic";
import type { Update } from "./DallasApp";
import { ChatPanel } from "./chat";
import { assignedRoles, CONTENT, useText } from "./content";
import { DocViewer } from "./resources";
import { API_URL, memberName } from "./student";
import type { TeamMember } from "./teamSync";
import styles from "./dallas.module.css";

type ViewProps = { state: DallasState; update: Update };

/** Same limit as the backend (dallas_challenge.TEAM_NAME_MAX) and the mockup. */
const TEAM_NAME_MAX = 32;

/** Rows in the Team members panel; empty ones read "Waiting for teammate…". */
const TEAM_SLOTS = 5;

const cx = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(" ");

// ---------- Team Setup ----------

export function TeamView({
  state,
  update,
  members,
  nameLocked,
}: ViewProps & { members: TeamMember[]; nameLocked: boolean }) {
  const t = useTranslations("Dallas.teamSetup");
  const text = useText();
  const assigned = assignedRoles(state.members);
  const waiting = Math.max(0, TEAM_SLOTS - members.length);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setUserId(data.session?.user.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.section}>
      <div className={`dark ${styles.phaseHero} ${styles.phaseHeroBanner}`}>
        <Image
          src={withBasePath("/dashboard/dallas-team-setup.png")}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 1500px"
          className={styles.phaseHeroBannerPhoto}
        />
        <span className={styles.phaseStep}>{t("step")}</span>
        <h1 className={styles.phaseHeroTitle}>{t("title")}</h1>
        <p className={styles.phaseHeroText}>{t("subtitle")}</p>
      </div>

      <div className={styles.teamLayout}>
        <div className={styles.teamMain}>
          <div className={styles.field}>
            <label htmlFor="team-name" className={styles.fieldTitle}>
              {t("nameLabel")}
            </label>
            <span className={styles.fieldHelp}>{t("nameHelp")}</span>
            <div className={styles.nameInput}>
              <input
                id="team-name"
                className={styles.textInput}
                value={state.teamName}
                maxLength={TEAM_NAME_MAX}
                placeholder={t("namePlaceholder")}
                disabled={nameLocked}
                onChange={(e) => update({ teamName: e.target.value })}
              />
              <span className={styles.nameCount} aria-hidden="true">
                {state.teamName.length}/{TEAM_NAME_MAX}
              </span>
            </div>
            {nameLocked && (
              <span className={styles.fieldHelp}>{t("nameLocked")}</span>
            )}
          </div>

          <div className={styles.field}>
            <div className={styles.head}>
              <div className={styles.headText}>
                <b className={styles.fieldTitle}>{t("rolesLabel")}</b>
                <span className={styles.fieldHelp}>{t("rolesHelp")}</span>
              </div>
              <span className={styles.pill}>
                {t("assigned", {
                  count: assigned,
                  total: CONTENT.roles.length,
                })}
              </span>
            </div>
            <div className={styles.roles}>
              {CONTENT.roles.map((role) => (
                <div
                  key={role.key}
                  className={styles.role}
                  style={{ "--role": role.color } as CSSProperties}
                >
                  <span className={styles.roleBadge} aria-hidden="true">
                    {role.abbr}
                  </span>
                  <b className={styles.roleTitle}>{text(role.title)}</b>
                  <span className={styles.roleDesc}>{text(role.desc)}</span>
                  <select
                    className={styles.select}
                    aria-label={text(role.title)}
                    value={state.members[role.key] ?? ""}
                    onChange={(e) =>
                      update((s) => ({
                        members: { ...s.members, [role.key]: e.target.value },
                      }))
                    }
                  >
                    <option value="">{t("assign")}</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {memberName(member)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.teamHelp}>
            <span className={styles.teamHelpIcon} aria-hidden="true">
              i
            </span>
            <div>
              <b>{t("help.title")}</b>
              <ul>
                <li>{t("help.size")}</li>
                <li>{t("help.multiple")}</li>
                <li>{t("help.change")}</li>
                <li>{t("help.support")}</li>
              </ul>
            </div>
          </aside>
        </div>

        <aside className={styles.membersPanel}>
          <div className={styles.membersHead}>
            <b className={styles.fieldTitle}>{t("membersTitle")}</b>
            <span className={styles.membersCount}>
              {t("registered", { count: members.length })}
            </span>
          </div>
          <p className={styles.fieldHelp}>{t("membersHelp")}</p>
          <ul className={styles.membersList}>
            {members.map((member) => (
              <li key={member.user_id} className={styles.memberRow}>
                <span className={styles.memberAvatar} aria-hidden="true">
                  {memberInitials(member)}
                </span>
                <span className={styles.memberName}>{memberName(member)}</span>
                {member.user_id === userId && (
                  <span className={styles.youBadge}>{t("you")}</span>
                )}
              </li>
            ))}
            {Array.from({ length: waiting }, (_, i) => (
              <li
                key={`waiting-${i}`}
                className={`${styles.memberRow} ${styles.memberWaiting}`}
              >
                <span className={styles.memberAvatar} aria-hidden="true" />
                <span>{t("waiting")}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

/** "Ana Pérez" -> "AP". */
function memberInitials(member: TeamMember): string {
  return `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();
}

// ---------- Discover ----------

const DISCOVER_TABS = [
  "request",
  "profile",
  "stakeholders",
  "dashboard",
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number];

const DISCOVER_TAB_ICONS: Record<DiscoverTab, string> = {
  request: "M4 6h16v12H4zM4 7l8 6 8-6",
  profile: "M5 20V5h9v15M14 9h5v11M8 8h3M8 11h3M8 14h3M3 20h18",
  stakeholders:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  dashboard: "M4 20h16M6 16v-4M10 16V8M14 16v-6M18 16V5",
};

const TAKEAWAY_ICONS = {
  usage: "M4 20h16M7 16v-3M11 16V9M15 16v-5M19 16V6",
  decision:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  advice: "M5 5h14v10H9l-4 4zM9 10h.01M12 10h.01M15 10h.01",
} as const;

function TabIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function DiscoverView() {
  const t = useTranslations("Dallas.discover");
  const [tab, setTab] = useState<DiscoverTab>("request");
  const index = DISCOVER_TABS.indexOf(tab);
  const next = DISCOVER_TABS[index + 1];

  function open(name: DiscoverTab) {
    setTab(name);
    document
      .getElementById("discover-tabs")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className={styles.section}>
      <div className={`dark ${styles.phaseHero} ${styles.phaseHeroBanner}`}>
        <Image
          src={withBasePath("/dashboard/dallas-contoso.png")}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 1500px"
          className={styles.phaseHeroBannerPhoto}
        />
        <span className={styles.phaseStep}>
          {t("step", { num: stepNumber("discover") ?? 0 })}
        </span>
        <h1 className={styles.phaseHeroTitle}>{t("heroTitle")}</h1>
        <p className={styles.phaseHeroText}>{t("heroText")}</p>
      </div>

      <div
        id="discover-tabs"
        className={styles.discoverTabs}
        role="tablist"
        aria-label={t("tabsLabel")}
      >
        {DISCOVER_TABS.map((name, i) => (
          <button
            key={name}
            id={`discover-tab-${name}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls="discover-panel"
            className={cx(
              styles.discoverTab,
              tab === name && styles.discoverTabOn,
            )}
            onClick={() => open(name)}
          >
            <TabIcon path={DISCOVER_TAB_ICONS[name]} />
            {i + 1}. {t(`tabs.${name}`)}
          </button>
        ))}
      </div>

      <div
        id="discover-panel"
        role="tabpanel"
        aria-labelledby={`discover-tab-${tab}`}
        className={styles.section}
      >
        {tab === "request" && <CioRequest />}
        {tab === "dashboard" && <AiDashboard />}
        {tab === "profile" && <CompanyProfile />}
        {tab === "stakeholders" && <Stakeholders />}
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

/** Tab 1: the CIO's email (same text as the Brief), key takeaways and the mission. */
function CioRequest() {
  const t = useTranslations("Dallas");

  return (
    <>
      <div className={styles.requestGrid}>
        <article className={cx(styles.card, styles.briefCard)}>
          <h2 className={styles.requestTitle}>{t("brief.title")}</h2>
          <div className={styles.mailHeader}>
            <span className={styles.mailAvatar} aria-hidden="true">
              C
            </span>
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
            <span className={styles.mailTime}>
              {t("discover.request.time")}
            </span>
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
        </article>

        <aside className={cx(styles.card, styles.takeaways)}>
          <h2 className={styles.requestTitle}>
            {t("discover.request.takeawaysTitle")}
          </h2>
          {(Object.keys(TAKEAWAY_ICONS) as (keyof typeof TAKEAWAY_ICONS)[]).map(
            (key) => (
              <div key={key} className={styles.takeaway}>
                <span className={styles.takeawayIcon}>
                  <TabIcon path={TAKEAWAY_ICONS[key]} />
                </span>
                <span>
                  <b>{t(`discover.request.takeaways.${key}.title`)}</b>
                  <small>{t(`discover.request.takeaways.${key}.body`)}</small>
                </span>
              </div>
            ),
          )}
        </aside>
      </div>

      <div className={styles.mission}>
        <span className={styles.missionIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="13" r="8" />
            <circle cx="11" cy="13" r="4.5" />
            <circle cx="11" cy="13" r="1" />
            <path d="M11 13 20 4M16.5 4H20v3.5" />
          </svg>
        </span>
        <div>
          <b>{t("discover.request.missionTitle")}</b>
          <p>{t("discover.request.missionBody")}</p>
        </div>
      </div>
    </>
  );
}

const FACT_ICONS: Record<string, string> = {
  industry: "M3 20h18M5 20V9l5-3v14M10 20V4l9 4v12M13 9h3M13 12h3M13 15h3",
  headquarters:
    "M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  employees:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  revenue: "M4 20h16M6 16v-3M10 16V10M14 16v-5M18 16V6M5 9l5-4 4 3 5-4",
  markets:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  model: "M12 3 4 7v5c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V7l-8-4ZM9 12l2 2 4-4",
};

/** Tab 2: who Contoso is (case content in content.ts). */
function CompanyProfile() {
  const t = useTranslations("Dallas.discover.profile");
  const text = useText();
  const company = CONTENT.company;
  const [briefingOpen, setBriefingOpen] = useState(false);

  return (
    <>
      <div className={styles.profileGrid}>
        <article className={cx(styles.card, styles.profileAbout)}>
          <h2 className={styles.requestTitle}>{t("aboutTitle")}</h2>
          <p className={styles.profileText}>{text(company.about)}</p>
          <dl className={styles.facts}>
            {company.facts.map((fact) => (
              <div key={fact.key} className={styles.fact}>
                <span className={styles.factIcon}>
                  <TabIcon path={FACT_ICONS[fact.key] ?? FACT_ICONS.industry} />
                </span>
                <div>
                  <dt>{text(fact.label)}</dt>
                  <dd>{text(fact.value)}</dd>
                </div>
              </div>
            ))}
          </dl>
        </article>

        <div className={styles.profilePhoto}>
          {company.image ? (
            <Image
              src={withBasePath(company.image)}
              alt={t("imageAlt")}
              fill
              sizes="(max-width: 1100px) 100vw, 30vw"
            />
          ) : (
            <span className={styles.slot} aria-hidden="true" />
          )}
          <button
            type="button"
            className={`${styles.pillButton} ${styles.pillButtonCta} ${styles.profilePhotoButton}`}
            onClick={() => setBriefingOpen(true)}
          >
            {t("readMore")}
          </button>
        </div>

        <div className={styles.profileSide}>
          <div className={cx(styles.card, styles.profileMission)}>
            <span className={styles.takeawayIcon}>
              <TabIcon path="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01" />
            </span>
            <div>
              <b>{t("missionTitle")}</b>
              <p className={styles.profileText}>{text(company.mission)}</p>
            </div>
          </div>
          <div className={styles.card}>
            <b className={styles.fieldTitle}>{t("prioritiesTitle")}</b>
            <ul className={styles.priorities}>
              {company.priorities.map((priority) => (
                <li key={priority.en}>{text(priority)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.requestTitle}>{t("journeyTitle")}</h2>
        <ol className={styles.journey}>
          {company.journey.map((step) => (
            <li key={step.date.en} className={styles.journeyStep}>
              <span className={styles.journeyDot} aria-hidden="true" />
              <b>{text(step.date)}</b>
              <span>{text(step.text)}</span>
            </li>
          ))}
        </ol>
      </div>

      {briefingOpen && (
        <DocViewer
          target={{ kind: "doc", doc: "briefing" }}
          onClose={() => setBriefingOpen(false)}
        />
      )}
    </>
  );
}

/** Tab 3: the people at Contoso the recommendation must convince. */
/** Stakeholders whose Foundry agent is configured (GET /api/dallas/stakeholders). */
function useStakeholderChats(): string[] {
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch(`${API_URL}/api/dallas/stakeholders`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return;
      const body = (await response.json()) as { available: string[] };
      setAvailable(body.available);
    }

    // Without the list the cards simply show no chat buttons.
    load().catch(() => {});
    return () => controller.abort();
  }, []);

  return available;
}

function Stakeholders() {
  const t = useTranslations("Dallas.discover.stakeholders");
  const text = useText();
  const [open, setOpen] = useState<string | null>(null);
  const chats = useStakeholderChats();
  // The open chat, and every chat opened so far (kept mounted for their history).
  const [chatting, setChatting] = useState<string | null>(null);
  const [opened, setOpened] = useState<string[]>([]);

  function openChat(key: string) {
    setChatting(key);
    setOpened((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.headText}>
        <h2 className={styles.requestTitle}>{t("title")}</h2>
        <p className={styles.profileText}>{t("subtitle")}</p>
      </div>
      <div className={styles.stakeholders}>
        {CONTENT.stakeholders.map((person) => (
          <article key={person.key} className={styles.stakeholder}>
            <div className={styles.stakeholderPhoto}>
              {person.image ? (
                <Image
                  src={withBasePath(person.image)}
                  alt=""
                  fill
                  sizes="(max-width: 760px) 100vw, 25vw"
                />
              ) : (
                <span className={styles.slot} aria-hidden="true" />
              )}
            </div>
            <h3 className={styles.stakeholderTitle}>{text(person.title)}</h3>
            <p className={styles.stakeholderQuote}>“{text(person.quote)}”</p>
            <b className={styles.stakeholderLabel}>{t("priorities")}</b>
            <ul className={styles.priorities}>
              {person.priorities.map((priority) => (
                <li key={priority.en}>{text(priority)}</li>
              ))}
            </ul>
            {person.profile && (
              <>
                <button
                  type="button"
                  className={styles.profileLink}
                  aria-expanded={open === person.key}
                  onClick={() =>
                    setOpen(open === person.key ? null : person.key)
                  }
                >
                  {open === person.key ? t("hideProfile") : t("viewProfile")}
                </button>
                {open === person.key && (
                  <p className={styles.profileText}>{text(person.profile)}</p>
                )}
              </>
            )}
            {chats.includes(person.key) && (
              <button
                type="button"
                className={`${styles.pillButton} ${styles.pillButtonCta} ${styles.stakeholderAsk}`}
                aria-expanded={chatting === person.key}
                onClick={() => openChat(person.key)}
              >
                {t("chat.ask")}
              </button>
            )}
          </article>
        ))}
      </div>

      {opened.length > 0 && (
        <div className={styles.stakeholderDock}>
          {CONTENT.stakeholders
            .filter((person) => opened.includes(person.key))
            .map((person) => {
              const title = text(person.title);
              return (
                <ChatPanel
                  key={person.key}
                  path={`/stakeholders/${person.key}/chat`}
                  avatar={person.image ? withBasePath(person.image) : undefined}
                  hidden={chatting !== person.key}
                  onClose={() => setChatting(null)}
                  labels={{
                    title,
                    subtitle: t("chat.subtitle"),
                    greeting: t("chat.greeting", { title }),
                    thinking: t("chat.thinking", { title }),
                    error: t("chat.error"),
                    placeholder: t("chat.placeholder"),
                    inputLabel: t("chat.inputLabel"),
                    send: t("chat.send"),
                    close: t("chat.close"),
                  }}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

const KPI_ICONS: Record<(typeof KPIS)[number]["key"], string> = {
  tokens:
    "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  cost: "M12 3v18M16.5 7.5C16 6 14.3 5 12 5c-2.6 0-4.5 1.3-4.5 3.2 0 4.3 9 2.2 9 6.6 0 2-2 3.2-4.5 3.2-2.4 0-4.2-1-4.7-2.8",
  adoption:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  workloads: "M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9",
};

const WORKLOAD_ICONS: Record<(typeof WORKLOAD_KEYS)[number], string> = {
  support: "M5 5h14v10H9l-4 4zM9 10h.01M12 10h.01M15 10h.01",
  sales: "M4 20h16M7 16v-3M11 16V9M15 16v-5M19 16V6",
  marketing: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  hr: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  knowledge:
    "M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5zM12 6v13.5",
  experiments:
    "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9",
};

/** Tab 4: Contoso's AI usage: KPIs, workloads, the token trend and its insight. */
function AiDashboard() {
  const t = useTranslations("Dallas");

  return (
    <>
      <div className={styles.headText}>
        <h2 className={styles.requestTitle}>{t("discover.title")}</h2>
        <p className={styles.profileText}>{t("discover.subtitle")}</p>
      </div>

      <div className={styles.kpis}>
        {KPIS.map((kpi) => (
          <div key={kpi.key} className={styles.kpi}>
            <span className={styles.kpiIcon}>
              <TabIcon path={KPI_ICONS[kpi.key]} />
            </span>
            <div className={styles.kpiText}>
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
                {kpi.tone !== "neutral" && <span aria-hidden="true">↑ </span>}
                {t(`discover.kpis.${kpi.key}.delta`)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.dashboardGrid}>
        <div className={styles.card}>
          <b className={styles.fieldTitle}>{t("discover.workloadsTitle")}</b>
          <div className={styles.tableScroll}>
            <table className={styles.wlTable}>
              <thead>
                <tr>
                  <th scope="col">{t("discover.columns.workload")}</th>
                  <th scope="col">{t("discover.columns.tokens")}</th>
                  <th scope="col">{t("discover.columns.cost")}</th>
                  <th scope="col">{t("discover.columns.adoption")}</th>
                  <th scope="col">{t("discover.columns.value")}</th>
                </tr>
              </thead>
              <tbody>
                {WORKLOAD_KEYS.map((key) => {
                  const row = WORKLOADS[key];
                  return (
                    <tr key={key}>
                      <th scope="row">
                        <span className={styles.wlIcon}>
                          <TabIcon path={WORKLOAD_ICONS[key]} />
                        </span>
                        {t(`workloads.${key}.name`)}
                      </th>
                      <td>{row.tokens}</td>
                      <td>{row.cost}</td>
                      <td>{row.adoption}</td>
                      <td>
                        <span
                          className={cx(
                            styles.value,
                            styles[`value-${row.value}`],
                          )}
                        >
                          {t(`values.${row.value}`)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card}>
          <b className={styles.fieldTitle}>{t("discover.trendTitle")}</b>
          <TokenTrend />
          <div className={styles.insight}>
            <span className={styles.takeawayIcon}>
              <TabIcon path={KPI_ICONS.tokens} />
            </span>
            <div>
              <b>{t("discover.insightTitle")}</b>
              <p className={styles.profileText}>{t("discover.insightBody")}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Chart geometry, in viewBox units.
const CHART = {
  width: 520,
  height: 220,
  left: 44,
  right: 16,
  top: 12,
  bottom: 30,
};
const TICKS = [0, 10, 20, 30];

/** Monthly tokens as a line: crosshair and tooltip on hover/focus, a table for screen readers. */
function TokenTrend() {
  const t = useTranslations("Dallas.discover");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);

  const months = TOKEN_TREND.map((_, i) =>
    new Date(2024, i, 1).toLocaleString(locale, { month: "short" }),
  );
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  const x = (i: number) => CHART.left + (plotW * i) / (TOKEN_TREND.length - 1);
  const y = (v: number) => CHART.top + plotH * (1 - v / TOKEN_TREND_MAX);
  const points = TOKEN_TREND.map((v, i) => `${x(i)},${y(v)}`);
  const line = `M${points.join("L")}`;
  const area = `${line}L${x(TOKEN_TREND.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const value = (v: number) => t("trendValue", { value: v });

  function pick(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.round(ratio * (TOKEN_TREND.length - 1)));
  }

  return (
    <figure className={styles.trend}>
      <figcaption className={styles.trendCaption}>
        {t("trendSubtitle")}
      </figcaption>
      <div className={styles.trendPlot}>
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label={t("trendLabel", {
            first: value(TOKEN_TREND[0]),
            last: value(TOKEN_TREND[TOKEN_TREND.length - 1]),
          })}
          tabIndex={0}
          onFocus={() => setActive(TOKEN_TREND.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft")
              setActive((i) => Math.max(0, (i ?? 0) - 1));
            if (event.key === "ArrowRight")
              setActive((i) => Math.min(TOKEN_TREND.length - 1, (i ?? 0) + 1));
          }}
        >
          <defs>
            <linearGradient id="token-trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0"
                stopColor="var(--brand-purple)"
                stopOpacity="0.22"
              />
              <stop
                offset="1"
                stopColor="var(--brand-purple)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {TICKS.map((tick) => (
            <g key={tick}>
              <line
                className={styles.trendGrid}
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className={styles.trendAxis}
                x={CHART.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick ? `${tick}M` : "0"}
              </text>
            </g>
          ))}
          {months.map((month, i) => (
            <text
              key={month}
              className={styles.trendAxis}
              x={x(i)}
              y={CHART.height - 8}
              textAnchor="middle"
            >
              {month}
            </text>
          ))}
          <path d={area} fill="url(#token-trend-fill)" />
          <path d={line} className={styles.trendLine} />
          {active !== null && (
            <line
              className={styles.trendCrosshair}
              x1={x(active)}
              x2={x(active)}
              y1={CHART.top}
              y2={y(0)}
            />
          )}
          {TOKEN_TREND.map((v, i) => (
            <circle
              key={i}
              className={styles.trendDot}
              cx={x(i)}
              cy={y(v)}
              r={i === active ? 6 : 4}
            />
          ))}
          {/* Hit area larger than the marks: the whole plot. */}
          <rect
            x={CHART.left - 20}
            y={CHART.top}
            width={plotW + 40}
            height={plotH}
            fill="transparent"
            onPointerMove={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <div
            className={styles.trendTooltip}
            style={{
              left: `${(x(active) / CHART.width) * 100}%`,
              top: `${(y(TOKEN_TREND[active]) / CHART.height) * 100}%`,
            }}
            aria-hidden="true"
          >
            <span>{months[active]} 2024</span>
            <b>{value(TOKEN_TREND[active])}</b>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{t("trendSubtitle")}</caption>
        <tbody>
          {TOKEN_TREND.map((v, i) => (
            <tr key={i}>
              <th scope="row">{months[i]} 2024</th>
              <td>{value(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
