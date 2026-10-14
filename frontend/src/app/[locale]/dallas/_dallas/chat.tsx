"use client";

// One chat with a Foundry agent through the Dallas API: the coach
// (CoachWidget.tsx) and each stakeholder (views.tsx, Discover > Stakeholders).

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { API_URL } from "./student";
import styles from "./dallas.module.css";

type Message = { mine: boolean; text: string };

export type ChatLabels = {
  title: string;
  subtitle: string;
  greeting: string;
  thinking: string;
  error: string;
  placeholder: string;
  inputLabel: string;
  send: string;
  close: string;
};

/**
 * The panel itself. It keeps its messages and Foundry conversation while
 * mounted, so hide it (`hidden`) rather than unmount it to keep the history.
 */
export function ChatPanel({
  path,
  labels,
  avatar,
  hidden = false,
  onClose,
}: {
  /** Under /api/dallas, e.g. "/coach/chat". */
  path: string;
  labels: ChatLabels;
  /** Photo in the header (a stakeholder); none for the coach. */
  avatar?: string;
  hidden?: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keeps the Foundry conversation so follow-up questions have context.
  const conversationId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, hidden]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || pending) return;

    setInput("");
    setError(null);
    setMessages((current) => [...current, { mine: true, text: question }]);
    setPending(true);

    try {
      const { data: auth } = await createClient().auth.getSession();
      const token = auth.session?.access_token;
      if (!token) throw new Error("no_session");
      const response = await fetch(`${API_URL}/api/dallas${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          conversation_id: conversationId.current,
        }),
      });
      const data: { answer?: string; conversation_id?: string } =
        await response.json();
      if (!response.ok || !data.answer) throw new Error("chat_unavailable");
      if (data.conversation_id) conversationId.current = data.conversation_id;
      setMessages((current) => [
        ...current,
        { mine: false, text: data.answer! },
      ]);
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={styles.coachPanel}
      aria-label={labels.title}
      hidden={hidden}
    >
      <header className={`dark ${styles.coachHeader}`}>
        {avatar && (
          <Image
            src={avatar}
            alt=""
            width={44}
            height={44}
            className={styles.chatAvatar}
          />
        )}
        <div className={styles.coachTitles}>
          <h2 className={styles.coachTitle}>{labels.title}</h2>
          <span className={styles.coachSubtitle}>{labels.subtitle}</span>
        </div>
        <button
          type="button"
          className={styles.coachClose}
          onClick={onClose}
          aria-label={labels.close}
        >
          ×
        </button>
      </header>
      <div ref={listRef} className={styles.coachMessages} aria-live="polite">
        <p className={styles.coachMessage}>{labels.greeting}</p>
        {messages.map((message, index) => (
          <p
            key={index}
            className={`${styles.coachMessage} ${message.mine ? styles.coachMessageMine : ""}`}
          >
            {message.text}
          </p>
        ))}
        {pending && <p className={styles.coachMessage}>{labels.thinking}</p>}
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
          placeholder={labels.placeholder}
          aria-label={labels.inputLabel}
          maxLength={4000}
          disabled={pending}
        />
        <button
          type="submit"
          className={styles.coachSend}
          disabled={pending || !input.trim()}
        >
          {labels.send}
        </button>
      </form>
    </section>
  );
}
