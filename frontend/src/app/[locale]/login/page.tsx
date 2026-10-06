import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  params: Promise<{ locale: string }>;
};

export default function LoginPage({ params }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <LoginForm />;
}
