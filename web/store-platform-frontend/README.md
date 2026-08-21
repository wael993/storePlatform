# Store platform frontend

Vite + React 19.

## Scripts

- `npm run dev` — development server at http://localhost:3000
- `npm run build` — production build to `dist`
- `npm run preview` — serve the production build locally

Copy `.env.example` to `.env` for local overrides. Vite only exposes `VITE_*` variables.

On Vercel: rename any `REACT_APP_*` env vars to `VITE_*`, and turn off a dashboard override that still points at Create React App / `build`.
