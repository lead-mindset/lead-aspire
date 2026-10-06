import Image from "next/image";
import { useTranslations } from "next-intl";

/** Footer in the lead-platform-prototype style: brand L + tagline + copyright. */
export function Footer() {
  const t = useTranslations("Footer");
  const brand = useTranslations("Brand");

  return (
    <footer data-site-footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-6 py-3 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          {/* Intrinsic size keeps the 1598x939 aspect ratio; `sizes` makes Next
              pick a source wide enough for high-DPI screens. */}
          <Image
            src="/lead-mark.png"
            alt={brand("logoAlt")}
            width={1598}
            height={939}
            sizes="48px"
            className="h-6 w-auto"
          />
          <span className="text-small font-semibold">LEAD</span>
        </div>
        <p className="text-caption text-muted-foreground">{brand("tagline")}</p>
        <p className="text-caption text-muted-foreground">
          {t("copyright", { year: '2025' })}
        </p>
      </div>
    </footer>
  );
}
