import { redirect } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/** The root has no page of its own: send visitors straight to login. */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  return redirect({ href: "/login", locale });
}
