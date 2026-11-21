# EL-1 — eLearning card on the Welcome page

**Goal:** users find the Arabic operating guide (PDFs with screenshots) from inside the app.

Content source: [`../elearning/`](../elearning/) (Arabic Markdown, one file per section).
The owner turns each file into a PDF and uploads it to one shared folder (SharePoint or
Google Drive). The app only links to that folder.

## Do

- `WelcomePage.tsx`: one extra card next to the quick links ("eLearning" / "التعليم الإلكتروني" /
  "E-Learning"), opens the folder URL in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
- URL from `VITE_ELEARNING_URL` (Vercel env, per environment). Empty → card hidden.
  Changing the link = change the env var + redeploy; adding PDFs to the folder needs nothing.
- Text in en, ar, de. Visible to every tenant user (no SEE flag); works offline only as a link.

## Acceptance

- [ ] Card shows when the env var is set, hidden when empty
- [ ] Opens the folder in a new tab, `noopener noreferrer`
- [ ] en / ar / de text, `checkTranslations.mjs` green

## Not now

First-login modal, in-app catalog with tabs, admin UI, progress tracking. Add only if users
do not find the card.
