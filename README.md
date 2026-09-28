# lead-aspire

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
