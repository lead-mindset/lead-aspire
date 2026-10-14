"use client";

// Organizer "View Teams Results" for Dallas, as in New York
// (new-york/_aspire/ProjectsView.tsx): every team's final deck and demo
// link from /api/dallas/admin (backend/app/dallas_admin.py). Admins only.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { DocViewer, type ViewerTarget } from "./resources";
import { API_URL } from "./student";
import styles from "./dallas.module.css";

type AdminTeam = {
  id: number;
  number: number;
  name: string;
  /** The name the team typed in Team Setup; null until set. */
  display_name: string | null;
  members: number;
  deck_file: string | null;
  demo_link: string | null;
};

async function request(path: string, signal?: AbortSignal) {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${API_URL}/api/dallas/admin${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal,
  });
}

/** Admin table of every Dallas team and whether it uploaded its final deck. */
export function TeamsResultsView() {
  const t = useTranslations("Dallas.teamsResults");
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [openError, setOpenError] = useState(false);
  const [target, setTarget] = useState<ViewerTarget | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const response = await request("/teams", controller.signal);
      if (!response.ok) throw new Error("teams_unavailable");
      const body = (await response.json()) as { teams: AdminTeam[] };
      setTeams(body.teams);
    }

    load().catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, []);

  async function openDeck(team: AdminTeam) {
    setOpening(team.id);
    setOpenError(false);
    try {
      const response = await request(`/teams/${team.id}/deck`);
      if (!response.ok) throw new Error("deck_unavailable");
      const deck = (await response.json()) as {
        file_name: string;
        demo_link: string | null;
        view_url: string;
        download_url: string;
      };
      setTarget({
        kind: "deck",
        team: team.display_name ?? team.name,
        file: deck.file_name,
        viewUrl: deck.view_url,
        downloadUrl: deck.download_url,
        demoLink: deck.demo_link,
      });
    } catch {
      setOpenError(true);
    } finally {
      setOpening(null);
    }
  }

  const submitted = (teams ?? []).filter((team) => team.deck_file).length;

  return (
    <div className={styles.content}>
      <section className={styles.section}>
        <div className={styles.teamsHead}>
          <span className={styles.teamsEyebrow}>{t("eyebrow")}</span>
          <h1 className={styles.teamsTitle}>{t("title")}</h1>
          <p className={styles.muted}>
            {error
              ? t("loadError")
              : openError
                ? t("openError")
                : teams
                  ? t("summary", { submitted, total: teams.length })
                  : t("loading")}
          </p>
        </div>

        <div className={styles.teamsTable} role="table" aria-label={t("title")}>
          <div
            className={`${styles.teamsRow} ${styles.teamsTableHead}`}
            role="row"
          >
            <span role="columnheader">{t("columns.team")}</span>
            <span role="columnheader">{t("columns.deck")}</span>
            <span role="columnheader">{t("columns.link")}</span>
            <span role="columnheader">{t("columns.status")}</span>
            <span role="columnheader" />
          </div>
          {(teams ?? []).map((team) => (
            <div key={team.id} className={styles.teamsRow} role="row">
              <div className={styles.teamsTeamCell} role="cell">
                <b>{team.display_name ?? team.name}</b>
                <span>
                  {t("teamMembers", { team: team.name, count: team.members })}
                </span>
              </div>
              <span
                role="cell"
                className={`${styles.teamsFileCell} ${team.deck_file ? "" : styles.teamsMissing}`}
              >
                {team.deck_file ?? t("notUploaded")}
              </span>
              <span
                role="cell"
                className={`${styles.teamsFileCell} ${team.demo_link ? "" : styles.teamsMissing}`}
              >
                {team.demo_link ? (
                  <a
                    href={team.demo_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={team.demo_link}
                  >
                    {team.demo_link}
                  </a>
                ) : (
                  t("noLink")
                )}
              </span>
              <span
                role="cell"
                className={`${styles.teamsStatus} ${team.deck_file ? styles.teamsStatusDone : ""}`}
              >
                {team.deck_file ? t("submitted") : t("pending")}
              </span>
              <span role="cell">
                <button
                  type="button"
                  className={styles.pillButton}
                  disabled={!team.deck_file || opening !== null}
                  onClick={() => openDeck(team)}
                >
                  {opening === team.id ? t("opening") : t("view")}
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      {target && (
        <DocViewer target={target} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}
