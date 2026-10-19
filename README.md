# ovchinnikov-lxs.github.io

Personal site / CV of Aleksandr Ovchinnikov — https://ovchinnikov-lxs.github.io

Next.js (static export) + Tailwind CSS. The page is rendered twice with identical
layout: a "plain HTML" skin on top and a designed skin underneath, revealed by a
canvas mask you scratch with the cursor (or by scrolling with a finger). Only the
mask changes, so there is no layout shift.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm build   # static site in ./out
```

## Content

All text lives in `src/content.ts` and mirrors the CV in Google Docs (`CV_URL`).
`OPEN_TO_WORK` toggles the "open to new opportunities" badge.

Skins must only change paint, never geometry — see the note at the top of
`src/app/globals.css`.

## Images (favicon, app icons, Open Graph)

Rendered from the HTML templates in `scripts/images/` with Playwright, using the
site's own fonts, and committed to `src/app/` and `public/`:

```bash
pnpm images   # needs Playwright Chromium and Python Pillow
```

Photo: `public/avatar.webp` (site, schema.org) and `scripts/images/avatar.webp` (OG card).

## Deploy

Push to `master` → GitHub Actions builds and publishes `./out` to the `gh-pages`
branch, which GitHub Pages serves.
