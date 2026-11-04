# kriyayogamission-admin

Internal, login-gated admin console for the [Kriya Yoga Mission](https://kriyayogamission.org)
website. Lets a trusted team member upload gallery photos (and, eventually,
manage more site content) without touching code or the public site's repo.

>  **This project must never modify the public site's repo, Cloudflare
> project, or configuration.** See
> [`docs/admin-panel-architecture.html`](./docs/admin-panel-architecture.html)
> for the full restriction and the complete architecture/roadmap. This is a
> fully separate repo and a fully separate Cloudflare Worker on purpose.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript, built with Vite, static SPA |
| Backend / API | TypeScript on Cloudflare Workers (`worker/`) |
| Image storage | Cloudflare R2 |
| Structured data | Cloudflare D1 |
| Auth | Cloudflare Access (Zero Trust), Email OTP |
| Dev/build tooling | [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/) — one Vite dev server runs both the React app and the Worker |

Full reasoning for every one of these choices lives in
`docs/admin-panel-architecture.html`.

## Project layout

```
src/        React SPA (pages, components, API client)
worker/     Cloudflare Worker: /api/* routes (gallery CRUD)
shared/     Types/constants shared between src/ and worker/ (e.g. gallery categories)
migrations/ D1 schema migrations
wrangler.jsonc   Worker + bindings config (R2/D1 bindings are commented out until provisioned)
```

## Getting started

```bash
npm install
npm run dev        # starts Vite + the Worker together, with HMR
```

The gallery API routes return a `503` until an R2 bucket and D1 database are
provisioned for **this** project and their bindings are uncommented in
`wrangler.jsonc` — see the Phase 1 checklist in the architecture doc.

### First-time Cloudflare setup (one-time, per Phase 1 checklist)

1. Create a new R2 bucket and D1 database in the Cloudflare dashboard for
   this project (never reuse the public site's resources).
2. Run the migration: `npx wrangler d1 execute <db-name> --file=migrations/0001_create_gallery_images.sql --remote`
3. Fill in the real `bucket_name` / `database_id` in `wrangler.jsonc` and
   uncomment the `r2_buckets` / `d1_databases` blocks.
4. Create a new Cloudflare Worker project (Git-connected to this repo) with
   its own custom domain, e.g. `admin.kriyayogamission.org`.
5. Configure a Cloudflare Access Application gating that domain with an
   email allowlist.

## Branch strategy

Mirrors the public site: `dev` for active work, `main` for production,
promoted only after verifying on `dev`.

## Build & deploy

```bash
npm run build       # tsc -b && vite build -> dist/client (SPA) + Worker bundle
npm run deploy       # build, then wrangler deploy
```

Deploys target **this project's own Worker only** — never the public site's.
