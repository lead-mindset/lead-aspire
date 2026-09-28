## What changed

<!-- A short summary of the change and why it is needed. Link the issue if there is one. -->

## How to test

<!-- Steps a reviewer can follow to verify the change locally or on the preview deployment. -->

1.
2.

## Screenshots

<!-- Before / after for any UI change. Delete this section if not applicable. -->

## Checklist

- [ ] `npm run lint`, `npx tsc --noEmit` and `npm test` pass locally
- [ ] Works with and without `BASE_PATH`
- [ ] UI uses design system tokens and `src/components/ui` (no new colors, fonts or radii)
- [ ] New UI text is in `messages/en.json` and `messages/es.json` (no hardcoded strings)
- [ ] Public assets, `<img>`/`<video>` and client `fetch` calls use `withBasePath`
- [ ] New env vars are documented in `.env.example` and added in Vercel
- [ ] Database changes are in a new file under `supabase/migrations/`
- [ ] No secrets committed
