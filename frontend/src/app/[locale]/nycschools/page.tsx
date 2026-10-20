import { setRequestLocale } from "next-intl/server";
import { HomeView } from "./_nyc/HomeView";

type Props = { params: Promise<{ locale: string }> };

export default async function NycSchoolsHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeView />;
}
