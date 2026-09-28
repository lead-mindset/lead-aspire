import { useTranslations } from "next-intl";
import { Logo } from "./Logo";

/** Navy band: surface-inverse with on-inverse text and the on-dark logo. */
export function Footer() {
  const t = useTranslations("Footer");
  const brand = useTranslations("Brand");

  return (
    <footer className="bg-surface-inverse text-on-inverse">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-4 px-4 py-5 text-center sm:flex-row sm:gap-5 sm:text-left">
        <Logo variant="on-dark" height={64} />
        <div className="flex flex-col gap-1">
          <p className="font-display text-overline uppercase">
            {brand("tagline")}
          </p>
          <p className="text-caption text-on-inverse/80">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
