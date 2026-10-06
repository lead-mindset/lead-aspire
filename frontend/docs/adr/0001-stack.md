# ADR 0001: Stack and Multi Zones

- Status: Accepted
- Date: 2026-09-27

## Context

LEAD serves several products (Talent, Pulse, Aspire) under one domain,
`www.leadmindset.org`. Each product is built and deployed by a different team,
on its own schedule. We want:

- one domain and a consistent brand for users;
- independent deployments, so one app cannot break another;
- a shared starting point, so every app has auth, i18n, email, tests and CI on
  day one without copy-pasting from another app.

## Decision

### Multi Zones

We use [Next.js Multi Zones](https://nextjs.org/docs/app/guides/multi-zones).

- **leadmain** is the main zone. It serves `www.leadmindset.org` and rewrites
  `/talent`, `/pulse` and `/aspire` (and their subpaths) to separate Vercel
  projects, configured with `TALENT_URL`, `PULSE_URL`, etc.
- Each **child app** is its own Vercel project with no custom domain. It sets
  `basePath` to its route, via `BASE_PATH`, so its pages and
  `/_next` assets live under that route.
- Every app is created from this template (`lead-template`).

Because the browser only sees `www.leadmindset.org`, cookies (including the
Supabase session) are first-party for every zone. Navigating between zones is a
full page load; within a zone it is client-side.

`basePath` is read from an environment variable, not hard-coded, so the same
code runs at the root (local development, previews) or under any route.
Next.js prefixes `<Link>`, router navigation, `redirect()` and `/_next` assets
automatically. Everything else goes through `withBasePath()` in
`src/lib/basePath.ts`.

### Stack

| Concern         | Choice                                   | Why                                                                                                |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Framework       | Next.js (App Router, TypeScript, `src/`) | Multi Zones support, server components, first-class on Vercel.                                     |
| Styling         | Tailwind CSS v4, tokens in `@theme`      | Design system tokens live in CSS (`src/styles/globals.css`); components in `src/components/ui`.    |
| i18n            | next-intl, `en` and `es`, default `es`   | App Router native, locale always in the URL, so links and SEO are unambiguous.                     |
| Auth + database | Supabase with `@supabase/ssr`            | Postgres with RLS, Google OAuth, and cookie sessions that work in server components and the proxy. |
| Sign in         | Google through Supabase Auth             | Our users already have Google accounts; no passwords to manage.                                    |
| Email           | Resend                                   | Simple typed API for transactional email.                                                          |
| Unit tests      | Jest and React Testing Library           | Fast feedback on logic and components.                                                             |
| E2E tests       | Playwright                               | Real-browser checks, including under a base path.                                                  |
| Quality         | ESLint (next config), Prettier           | Consistent code across teams.                                                                      |
| Tooling         | npm, Node pinned in `.nvmrc`             | Same toolchain locally, in CI and on Vercel.                                                       |

### Request pipeline

`src/proxy.ts` (called "middleware" before Next.js 16) does two things in
order, on one response:

1. next-intl resolves the locale and redirects or rewrites (`/` → `/es`).
2. Supabase refreshes the session and writes updated auth cookies onto that
   response.

The OAuth callback (`/auth/callback`) is outside `[locale]` and excluded from
the proxy. It exchanges the code for a session and redirects to
`<basePath>/<locale>`.

## Consequences

- Each app must set `BASE_PATH` and register its callback URL,
  including the base path, in Supabase and Google Cloud.
- Links between zones must be plain `<a>` tags (full page loads), not `<Link>`.
- Assets from `public/`, `<img>`/`<video>` sources, client `fetch` calls and
  OAuth redirect URLs must use `withBasePath()`.
- Upgrades (Next.js, next-intl, Supabase) happen per app. The template should
  be kept current so new apps start on supported versions.
