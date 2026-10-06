"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { withBasePath } from "@/lib/basePath";
import { useAspire } from "./AspireProvider";
import { fetchWithSession } from "./api";
import styles from "./aspire.module.css";

type Message = { mine: boolean; text: string };

/** Floating coach: talks to the Foundry agent through /api/coach/chat. */
export function CoachWidget() {
  const t = useTranslations("Aspire.coach");
  const { viewer, coachOpen, setCoachOpen } = useAspire();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keeps the Foundry conversation so follow-up questions have context.
  const conversationId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || pending) return;

    setInput("");
    setError(null);
    setMessages((current) => [...current, { mine: true, text: question }]);
    setPending(true);

    try {
      const response = await fetchWithSession("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, conversation_id: conversationId.current }),
      });
      if (!response) throw new Error("no_session");
      const data: { answer?: string; conversation_id?: string } = await response.json();
      if (!response.ok || !data.answer) throw new Error("coach_unavailable");
      if (data.conversation_id) conversationId.current = data.conversation_id;
      setMessages((current) => [...current, { mine: false, text: data.answer! }]);
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }

  const greeting = t("greeting", { team: viewer.teamName ?? t("teamFallback") });

  return (
    <div className={styles.coachDock}>
      {coachOpen && (
        <section className={styles.coachPanel} aria-label={t("title")}>
          <header className={`dark ${styles.coachHeader}`}>
            <div className={styles.coachTitles}>
              <h2 className={styles.coachTitle}>{t("title")}</h2>
              <span className={styles.coachSubtitle}>{t("subtitle")}</span>
            </div>
            <button type="button" className={styles.iconButton} onClick={() => setCoachOpen(false)} aria-label={t("close")}>
              <Icon name="x" size={16} />
            </button>
          </header>
          <div ref={listRef} className={styles.coachMessages} aria-live="polite">
            <p className={styles.message}>{greeting}</p>
            {messages.map((message, index) => (
              <p key={index} className={`${styles.message} ${message.mine ? styles.messageMine : ""}`}>
                {message.text}
              </p>
            ))}
            {pending && <p className={styles.message}>{t("thinking")}</p>}
          </div>
          {error && (
            <p className={styles.coachError} role="alert">
              {error}
            </p>
          )}
          <form className={styles.coachForm} onSubmit={send}>
            <input
              className={styles.coachInput}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("inputLabel")}
              maxLength={4000}
              disabled={pending}
            />
            <button type="submit" className={`${styles.ctaButton} ${styles.coachSend}`} disabled={pending || !input.trim()}>
              {t("send")}
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className={styles.coachLauncher}
        onClick={() => setCoachOpen(!coachOpen)}
        aria-expanded={coachOpen}
        aria-label={coachOpen ? t("close") : t("open")}
        title={t("open")}
      >
        <Image src={withBasePath("/dashboard/astronaut.png")} alt="" width={64} height={64} />
      </button>
    </div>
  );
}
