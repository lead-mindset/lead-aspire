"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

type Props = { text: string };

export function CopyButton({ text }: Props) {
  const t = useTranslations("NewYorkPage");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      iconLeft={status === "copied" ? "check" : undefined}
      onClick={copy}
    >
      <span aria-live="polite">
        {status === "copied"
          ? t("copied")
          : status === "failed"
            ? t("copyFailed")
            : t("copy")}
      </span>
    </Button>
  );
}
