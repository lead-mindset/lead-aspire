import Image from "next/image";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/basePath";

type LogoProps = {
  /**
   * "mark": the mark alone, for white and light surfaces (1598×939).
   * "on-dark": mark above the white wordmark, only on navy (1598×1416).
   */
  variant?: "mark" | "on-dark";
  /** Rendered height in px. Minimum 24 for the mark, 64 for the full logo. */
  height?: number;
  className?: string;
};

const ASSETS = {
  mark: { src: "/lead-mark.png", ratio: 1598 / 939, min: 24 },
  "on-dark": { src: "/lead-logo-on-dark.png", ratio: 1598 / 1416, min: 64 },
} as const;

/** Never recolor, stretch or place the logo on the gradient or on photos. */
export function Logo({ variant = "mark", height, className }: LogoProps) {
  const t = useTranslations("Brand");
  const asset = ASSETS[variant];
  const h = Math.max(height ?? asset.min, asset.min);

  return (
    <Image
      src={withBasePath(asset.src)}
      alt={t("logoAlt")}
      height={h}
      width={Math.round(h * asset.ratio)}
      className={className}
    />
  );
}
