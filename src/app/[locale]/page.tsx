import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function HomePage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("HomePage");
  const brand = useTranslations("Brand");

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-7 sm:py-8">
      <div className="flex max-w-3xl flex-col gap-5">
        <p className="font-display text-overline text-primary uppercase">
          {brand("tagline")}
        </p>
        <h1 className="text-h1 sm:text-display">{t("title")}</h1>
        <p className="text-body-lg">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className={buttonClasses({ size: "lg" })}>
            {t("cta")}
          </Link>
          <Link
            href="/design-system"
            className={buttonClasses({ variant: "secondary", size: "lg" })}
          >
            {t("designSystem")}
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
