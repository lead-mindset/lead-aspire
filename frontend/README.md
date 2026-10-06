# lead-aspire

## Project structure

```
src/
  app/
    [locale]/            layout (Footer), home (→ login), login, dashboard (protected),
                         dallas (placeholder)
      new-york/
        (app)/           signed-in New York app: home, phases, organizer results
        _aspire/         New York app components, data and session
        guides/          public step-by-step Foundry guide (email gate)
        resources/       PDF reader
  components/
    ui/                  Design system components (Button, TextField, Header, …)
    brand/               Logo, app Header (wires ui/Header to routes), Footer
    auth/                Login form and sign-out button
    i18n/                Locale switcher
    theme/               Theme toggle and no-flash theme script
  i18n/                  next-intl routing, navigation and request config
  lib/
    designSystem.ts      Link to the design system
    basePath.ts          BASE_PATH and withBasePath()
    supabase/            browser client, server client, proxy session refresh
  styles/
    globals.css          Design system tokens in Tailwind v4 @theme (light + dark)
    components.css       Design system component styles (ld-* classes)
    fonts.ts, fonts/     Montserrat and Source Sans 3, self-hosted with next/font
  proxy.ts               next-intl + Supabase session refresh (formerly middleware.ts)
messages/                en.json, es.json
e2e/                     Playwright tests (see the root README for the e2e user)
docs/adr/                Architecture decision records
```
