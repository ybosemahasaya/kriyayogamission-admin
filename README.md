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

### Edge Analytics setup (Cloudflare GraphQL Analytics API)

Surfaces bot/WAF-blocked traffic, cache hit ratio, and bandwidth for the
**public** kriyayogamission.org zone -- read-only, via Cloudflare's own
GraphQL API. See `shared/edge-analytics.ts` for why this is a different
data source from both GA4 and Workers Analytics Engine.

1. Cloudflare dashboard -> select the `kriyayogamission.org` zone ->
   Overview tab -> copy the **Zone ID** shown in the right-hand sidebar.
2. Add it to `wrangler.jsonc`'s `vars` block as `CLOUDFLARE_ZONE_ID`
   (not sensitive -- same reasoning as `GA4_PROPERTY_ID` above).
3. Cloudflare dashboard -> My Profile -> API Tokens -> Create Token ->
   custom token with **Zone > Analytics > Read**, scoped to the
   `kriyayogamission.org` zone only.
4. `npx wrangler secret put CLOUDFLARE_API_TOKEN` and paste that token.
5. Deploy. The "Edge Analytics" sidebar page returns a 503 with a clear
   message until both of these are set, same pattern as every other
   optional integration in this project.

#### Adding Cache Purge + SSL certificate status (same token, more permissions)

Both widgets live on the Edge Analytics page and reuse the exact same
`CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN` pair above -- no new secret
needed. Go back to that same token in the Cloudflare dashboard (API
Tokens -> `admin-panel-edge-analytics` -> Edit) and add two more
permissions to the existing **Zone** policy row (same zone resource,
`kriyayogamission.org` -- don't widen it):

- **Zone > SSL and Certificates > Read** (for the certificate status
  widget)
- **Zone > Cache Purge > Purge** (the one write permission in this
  feature -- it can only purge cache, nothing else)

Save. Editing a token's permissions doesn't change its secret value, so
the `CLOUDFLARE_API_TOKEN` you already set stays valid -- no need to run
`wrangler secret put` again.

#### Adding DNS records reference (same token, one more permission)

- Add **Zone > DNS > Read** to the same existing Zone policy row.
- Nothing else to configure -- the "DNS records (read-only)" table on
  Edge Analytics will pick it up automatically.

#### Adding Access login/audit visibility (needs a NEW policy row + a new var)

This one's different from the others above -- Access audit logs are an
**account-level** resource, not zone-level, so it needs its own policy
row and its own ID:

1. Cloudflare dashboard -> any zone's Overview page -> right sidebar has
   an **Account ID** (different from the Zone ID you copied earlier).
2. Add it to `wrangler.jsonc`'s `vars` block as `CLOUDFLARE_ACCOUNT_ID`.
3. Back on the `admin-panel-edge-analytics` token -> Edit -> **Add new
   policy** (don't add this to the existing Zone row -- it needs its
   own row scoped to **Account**, not Zone).
4. Resource: this one Cloudflare account. Permission: **Access: Audit
   Logs: Read** (confirmed against the live permission catalog --
   distinct from "Access: Apps and Policies," which only covers
   app/policy config, not the login event stream).
5. Save -- no new secret needed, same `CLOUDFLARE_API_TOKEN`.

#### Adding the Zaraz tools viewer (same token, one more permission)

Low-priority widget -- config that rarely changes, already viewable in
the Cloudflare dashboard's Zaraz tab. Included because this project
already documents its Zaraz/GA4 setup elsewhere.

- Add **Zone > Zaraz > Read** to the same existing Zone policy row.
- **Honest caveat:** the "type" and "enabled" field mapping in
  `handleZarazConfigRequest` (`worker/api/cf-ops.ts`) is a best-effort
  guess, not verified against a real response -- if every tool shows
  "unknown" as its type, that's a mapping fix, not a sign the
  permission is wrong.

## Branch strategy

Mirrors the public site: `dev` for active work, `main` for production,
promoted only after verifying on `dev`.

## Build & deploy

```bash
npm run build       # tsc -b && vite build -> dist/client (SPA) + Worker bundle
npm run deploy       # build, then wrangler deploy
```

Deploys target **this project's own Worker only** — never the public site's.
