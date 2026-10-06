import { setRequestLocale, getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string; resource: string }> };

export default async function NewYorkResourcePage({ params }: Props) {
  const { locale, resource } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("NewYorkDashboard");
  const title = t(`resources.${resource}.title`);
  const pdf = `/new-york/pdfs/${resource}.pdf`;

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-[1200px] flex-col gap-5 px-4 py-7 sm:py-10">
      <Link href="/new-york" className={buttonClasses({ variant: "ghost", size: "sm", className: "self-start" })}>
        <Icon name="arrow-left" size={18} />
        {t("backDashboard")}
      </Link>
      <div>
        <p className="text-overline uppercase tracking-widest text-primary">{t("resourceReader")}</p>
        <h1 className="mt-2 text-h1">{title}</h1>
      </div>
      <iframe title={title} src={pdf} className="min-h-[70vh] w-full rounded-lg border border-line bg-surface-raised" />
    </main>
  );
}
