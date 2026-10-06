"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAspire } from "./AspireProvider";
import { fetchWithSession } from "./api";
import styles from "./aspire.module.css";

type City = "newYork" | "dallas";
type CityFilter = "all" | City;

type AdminTeam = {
  group_code: string;
  group_name: string;
  city_code: string | null;
  members: number;
  deck_file: string | null;
  demo_link: string | null;
};

const CITY_BY_CODE: Record<string, City> = { NYC: "newYork", DFW: "dallas" };

/** Admin table of every team and whether it uploaded its final deck. */
export function ProjectsView() {
  const t = useTranslations("Aspire.projects");
  const tCity = useTranslations("Aspire.cities");
  const { setOpenTarget } = useAspire();
  const [city, setCity] = useState<CityFilter>("all");
  const [allTeams, setAllTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);

  async function openDeck(team: AdminTeam) {
    setOpening(team.group_code);
    setOpenError(false);
    try {
      const response = await fetchWithSession(`/api/admin/teams/${encodeURIComponent(team.group_code)}/deck`);
      if (!response?.ok) throw new Error("deck_unavailable");
      const deck = (await response.json()) as {
        file_name: string;
        demo_link: string | null;
        view_url: string;
        download_url: string;
      };
      setOpenTarget({
        kind: "deck",
        team: team.group_name,
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadTeams() {
      const response = await fetchWithSession("/api/admin/teams", { signal: controller.signal });
      if (!response?.ok) throw new Error("teams_unavailable");
      const body = (await response.json()) as { teams: AdminTeam[] };
      setAllTeams(body.teams);
    }

    loadTeams().catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, []);

  const teams = (allTeams ?? []).filter(
    (team) => city === "all" || (team.city_code !== null && CITY_BY_CODE[team.city_code] === city),
  );
  const submitted = teams.filter((team) => team.deck_file).length;

  return (
    <div className={styles.projects}>
      <div className={styles.projectsHead}>
        <div className={styles.projectsTitleBlock}>
          <span className={styles.projectsEyebrow}>{t("eyebrow")}</span>
          <h1 className={styles.projectsTitle}>{t("title")}</h1>
          <p className={styles.helpBody}>
            {error
              ? t("loadError")
              : openError
                ? t("openError")
                : allTeams
                ? t("summary", { submitted, total: teams.length })
                : t("loading")}
          </p>
        </div>
        <div className={styles.filters} role="group" aria-label={t("filterLabel")}>
          {(["all", "newYork", "dallas"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.filter} ${city === key ? styles.filterActive : ""}`}
              aria-pressed={city === key}
              onClick={() => setCity(key)}
            >
              {key === "all" ? t("allCities") : tCity(key)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.table} role="table" aria-label={t("title")}>
        <div className={`${styles.tableRow} ${styles.tableHead}`} role="row">
          <span role="columnheader">{t("columns.team")}</span>
          <span role="columnheader">{t("columns.city")}</span>
          <span role="columnheader">{t("columns.deck")}</span>
          <span role="columnheader">{t("columns.link")}</span>
          <span role="columnheader">{t("columns.status")}</span>
          <span role="columnheader" />
        </div>
        {teams.map((team) => {
          const teamCity = team.city_code ? CITY_BY_CODE[team.city_code] : undefined;
          return (
            <div key={team.group_code} className={styles.tableRow} role="row">
              <div className={styles.teamCell} role="cell">
                <b>{team.group_name}</b>
                <span>{t("groupMembers", { group: team.group_code, count: team.members })}</span>
              </div>
              <span role="cell">{teamCity ? tCity(teamCity) : "—"}</span>
              <span role="cell" className={`${styles.fileCell} ${team.deck_file ? "" : styles.fileMissing}`}>
                {team.deck_file ?? t("notUploaded")}
              </span>
              <span role="cell" className={`${styles.fileCell} ${team.demo_link ? "" : styles.fileMissing}`}>
                {team.demo_link ? (
                  <a href={team.demo_link} target="_blank" rel="noopener noreferrer" title={team.demo_link}>
                    {team.demo_link}
                  </a>
                ) : (
                  t("noLink")
                )}
              </span>
              <span role="cell" className={`${styles.status} ${team.deck_file ? styles.statusSubmitted : ""}`}>
                {team.deck_file ? t("submitted") : t("pending")}
              </span>
              <span role="cell">
                <button
                  type="button"
                  className={styles.viewButton}
                  style={{ width: "100%" }}
                  disabled={!team.deck_file || opening !== null}
                  onClick={() => openDeck(team)}
                >
                  {opening === team.group_code ? t("opening") : t("view")}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
