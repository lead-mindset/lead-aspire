"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";
import { createClient } from "@/lib/supabase/client";
import {
  CHAIN,
  CHAIN_KEYS,
  EXPORT_TREND,
  EXPORT_TREND_MAX,
  EXPORT_TREND_TICKS,
  KPIS,
  stepNumber,
  type ChainKey,
  type Level,
} from "./data";
import type { ColombiaState } from "./logic";
import type { Update } from "./ColombiaApp";
import { ChatPanel } from "./chat";
import { assignedRoles, CONTENT, useText } from "./content";
import { DocViewer } from "./resources";
import { API_URL, memberName } from "./student";
import type { TeamMember } from "./teamSync";
import styles from "./colombia.module.css";

type ViewProps = { state: ColombiaState; update: Update };

/** Same limit as the backend (colombia_challenge.TEAM_NAME_MAX) and the mockup. */
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
  const t = useTranslations("Colombia.teamSetup");
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
  "challenge",
  "profile",
  "stakeholders",
  "dashboard",
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number];

const DISCOVER_TAB_ICONS: Record<DiscoverTab, string> = {
  challenge:
    "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6",
  profile: "M5 20V5h9v15M14 9h5v11M8 8h3M8 11h3M8 14h3M3 20h18",
  stakeholders:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  dashboard: "M4 20h16M6 16v-4M10 16V8M14 16v-6M18 16V5",
};

/** Icons of the challenge takeaways, by their key in content.ts. */
const TAKEAWAY_ICONS: Record<string, string> = {
  trace:
    "M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM18 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM8 7h5a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h5",
  market:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  rural:
    "M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01M4 4l16 16",
};

function TabIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** A round avatar: the photo when there is one, otherwise the initials. */
function Avatar({
  image,
  initials,
  color,
  className,
}: {
  image: string;
  initials: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(styles.avatar, className)}
      style={color ? ({ "--avatar": color } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {image ? (
        <Image src={withBasePath(image)} alt="" fill sizes="120px" />
      ) : (
        initials
      )}
    </span>
  );
}

export function DiscoverView() {
  const t = useTranslations("Colombia.discover");
  const [tab, setTab] = useState<DiscoverTab>("challenge");
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
          src={withBasePath("/dashboard/discoverbanner.png")}
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
        {tab === "challenge" && <Challenge />}
        {tab === "dashboard" && <SectorDashboard />}
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

/**
 * Tab 1: the challenge, introduced by the president who presents it live
 * (case content in content.ts), the takeaways and the mission.
 */
function Challenge() {
  const t = useTranslations("Colombia.discover.challenge");
  const text = useText();
  const challenge = CONTENT.challenge;
  const presenter = challenge.presenter;

  return (
    <>
      <div className={styles.requestGrid}>
        <article className={cx(styles.card, styles.briefCard)}>
          <div className={styles.presenter}>
            <Avatar
              image={presenter.image}
              initials={presenter.initials}
              className={styles.presenterAvatar}
            />
            <div className={styles.presenterText}>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} aria-hidden="true" />
                {t("live")}
              </span>
              <h2 className={styles.presenterName}>{presenter.name}</h2>
              <span className={styles.presenterTitle}>
                {text(presenter.title)}
              </span>
            </div>
          </div>

          {challenge.quote && (
            <blockquote className={styles.presenterQuote}>
              “{text(challenge.quote)}”
            </blockquote>
          )}

          <div className={styles.mailBody}>
            <b className={styles.fieldTitle}>{t("contextTitle")}</b>
            {challenge.paragraphs.map((paragraph) => (
              <p key={paragraph.en}>{text(paragraph)}</p>
            ))}
          </div>

          <div className={styles.challengeQuestion}>
            <small>{t("questionTitle")}</small>
            <b>{text(challenge.question)}</b>
          </div>

          <div>
            <b className={styles.fieldTitle}>{t("liveTitle")}</b>
            <ul className={styles.liveList}>
              {challenge.live.map((point) => (
                <li key={point.en}>{text(point)}</li>
              ))}
            </ul>
          </div>
        </article>

        <aside className={cx(styles.card, styles.takeaways)}>
          <h2 className={styles.requestTitle}>{t("takeawaysTitle")}</h2>
          {challenge.takeaways.map((item) => (
            <div key={item.key} className={styles.takeaway}>
              <span className={styles.takeawayIcon}>
                <TabIcon
                  path={TAKEAWAY_ICONS[item.key] ?? TAKEAWAY_ICONS.trace}
                />
              </span>
              <span>
                <b>{text(item.title)}</b>
                <small>{text(item.body)}</small>
              </span>
            </div>
          ))}
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
          <b>{t("missionTitle")}</b>
          <p>{text(challenge.mission)}</p>
        </div>
      </div>
    </>
  );
}

const FACT_ICONS: Record<string, string> = {
  type: "M3 20h18M5 20V9l5-3v14M10 20V4l9 4v12M13 9h3M13 12h3M13 15h3",
  founded: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  headquarters:
    "M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  share: "M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z",
  alliance:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  markets:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
};

/** Tab 2: who Asoexport is (case content in content.ts). */
function CompanyProfile() {
  const t = useTranslations("Colombia.discover.profile");
  const text = useText();
  const company = CONTENT.company;
  // Typed as string so the branded card stays valid once a photo is set.
  const photo: string = company.image;
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
                  <TabIcon path={FACT_ICONS[fact.key] ?? FACT_ICONS.type} />
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
          {photo ? (
            <Image
              src={withBasePath(photo)}
              alt={t("imageAlt")}
              fill
              sizes="(max-width: 1100px) 100vw, 30vw"
            />
          ) : (
            <div className={`dark ${styles.brandCard}`}>
              <span className={styles.brandCardName}>{company.name}</span>
              <span className={styles.brandCardBadge}>
                {text(company.badge)}
              </span>
            </div>
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
            <li
              key={step.date.en + step.text.en}
              className={styles.journeyStep}
            >
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

/** Stakeholders whose Foundry agent is configured (GET /api/colombia/stakeholders). */
function useStakeholderChats(): string[] {
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch(`${API_URL}/api/colombia/stakeholders`, {
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

/** Tab 3: the people along the coffee chain the solution must work for. */
function Stakeholders() {
  const t = useTranslations("Colombia.discover.stakeholders");
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
        {CONTENT.stakeholders.map((person) => {
          // Typed as string: with every photo set, `as const` would narrow
          // the "no photo" branch to never.
          const photo: string = person.image;
          return (
            <article key={person.key} className={styles.stakeholder}>
              <div
                className={styles.stakeholderPhoto}
                style={{ "--avatar": person.color } as CSSProperties}
              >
                {photo ? (
                  <Image
                    src={withBasePath(photo)}
                    alt=""
                    fill
                    sizes="(max-width: 760px) 100vw, 25vw"
                  />
                ) : (
                  <span
                    className={styles.stakeholderInitials}
                    aria-hidden="true"
                  >
                    {person.initials}
                  </span>
                )}
              </div>
              <h3 className={styles.stakeholderTitle}>{person.name}</h3>
              <span className={styles.stakeholderRole}>
                {text(person.title)} · {text(person.region)}
              </span>
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
          );
        })}
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
                    title: person.name,
                    subtitle: t("chat.subtitle"),
                    greeting: t("chat.greeting", {
                      name: person.name,
                      title: title.toLowerCase(),
                    }),
                    thinking: t("chat.thinking", { name: person.name }),
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
  exports: "M3 17h18l-2 4H5zM6 17V9h12v8M9 9V5h6v4",
  green:
    "M12 3c4.5 2 7 5.6 7 9.5S15.9 21 12 21s-7-4.6-7-8.5S7.5 5 12 3ZM12 3c-2 4-2 14 0 18",
  families:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-3 2.4-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17.5 14.5c1.8.4 2.8 1.9 3 4.5",
  internet:
    "M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01",
};

const CHAIN_ICONS: Record<ChainKey, string> = {
  supply:
    "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  farm: "M3 20c3-6 6-9 9-9s6 3 9 9M12 11V4M12 4c2 0 4 1 4 3M12 6c-2 0-4 1-4 3",
  wetmill:
    "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11ZM9 15a3 3 0 0 0 3 3",
  collection: "M3 10 12 4l9 6v10H3zM8 20v-6h8v6M8 17h8",
  mill: "M4 20V10l5 3V10l5 3V6h6v14zM16 9h2M16 12h2",
  export: "M3 17h18l-2 4H5zM6 17V9h12v8M9 9V5h6v4M2 13c3 0 3 1.5 5 1.5",
};

/** Impact on traceability: a high weight reads as a warning, not as good news. */
const IMPACT_TONE: Record<Level, string> = {
  high: "value-low",
  medium: "value-medium",
  low: "value-high",
  verylow: "value-high",
};

/** Tab 4: the sector's figures: KPIs, the six links of the chain, and monthly exports. */
function SectorDashboard() {
  const t = useTranslations("Colombia");

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
              <b className={styles.kpiValue}>
                {t(`discover.kpis.${kpi.key}.value`)}
              </b>
              <span className={styles.kpiLabel}>
                {t(`discover.kpis.${kpi.key}.label`)}
              </span>
              <span
                className={cx(
                  styles.kpiDelta,
                  kpi.tone === "bad" && styles.bad,
                )}
              >
                {kpi.arrow && (
                  <span aria-hidden="true">
                    {kpi.arrow === "down" ? "↓ " : "↑ "}
                  </span>
                )}
                {t(`discover.kpis.${kpi.key}.delta`)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <b className={styles.fieldTitle}>{t("discover.chainTitle")}</b>
        <div className={styles.tableScroll}>
          <table className={cx(styles.wlTable, styles.chainTable)}>
            <thead>
              <tr>
                <th scope="col">{t("discover.columns.link")}</th>
                <th scope="col">{t("discover.columns.where")}</th>
                <th scope="col">{t("discover.columns.pain")}</th>
                <th scope="col">{t("discover.columns.data")}</th>
                <th scope="col">{t("discover.columns.impact")}</th>
              </tr>
            </thead>
            <tbody>
              {CHAIN_KEYS.map((key, i) => {
                const row = CHAIN[key];
                return (
                  <tr key={key}>
                    <th scope="row">
                      <span className={styles.wlIcon}>
                        <TabIcon path={CHAIN_ICONS[key]} />
                      </span>
                      {i + 1}. {t(`chain.${key}.name`)}
                    </th>
                    <td>{t(`chain.${key}.where`)}</td>
                    <td>{t(`chain.${key}.pain`)}</td>
                    <td>
                      <span
                        className={cx(
                          styles.value,
                          styles[`value-${row.data}`],
                        )}
                      >
                        {t(`values.${row.data}`)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={cx(
                          styles.value,
                          styles[IMPACT_TONE[row.impact]],
                        )}
                      >
                        {t(`values.${row.impact}`)}
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
        <ExportTrend />
        <div className={styles.insight}>
          <span className={styles.takeawayIcon}>
            <TabIcon path={KPI_ICONS.exports} />
          </span>
          <div>
            <b>{t("discover.insightTitle")}</b>
            <p className={styles.profileText}>{t("discover.insightBody")}</p>
          </div>
        </div>
      </div>

      <p className={styles.source}>{t("discover.source")}</p>
    </>
  );
}

// Chart geometry, in viewBox units.
const CHART = {
  width: 1100,
  height: 300,
  left: 52,
  right: 16,
  top: 12,
  bottom: 30,
};

/** Monthly exports, this year against last: crosshair and tooltip on hover/focus, a table for screen readers. */
function ExportTrend() {
  const t = useTranslations("Colombia.discover");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);
  const { year, current, previous } = EXPORT_TREND;
  const count = current.length;

  const number = new Intl.NumberFormat(locale);
  const months = current.map((_, i) =>
    new Date(year, i, 1).toLocaleString(locale, { month: "short" }),
  );
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  const x = (i: number) => CHART.left + (plotW * i) / (count - 1);
  const y = (v: number) => CHART.top + plotH * (1 - v / EXPORT_TREND_MAX);
  const path = (series: readonly number[]) =>
    `M${series.map((v, i) => `${x(i)},${y(v)}`).join("L")}`;
  const line = path(current);
  const area = `${line}L${x(count - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const value = (v: number) => t("trendValue", { value: number.format(v) });

  function pick(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(
      Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))),
    );
  }

  return (
    <figure className={styles.trend}>
      <figcaption className={styles.trendCaption}>
        {t("trendSubtitle")}
        <span className={styles.trendLegend}>
          <span className={styles.trendKeyCurrent} aria-hidden="true" />
          {year}
          <span className={styles.trendKeyPrevious} aria-hidden="true" />
          {year - 1}
        </span>
      </figcaption>
      <div className={styles.trendPlot}>
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label={t("trendLabel", {
            first: value(current[0]),
            last: value(current[count - 1]),
          })}
          tabIndex={0}
          onFocus={() => setActive(count - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft")
              setActive((i) => Math.max(0, (i ?? 0) - 1));
            if (event.key === "ArrowRight")
              setActive((i) => Math.min(count - 1, (i ?? 0) + 1));
          }}
        >
          <defs>
            <linearGradient id="export-trend-fill" x1="0" x2="0" y1="0" y2="1">
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
          {EXPORT_TREND_TICKS.map((tick) => (
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
                {number.format(tick)}
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
          <path d={path(previous)} className={styles.trendLinePrevious} />
          <path d={area} fill="url(#export-trend-fill)" />
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
          {current.map((v, i) => (
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
              top: `${(y(current[active]) / CHART.height) * 100}%`,
            }}
            aria-hidden="true"
          >
            <span>
              {months[active]} {year}
            </span>
            <b>{value(current[active])}</b>
            <span>
              {year - 1}: {value(previous[active])}
            </span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{t("trendSubtitle")}</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">{year}</th>
            <th scope="col">{year - 1}</th>
          </tr>
        </thead>
        <tbody>
          {current.map((v, i) => (
            <tr key={i}>
              <th scope="row">{months[i]}</th>
              <td>{value(v)}</td>
              <td>{value(previous[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
