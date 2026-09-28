import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";
import { Link } from "@/components/ui/Link";
import { Pagination } from "@/components/ui/Pagination";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";

type Props = {
  params: Promise<{ locale: string }>;
};

const SEMANTIC_COLORS = [
  "surface",
  "surface-alt",
  "surface-raised",
  "surface-inverse",
  "line",
  "line-strong",
  "heading",
  "ink",
  "ink-muted",
  "ink-disabled",
  "on-inverse",
  "primary",
  "primary-strong",
  "on-primary",
  "primary-soft",
  "accent",
  "accent-soft",
  "danger",
  "danger-soft",
  "success",
  "success-soft",
  "focus-ring",
];

const IDENTITY_COLORS = [
  "brand-navy",
  "brand-navy-900",
  "brand-navy-700",
  "brand-red",
  "brand-magenta",
  "brand-purple",
  "brand-violet",
  "logo-red",
  "logo-purple",
];

// Literal class names so Tailwind picks them up.
const TYPE_STYLES = [
  { name: "wordmark", className: "font-display text-wordmark uppercase" },
  { name: "display", className: "font-display text-display" },
  { name: "h1", className: "font-display text-h1" },
  { name: "h2", className: "font-display text-h2" },
  { name: "h3", className: "font-display text-h3" },
  { name: "h4", className: "font-display text-h4" },
  { name: "overline", className: "font-display text-overline uppercase" },
  { name: "body-lg", className: "text-body-lg" },
  { name: "body", className: "text-body" },
  { name: "body-strong", className: "text-body-strong" },
  { name: "label", className: "text-label" },
  { name: "small", className: "text-small" },
  { name: "caption", className: "text-caption" },
] as const;

type ParticipantStatus = "enrolled" | "pending" | "cancelled";

const TABLE_ROWS: {
  id: string;
  progress: number;
  status: ParticipantStatus;
}[] = [
  { id: "r1", progress: 100, status: "enrolled" },
  { id: "r2", progress: 65, status: "enrolled" },
  { id: "r3", progress: 20, status: "pending" },
  { id: "r4", progress: 0, status: "cancelled" },
];

const STATUS_STYLE: Record<
  ParticipantStatus,
  { icon: "check-circle" | "info" | "x"; className: string }
> = {
  enrolled: { icon: "check-circle", className: "text-success" },
  pending: { icon: "info", className: "text-ink-muted" },
  cancelled: { icon: "x", className: "text-danger" },
};

/** Status always pairs color with an icon and words. */
function Status({
  status,
  label,
}: {
  status: ParticipantStatus;
  label: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${style.className}`}
    >
      <Icon name={style.icon} size={16} />
      {label}
    </span>
  );
}

const SPACING = [1, 2, 3, 4, 5, 6, 7, 8];
const RADII = ["sm", "md", "lg", "xl", "pill"];
const SHADOWS = ["sm", "md"];
const GRADIENTS = ["brand", "logo"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DesignSystemPage" });
  return { title: t("title") };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-t border-line pt-7">
      <div className="flex flex-col gap-2">
        <h2>{title}</h2>
        {description && <p className="text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function TokenName({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-caption text-ink-muted">{children}</code>
  );
}

function Swatches({ names }: { names: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {names.map((name) => (
        <li key={name} className="flex flex-col gap-2">
          <div
            className="h-7 rounded-md border border-line"
            style={{ background: `var(--color-${name})` }}
          />
          <TokenName>{name}</TokenName>
        </li>
      ))}
    </ul>
  );
}

export default async function DesignSystemPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DesignSystemPage");

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 py-7 sm:py-8">
      <header className="flex max-w-3xl flex-col gap-4">
        <p className="font-display text-overline text-primary uppercase">
          {t("overline")}
        </p>
        <h1>{t("title")}</h1>
        <p className="text-body-lg">{t("intro")}</p>
      </header>

      <Section title={t("colors.title")} description={t("colors.semantic")}>
        <Swatches names={SEMANTIC_COLORS} />
        <p className="text-ink-muted">{t("colors.identity")}</p>
        <Swatches names={IDENTITY_COLORS} />
      </Section>

      <Section
        title={t("typography.title")}
        description={t("typography.description")}
      >
        <ul className="flex flex-col gap-4">
          {TYPE_STYLES.map((style) => (
            <li
              key={style.name}
              className="grid gap-1 sm:grid-cols-[120px_1fr] sm:items-baseline sm:gap-5"
            >
              <TokenName>{style.name}</TokenName>
              <span className={`${style.className} text-heading`}>
                {t(`typography.samples.${style.name}`)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t("spacing.title")}
        description={t("spacing.description")}
      >
        <ul className="flex flex-col gap-2">
          {SPACING.map((n) => (
            <li key={n} className="flex items-center gap-4">
              <span className="w-[72px]">
                <TokenName>{`space-${n}`}</TokenName>
              </span>
              <span
                className="h-4 rounded-sm bg-accent"
                style={{ width: `var(--spacing-${n})` }}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("shape.title")} description={t("shape.description")}>
        <ul className="flex flex-wrap gap-5">
          {RADII.map((r) => (
            <li key={r} className="flex flex-col items-center gap-2">
              <div
                className="size-8 border border-line-strong bg-primary-soft"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <TokenName>{`radius-${r}`}</TokenName>
            </li>
          ))}
          {SHADOWS.map((s) => (
            <li key={s} className="flex flex-col items-center gap-2">
              <div
                className="size-8 rounded-md bg-surface-raised"
                style={{ boxShadow: `var(--shadow-${s})` }}
              />
              <TokenName>{`shadow-${s}`}</TokenName>
            </li>
          ))}
          {GRADIENTS.map((g) => (
            <li key={g} className="flex flex-col items-center gap-2">
              <div
                className="size-8 rounded-md"
                style={{ backgroundImage: `var(--gradient-${g})` }}
              />
              <TokenName>{`gradient-${g}`}</TokenName>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t("components.title")}
        description={t("components.description")}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Demo title="Button">
            <div className="flex flex-wrap items-center gap-3">
              <Button>{t("components.primary")}</Button>
              <Button variant="secondary" iconRight="chevron-down">
                {t("components.secondary")}
              </Button>
              <Button variant="ghost">{t("components.ghost")}</Button>
              <Button
                variant="secondary"
                iconOnly="arrow-left"
                aria-label={t("components.back")}
              />
              <Button disabled>{t("components.disabled")}</Button>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button variant="gradient" size="lg" iconRight="arrow-right">
                {t("components.gradient")}
              </Button>
              <p className="text-small text-ink-muted">
                {t("components.gradientNote")}
              </p>
            </div>
          </Demo>

          <Demo title="Link">
            <div className="flex flex-wrap items-center gap-5">
              <Link href="#components">{t("components.link")}</Link>
              <Link href="#components" iconRight="arrow-right">
                {t("components.linkIcon")}
              </Link>
              <Link disabled>{t("components.disabled")}</Link>
            </div>
          </Demo>

          <Demo title="Toggle">
            <div className="flex flex-wrap items-center gap-5">
              <Toggle label={t("components.toggle")} defaultChecked />
              <Toggle label={t("components.toggle")} />
              <Toggle label={t("components.disabled")} disabled />
            </div>
          </Demo>

          <Demo title="SegmentedControl">
            <SegmentedControl
              label={t("components.segmentedLabel")}
              className="self-start"
              options={[
                { value: "day", label: t("components.day") },
                { value: "week", label: t("components.week") },
                { value: "month", label: t("components.month") },
              ]}
            />
          </Demo>

          <Demo title="TextField">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={t("components.email")}
                type="email"
                placeholder={t("components.emailPlaceholder")}
                message={t("components.emailHelp")}
              />
              <TextField
                label={t("components.password")}
                type="password"
                defaultValue={t("components.passwordValue")}
                state="error"
                message={t("components.passwordError")}
              />
              <TextField
                label={t("components.name")}
                defaultValue={t("components.nameValue")}
                state="success"
                message={t("components.nameSuccess")}
              />
              <TextField
                label={t("components.disabled")}
                placeholder={t("components.emailPlaceholder")}
                disabled
              />
            </div>
          </Demo>

          <Demo title="Breadcrumbs">
            <Breadcrumbs
              items={[
                { label: t("components.crumbHome"), href: "#components" },
                { label: t("components.crumbPrograms"), href: "#components" },
                { label: t("components.crumbCurrent") },
              ]}
            />
          </Demo>

          <Demo title="Pagination">
            <Pagination total={5} defaultPage={2} />
          </Demo>

          <Demo title="ProgressBar">
            <ProgressBar value={65} label={t("components.progress")} />
          </Demo>

          <Demo title="Table" className="lg:col-span-2">
            <Table
              caption={t("components.table.caption")}
              columns={[
                { key: "name", header: t("components.table.name") },
                { key: "program", header: t("components.table.program") },
                {
                  key: "progress",
                  header: t("components.table.progress"),
                  align: "end",
                  render: (row) => `${row.progress}%`,
                },
                {
                  key: "status",
                  header: t("components.table.status"),
                  render: (row) => (
                    <Status
                      status={row.status}
                      label={t(`components.table.statuses.${row.status}`)}
                    />
                  ),
                },
              ]}
              rows={TABLE_ROWS.map((row) => ({
                ...row,
                name: t(`components.table.rows.${row.id}.name`),
                program: t(`components.table.rows.${row.id}.program`),
              }))}
              getRowKey={(row) => row.id}
              selectedKey="r2"
            />
            <p className="text-small text-ink-muted">
              {t("components.table.note")}
            </p>
            <Table
              caption={t("components.table.emptyCaption")}
              columns={[
                { key: "name", header: t("components.table.name") },
                { key: "program", header: t("components.table.program") },
              ]}
              rows={[] as { id: string }[]}
              getRowKey={(row) => row.id}
              emptyMessage={t("components.table.empty")}
            />
          </Demo>

          <Demo title="Tooltip">
            <div className="flex items-center gap-2">
              <span>{t("components.tooltipTrigger")}</span>
              <Tooltip content={t("components.tooltip")} />
            </div>
          </Demo>

          <Demo title="Icon">
            <ul className="flex flex-wrap gap-4 text-heading">
              {ICON_NAMES.map((name) => (
                <li
                  key={name}
                  className="flex w-[88px] flex-col items-center gap-1"
                >
                  <Icon name={name} />
                  <TokenName>{name}</TokenName>
                </li>
              ))}
            </ul>
          </Demo>
        </div>
      </Section>
    </div>
  );
}

function Demo({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={title === "Button" ? "components" : undefined}
      className={`flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5 ${className ?? ""}`}
    >
      <h3>{title}</h3>
      {children}
    </div>
  );
}
