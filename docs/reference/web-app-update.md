# Web app update (stale client after deploy)

How the frontend picks up a new Production build without asking users to clear
cookies.

Code: `web/store-platform-frontend/src/shared/shellUpdate.ts`,
`index.tsx` (service worker + shell check), `nginx.conf`.

---

## Problem that shipped this

After a deploy, some users stayed on the previous JS bundle. Clearing cookies
was a workaround, not a fix. Root cause class: long-lived HTML/shell vs hashed
assets, plus service-worker / browser cache.

---

## Cache policy (nginx)

| Path | Cache-Control |
| --- | --- |
| `/assets/*` (hashed Vite bundles) | `public, max-age=31536000, immutable` |
| Static images / fonts | same long immutable |
| `/` (`index.html` and SPA fallback) | `no-cache` |

Hashed filenames change every deploy. `index.html` must not be cached as a
stable forever document.

---

## Shell reload

On focus / visibility (see `index.tsx`), the app fetches the current document
HTML and compares the module script under `/assets/` to the one already loaded
(`appShellSrc` → `nextShellScript`).

If the path differs, `reloadIfNewShell` reloads once. A reload that stays on the
old document is blocked for 10 minutes for the same next path
(`sessionStorage` key `store-platform-shell-reload`), then may retry.

---

## Service worker

Production registers a service worker and warms the runtime cache for current
script/style assets. Non-production unregisters existing workers so local
dev does not stick to a cached shell.

---

## What this does not fix

- API Redis / Mongo data caches (unrelated to an old frontend bundle).
- Users who never reopen the tab; they get the new shell on next visit or when
  the shell check runs.
- Backend deploy order / warehouse migration (see [`warehouse.md`](warehouse.md)).
