import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function DallasPage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("DallasPage");

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-[1200px] flex-col items-center justify-center gap-5 px-4 py-7 text-center sm:py-8">
      <h1>{t("title")}</h1>
      <p className="text-ink-muted">{t("placeholder")}</p>
      <Link href="/" className={buttonClasses({ variant: "ghost" })}>
        <Icon name="arrow-left" size={18} />
        {t("back")}
      </Link>
    </section>
  );
}
