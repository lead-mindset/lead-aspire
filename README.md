# lead-template

Starting point for every LEAD app (Talent, Pulse, Aspire, …). It includes only
what every app needs on day one:

- Next.js (App Router, TypeScript, `src/`) with a configurable `basePath` for
  [Multi Zones](docs/adr/0001-stack.md)
- Tailwind CSS v4 wired to the [LEAD design system](https://claude.ai/artifact/95H4SYHVEAMeEFrhpLyEtE):
  tokens, fonts, logos and components (live reference at `/<locale>/design-system`)
- next-intl with `es` (default) and `en`, locale always in the URL
- Supabase (`@supabase/ssr`) with Google sign in and session refresh
- Resend for transactional email
- Jest + React Testing Library, Playwright, ESLint, Prettier, GitHub Actions CI

There is no business logic and no app-specific tables. See
[ADR 0001](docs/adr/0001-stack.md) for why this stack and how Multi Zones works.

## Create a new app from this template

Replace `talent` / `TALENT_URL` below with your app's route and variable.

1. **Use the template.** On GitHub, click **Use this template** → **Create a
   new repository** (e.g. `lead-talent`). Clone it and run `npm install`.
2. **Set the base path.** Copy `.env.example` to `.env.local` and set
   `BASE_PATH=/talent`. Set the same variable in Vercel (all
   environments), along with the other variables from `.env.example`.
   In Vercel, add `BASE_PATH` and the `NEXT_PUBLIC_*` variables as type
   **Config**: they reach the browser by design and are not secrets. Add
   `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` as secrets.
3. **Create the Vercel project.** Import the repo into Vercel. Do **not** add a
   custom domain; the app is served through leadmain.
4. **Wire it into leadmain.** In the leadmain Vercel project, add the app URL
   variable (`TALENT_URL`, `PULSE_URL`, `ASPIRE_URL`, …) pointing to the new
   project's production URL (e.g. `https://lead-talent.vercel.app`), then
   **redeploy leadmain**.
5. **Register redirect URLs, including the base path.**
   - Supabase → Authentication → URL Configuration → Redirect URLs:
     - `https://www.leadmindset.org/talent/auth/callback`
     - `http://localhost:3000/talent/auth/callback` (local development)
   - Google Cloud Console → APIs & Services → Credentials → your OAuth client →
     Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`.
     Add `https://www.leadmindset.org` (and `http://localhost:3000`) to
     Authorized JavaScript origins.
   - Enable the Google provider in Supabase → Authentication → Providers with
     the Google client ID and secret.
6. **Protect `main`.** GitHub → Settings → Branches → add a rule for `main`:
   require a pull request, require the **CI / Lint, typecheck and unit tests**
   check to pass, and block force pushes. Replace the placeholder owner in
   `.github/CODEOWNERS`.

Then update `README.md`, the `name` in `package.json`, `project_id` in
`supabase/config.toml`, and the metadata in `messages/*.json`.

## Local development

Requirements: Node (version in [`.nvmrc`](.nvmrc), e.g. `nvm use`) and npm.
Docker is only needed for a local Supabase.

```bash
npm install
cp .env.example .env.local        # fill in the values
npm run dev                        # http://localhost:3000 (or /<base path>)
```

- With `BASE_PATH` empty, the app is at `http://localhost:3000/es`.
- With `BASE_PATH=/talent`, it is at `http://localhost:3000/talent/es`.
- `NEXT_PUBLIC_SITE_URL` is the public origin without the base path
  (`http://localhost:3000` locally, `https://www.leadmindset.org` in production).
- `/` redirects to a locale. next-intl picks it from the `NEXT_LOCALE` cookie or
  the browser's `Accept-Language`, and falls back to `es`.

**Windows / Git Bash:** Git Bash rewrites `/talent` into a Windows path when
it's passed on the command line. Set the base path in `.env.local`, use
PowerShell, or prefix the command with `MSYS_NO_PATHCONV=1`.

### Local Supabase (optional)

```bash
npx supabase start                 # needs Docker; prints local URL and keys
npx supabase migration new <name>  # creates supabase/migrations/<timestamp>_<name>.sql
npx supabase db reset              # re-applies all migrations locally
```

To try Google sign in locally, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in `supabase/.env`, and set
`enabled = true` under `[auth.external.google]` in `supabase/config.toml`.

### End-to-end tests

```bash
npx playwright install chromium    # first time only
npm run test:e2e                   # builds, starts the app and runs e2e/
```

Playwright reads `BASE_PATH` from `.env.local` (or the
environment), so the same tests run at the root or under a base path.

## npm scripts

| Script                 | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the dev server                                   |
| `npm run build`        | Production build                                       |
| `npm run start`        | Serve the production build                             |
| `npm run lint`         | ESLint                                                 |
| `npm run typecheck`    | `tsc --noEmit`                                         |
| `npm test`             | Jest unit tests                                        |
| `npm run test:watch`   | Jest in watch mode                                     |
| `npm run test:e2e`     | Playwright tests (builds and starts the app if needed) |
| `npm run format`       | Format all files with Prettier                         |
| `npm run format:check` | Check formatting without writing                       |

## Conventions

- **Base path.** `<Link>`, `useRouter`, `redirect` (from `@/i18n/navigation`)
  and `/_next` assets get the base path automatically. For everything else
  (files in `public/`, `<img>`/`<video>` `src`, client-side `fetch`, OAuth
  `redirectTo`), use `withBasePath()` from `@/lib/basePath`.
- **Text.** All UI strings live in `messages/en.json` and `messages/es.json`.
  Never hardcode text in components.
- **Design system.** The [LEAD design system](https://claude.ai/artifact/95H4SYHVEAMeEFrhpLyEtE)
  is the source of truth; `/<locale>/design-system` shows what this app
  implements. Build only from its tokens: Tailwind's default colors, radii,
  shadows and type scale are removed.
  - Colors are semantic: `bg-surface`, `text-ink`, `text-heading`,
    `bg-primary text-on-primary`, `border-line`, `text-danger`, … They switch
    for dark mode automatically: they follow the OS until someone uses the
    header theme toggle (`ThemeToggle`), which sets `<html data-theme>` and
    remembers the choice in `localStorage`.
    Identity colors (`brand-navy`, `brand-red`, …) are for large fields and
    graphics only.
  - Type: `text-display`, `text-h1`…`text-h4`, `text-body-lg`, `text-body`,
    `text-label`, `text-small`, `text-caption`, `text-overline` (add
    `font-display` for the display group). h1–h4 are styled by default.
  - Spacing `1`–`8` equal `space-1`…`space-8` (`p-5` = 24px). Radii
    `rounded-sm|md|lg|xl|pill`. Shadows `shadow-sm|md`.
  - `gradient-brand` once per view at most, marketing only, never in app
    controls. `gradient-logo` only to echo the logo.
  - Components live in `src/components/ui` with the design system's names and
    props (`Button`, `Link`, `Toggle`, `SegmentedControl`, `TextField`,
    `Header`, `Breadcrumbs`, `Pagination`, `ProgressBar`, `Tooltip`, `Icon`);
    their styles are in `src/styles/components.css`. Use `buttonClasses()` /
    `linkClasses()` to style next-intl `<Link>`s.
  - Logos: `public/lead-mark.png` on light surfaces, `public/lead-logo-on-dark.png`
    only on navy (`<Logo variant="on-dark" />`).
  - Voice: tú, sentence case, verb-first buttons, no emoji in UI.
- **Supabase.** Use `@/lib/supabase/client` in Client Components and
  `@/lib/supabase/server` on the server. `SUPABASE_SERVICE_ROLE_KEY` is
  server-only; never import it in client code.
- **Email.** Call `sendEmail()` from `@/lib/email/send` on the server only
  (Server Actions, Route Handlers).

## Project structure

```
src/
  app/
    [locale]/            layout (Header/Footer), home, login, dashboard (protected),
                         design-system (token and component reference)
    auth/callback/       OAuth code exchange → /<base path>/<locale>
  components/
    ui/                  Design system components (Button, TextField, Header, …)
    brand/               Logo, app Header (wires ui/Header to routes), Footer
    auth/                Google sign-in and sign-out buttons
    i18n/                Locale switcher
  i18n/                  next-intl routing, navigation and request config
  lib/
    designSystem.ts      Link to the design system
    basePath.ts          BASE_PATH and withBasePath()
    email/send.ts        sendEmail() with Resend
    supabase/            browser client, server client, proxy session refresh
  styles/
    globals.css          Design system tokens in Tailwind v4 @theme (light + dark)
    components.css       Design system component styles (ld-* classes)
    fonts.ts, fonts/     Montserrat and Source Sans 3, self-hosted with next/font
  proxy.ts               next-intl + Supabase session refresh (formerly middleware.ts)
messages/                en.json, es.json
supabase/                Supabase CLI config and migrations
e2e/                     Playwright tests
docs/adr/                Architecture decision records
```
