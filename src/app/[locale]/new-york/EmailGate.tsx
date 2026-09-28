"use client";

import {
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

// Remembered in this browser only; the email is not sent anywhere yet.
const STORAGE_KEY = "aspire.new-york.email";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readStoredEmail(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Storage blocked: the student enters the email again.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

type Props = { children: ReactNode };

/** Hides the guide until the student enters an email. */
export function EmailGate({ children }: Props) {
  const t = useTranslations("NewYorkPage.gate");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const storedEmail = useSyncExternalStore(
    subscribe,
    readStoredEmail,
    () => null,
  );
  const unlocked = unlockedNow || Boolean(storedEmail);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError(true);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Unlock for this visit only.
    }
    setUnlockedNow(true);
  }

  if (unlocked) return <>{children}</>;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">{t("title")}</h2>
        <p className="text-ink-muted">{t("body")}</p>
      </div>
      <TextField
        label={t("label")}
        type="email"
        name="email"
        autoComplete="email"
        placeholder={t("placeholder")}
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setError(false);
        }}
        state={error ? "error" : undefined}
        message={error ? t("error") : undefined}
      />
      <Button type="submit" iconRight="arrow-right" className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
