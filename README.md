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

#### Adding admin-access self-service (Profile > "Admin panel access")

Lets an already-authenticated admin add or remove emails from the
**same** "AdminPanel allowlist" Access policy that gates this whole
domain, straight from Profile in the top-right corner -- no more
switching to the Cloudflare dashboard just to grant a new teammate
access. See `worker/api/access-policy.ts`.

This is a WRITE action on the policy that controls who can reach this
entire app, so treat the token permission below deliberately -- it's
scoped to editing Access policies specifically, nothing broader.

1. Reuses the SAME `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` pair
   and the SAME Account-scoped policy row you already created for
   Access audit logs/API observability above -- just one more
   permission on that row, no new secret.
2. On the `admin-panel-edge-analytics` token -> Edit -> find that
   Account-scoped policy row -> add **Access: Apps and Policies: Edit**
   (distinct from "Access: Audit Logs: Read", which is read-only and
   can't touch policy config).
3. Add `CLOUDFLARE_ACCESS_POLICY_ID` to `wrangler.jsonc`'s `vars` block
   -- the id of the reusable "AdminPanel allowlist" policy itself,
   visible in its own Cloudflare dashboard URL (Access -> Policies ->
   that policy -> the `/access-controls/policies/{this-id}/edit` URL).
   Not sensitive, same reasoning as `CLOUDFLARE_ZONE_ID`.
4. Save. Deploy.

**Built-in safety rails** (enforced server-side, not just in the UI):

- Removing the LAST remaining email in the policy is rejected outright
  -- that would either lock everyone out or leave the policy matching
  nothing, depending on how Cloudflare treats an empty Include list.
- Removing your OWN currently-authenticated email is rejected -- no
  accidentally locking yourself out of the panel you're sitting in.
- Removing `ybosemahasaya@gmail.com` (the primary account) is rejected
  unconditionally, regardless of who's logged in -- hardcoded as
  `PRIMARY_ACCOUNT_EMAIL` in `shared/access-policy.ts`, not derived from
  "whichever email is first in the list." The remove button for it is
  also disabled client-side (badged "Primary"), but the server check is
  the real guarantee.
- Adding an email already on the list is a silent no-op, not an error.

### Admin API observability (Workers Analytics Engine)

A DIFFERENT Cloudflare product from everything above -- not Cloudflare's
own logs about the public site's zone, but custom events THIS admin
Worker records about its own API requests (method/path/status/latency
per route). See `shared/api-observability.ts` for why this is
deliberately separate from the rest of Edge Analytics.

1. The `analytics_engine_datasets` binding in `wrangler.jsonc` is
   already committed -- unlike D1/R2, Analytics Engine datasets need no
   manual provisioning in the dashboard; the dataset is created
   automatically the first time the Worker writes to it. Just deploy.
2. Add **Account Analytics: Read** to the SAME Account-scoped policy
   row you created above for Access audit logs (same account resource,
   just one more permission on that row -- no third policy row needed).
3. That's it -- no new secret, reuses `CLOUDFLARE_ACCOUNT_ID`/
   `CLOUDFLARE_API_TOKEN`.
4. **Expect an empty table at first.** There's no historical backfill --
   the "Admin API by route" table only has data going forward from
   whenever this Worker's first deploy with the binding starts handling
   requests. Click around the admin panel for a minute, then refresh.
5. **Honest caveat:** Cloudflare's Analytics Engine SQL dialect
   (ClickHouse-like) isn't formally documented -- the queries in
   `worker/api/api-observability.ts` are written against known
   conventions but not verified live before shipping. If this errors,
   paste the exact message and the SQL gets a quick fix, same pattern
   as every other query in this project.

### Worker Logs (page views + contact funnel for the public site, API health for this admin panel)

Three tabs under one "Worker Logs" sidebar page, each reading a
different data source -- see `shared/worker-logs.ts` for the full story
of how this ended up here:

- **Admin Panel** tab: just reuses the existing Admin API observability
  section above, unchanged. No separate setup.
- **Public Site (Production)** / **Public Site (Dev)** tabs: read the
  public site's OWN Analytics Engine data -- page views
  (`kym_site_traffic`) and contact-form funnel outcomes
  (`kym_contact_funnel`) -- split by hostname into the two tabs.

**Why not Cloudflare's built-in Workers Logs/Observability?** That was
the original plan, and it's a real, free, built-in Cloudflare feature --
but after three rounds of live schema introspection, this account's
only reachable Workers-invocations GraphQL dataset
(`workersInvocationsByOwnerAndScriptGroups`) turned out to have **no
scriptName filter or dimension at all**, confirmed via introspection,
not a guess. It cannot distinguish one Worker's traffic from another's
at the account level, which the entire "one tab per Worker" design
depends on. Dead end, not fixable with a different field name.

**What's actually live now:** the public site's `worker.js` was given
real `writeDataPoint()` calls (added directly to that repo, with
explicit sign-off, since it's a separate restricted repo -- this admin
panel repo was never the blocker). This admin panel reads that data via
the exact same Analytics Engine SQL API client already proven working
for the Admin API observability widget above -- just pointed at two
different dataset names.

Setup:

1. No new permission needed -- reuses **Account Analytics: Read**,
   already granted for Admin API observability above.
2. No new secret, no new var -- reuses `CLOUDFLARE_ACCOUNT_ID`/
   `CLOUDFLARE_API_TOKEN`.
3. The public site's own deploy (separate repo) needs to be live with
   the `TRAFFIC_ANALYTICS`/`CONTACT_ANALYTICS` bindings and the
   matching `writeDataPoint()` calls in `worker.js` for either Public
   Site tab to show real data. Until then, both tabs will just show
   zeros/empty tables -- not an error, just no data written yet.
4. **Honest caveat:** same as every other Analytics Engine query in
   this project -- Cloudflare's SQL dialect isn't formally documented,
   and this is the first time these particular two datasets have been
   queried. If a Public Site tab errors, paste the exact message.
5. **Public site API health** (within each Public Site tab): a THIRD
   dataset, `kym_public_api_metrics`, mirroring the Admin API
   observability widget's exact shape (method/path/status/duration) for
   the public site's one real API route, `/api/contact`. Same setup as
   above -- no new permission or secret, just needs that repo's
   `PUBLIC_API_METRICS` binding deployed.

### Workers Observability (request traces, exceptions, slow spans)

A fourth Cloudflare data source on the Worker Logs page -- shown on
**all three tabs** (unlike the traffic/contact-funnel/API-health
widgets above, which are public-site-only), since this reads
Cloudflare's own built-in per-script event stream, which exists for
every Worker automatically once `observability.enabled: true` is set
(already true in both this repo's and the public site's `wrangler.jsonc`
-- zero extra deploy needed for this part).

**Setup:**

1. Add **Workers Observability Write** to the same Account-scoped
   policy row as everything else. Counter-intuitive name for a read
   operation, but that's what Cloudflare's own API reference names as
   the required permission for this specific method.
2. No new secret, no new var -- reuses `CLOUDFLARE_ACCOUNT_ID`/
   `CLOUDFLARE_API_TOKEN`.
3. That's it. One query per Worker (`view: "events"`, 7-day window, 100
   most recent events, filtered by `$workers.scriptName`), with both
   "exceptions" (`outcome != "ok"`) and "slowest requests" (sorted by
   `wallTimeMs`) derived from that same sample rather than issuing extra
   queries with less-verified filter/orderBy combinations.

**The road here, for anyone debugging this later** (full detail in code
comments in `worker/api/worker-observability.ts`): five rounds of live
trial-and-error against the real API (wrong field name -> missing
`queryId` -> `queryId` referenced a nonexistent saved query ->
missing `type` discriminator on a filter) before finally just reading
Cloudflare's own official API reference via a web-retriever fetch,
which confirmed the whole shape in one shot. That page:
https://developers.cloudflare.com/api/resources/workers/subresources/observability/subresources/telemetry/methods/query
-- worth checking FIRST next time instead of fifth.

A permanent diagnostic tool survives at `GET /api/worker-observability/_debug`
(optionally `?body=` / `?path=` overrides) in case this API's shape ever
shifts again -- safe to leave deployed, read-only, same Access gate as
everything else.

### Dashboard (Grafana-styled, not a Grafana integration)

A new sidebar page (`DashboardPage.tsx`) that presents a unified,
panel-grid overview across all three Workers -- explicitly requested as
"a Grafana-like view, custom developed, no actual Grafana." It fetches
NO new data: it's a different arrangement of the exact same hooks
(`useWorkerObservability`, `useWorkerLogs`, `useApiObservability`)
already used on the Worker Logs / Edge Analytics pages.

What it adds that those pages didn't have:

- **Shared time-range selector** (1h/6h/24h/7d/30d) -- genuinely wired
  end-to-end into `useWorkerObservability`'s new `hoursWindow` param and
  `worker/api/worker-observability.ts`'s new `?hours=` query param. The
  SQL-backed traffic/contact-funnel/API-health panels below it keep
  their own fixed windows (each says so in its own subtitle) rather
  than pretending the selector touches data it structurally can't yet.
- **Auto-refresh control** (Off/30s/1m/5m) plus a manual "Refresh now"
  button -- calls every panel's `reload()` on an interval.
- **Stat tiles** with color-coded severity (green/amber/red by error
  rate) for request/error counts per Worker.
- **Time-series charts** per Worker, built from Cloudflare's own
  server-side time-bucketed aggregation (the `series` field on the
  Workers Observability response -- see `shared/worker-observability.ts`'s
  `ObservabilitySeriesPoint`), not a client-side count of the capped
  100-event sample.
- **Merged exceptions/slowest-requests tables** across all three
  Workers in one place, each row tagged with which Worker it came from.
- **Security posture panel** ("Security Center / Radar"-style, custom
  built, no Grafana/Radar integration) -- see the dedicated section
  below for the full feasibility verdict.

No new setup required beyond what Workers Observability and Worker Logs
already need above.

### Security posture (Dashboard's "Security Center / Radar" request)

Requested explicitly as a feasibility-then-implement task: "Security
posture, threat intel, DDoS stats | Security Center / Radar from
Cloudflare." Verdict, and what actually shipped:

- **Cloudflare Radar was explicitly skipped.** Radar is a global
  internet-wide trends product (worldwide attack/traffic patterns) --
  it has nothing to do with THIS site specifically, confirmed straight
  from Cloudflare's own docs ("Get access to Cloudflare's data on global
  Internet traffic"). Building it would be decorative, not actionable,
  for a small nonprofit's own admin panel. It would also need its own
  separate token permission (`Account > Radar > Read`) for zero
  practical benefit.
- **"Security Center"-equivalent insights that ARE relevant and
  feasible on this zone's Free plan**: SSL/TLS certificate status, DNS
  records, and a threats-mitigated counter -- all three already existed
  as separate Edge Analytics widgets; the new `SecurityOverviewPanel`
  on the Dashboard just presents them together in the panel-grid style,
  reusing the exact same hooks/DTOs rather than duplicating them.
- **The WAF/firewall action+source breakdown -- the closest thing to
  real "DDoS stats" for this specific zone** -- RESOLVED, not just
  reported. Cloudflare's `firewallEventsAdaptiveGroups` (the
  server-side GROUP BY variant) returns "zone does not have access to
  the path" on this Free-plan zone, confirmed live. But the RAW
  (non-grouped) `firewallEventsAdaptive` field works fine, also
  confirmed live -- real bot-fight-mode challenges and other events came
  back. Fix: `worker/api/edge-analytics.ts` now fetches up to 500 raw
  events per request and counts action/path/country/**source** itself
  (`topCounts()`), instead of asking Cloudflare to group them
  server-side. Same end-user result, one extra step. `source` is a
  genuinely new, useful signal this unlocked -- it's WHICH protection
  mechanism handled each event (`botFight` = free Bot Fight Mode,
  `waf` = managed WAF rules, `linkMaze` = anti-scraper honeypot links,
  etc.), real zone-specific threat intel, not just a generic count.
- `firewallError`/the empty-state message are kept as a genuine
  fallback for real failures (token issues, transient API errors) --
  not a permanent "your plan doesn't support this" message anymore,
  since that turned out to be wrong for the raw dataset.

### Dependency security (GitHub Dependabot)

Not a Cloudflare feature at all -- Cloudflare's Security Overview panel
above covers the EDGE/network layer (WAF, bot mitigation). This is
about vulnerabilities IN the open-source npm packages this project (and
the public site) depend on. A plain `npm audit` run on 2026-11-08 found
0 vulnerabilities in this repo but **22 in the public site's repo (1
critical, 17 high)**, headlined by several real Astro XSS/SSRF
advisories -- concrete proof this category was worth setting up, not a
hypothetical.

**Status as of 2026-11-08: Dependabot alerts + Dependabot security
updates are both ENABLED** on both repos, via GitHub's own
Settings -> Code security toggles. Nothing in this codebase controls
that -- it's a GitHub-side, per-repo setting, not a file or a deploy.

- **Dependabot alerts**: GitHub continuously scans each repo's
  `package-lock.json` against its Advisory Database and lists any hits
  under that repo's own Security tab.
- **Dependabot security updates**: when an alert has a fix available,
  GitHub auto-opens a PR bumping just that one vulnerable package.
  Nothing merges automatically -- every such PR still needs the exact
  same manual `tsc`/build/`wrangler deploy --dry-run` review this
  project already requires for every other change before promoting
  `dev` -> `main`.
- Neither of the two above needed a committed config file.

**Documented for future, deliberately NOT implemented yet:
`.github/dependabot.yml` ("version updates")**

Separate from the two toggles above -- this is routine freshness
checking (ALL dependencies, not just ones with a known CVE) on a
schedule. If/when it becomes worth adding, one file like this per repo:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

Why this isn't in yet: both repos have small dependency trees (roughly
13 total packages here, 5 direct in the public site), and the
security-relevant case is already covered by the two toggles above --
version updates would mostly add "stay current" PR noise rather than
close a real gap. Revisit if the dependency count grows, or if drifting
behind latest-minor becomes a recurring manual chore.

**Surfacing Dependabot data in THIS admin panel's own Dashboard:**

**RESOLVED/BLOCKED 2026-11-08: this Worker cannot call `api.github.com`
at all.** The original plan (Worker fetches
`GET /repos/{owner}/{repo}/dependabot/alerts` directly, same pattern as
every other Cloudflare/GA4/Resend integration here) was tested live via
a temporary unauthenticated diagnostic -- a bare `fetch()` to
`https://api.github.com/zen`, no token, nothing to go wrong on GitHub's
side. Result: **HTTP 525 ("SSL Handshake Failed"), Cloudflare's own
synthesized error**, meaning the connection to github.com never
completes. This is NOT new -- it's the exact same failure
`worker/lib/deploy-hook.ts` already documented from this Worker's
abandoned GitHub-Contents-API deploy trick. A GitHub token would not
have fixed this; the request never gets far enough to be authenticated
or rejected. The diagnostic has been removed (its question is answered).

**The actual path forward: push data IN instead of pulling it OUT.**
The 525 only blocks this Worker's *outbound* calls to github.com --
inbound requests TO this Worker are completely unaffected (that's a
different network path entirely). So instead of the Worker calling
GitHub, GitHub should call the Worker:

1. A small GitHub Actions workflow, committed to each repo (`.github/
   workflows/dependabot-sync.yml`), triggered on the `dependabot_alert`
   event (fires the moment an alert is created/fixed/dismissed) and/or
   a daily `schedule:` cron as a backstop.
2. The workflow calls `GET /repos/{owner}/{repo}/dependabot/alerts`
   from GitHub's OWN infrastructure -- using the workflow's automatic,
   zero-setup `GITHUB_TOKEN` (scoped to just that repo, no manually
   generated PAT needed at all, since the workflow and the alerts it's
   reading live in the same repo).
3. The workflow `POST`s the alert summary as JSON to a new endpoint on
   this admin Worker, e.g. `POST /api/dependabot-alerts/ingest`,
   authenticated by a shared-secret bearer token -- the exact same
   pattern already proven in this codebase by `CONTACT_INGEST_TOKEN`
   (see `worker/api/public-contact.ts`), where the public site's
   worker.js pushes contact-form submissions into this admin Worker the
   same way.
4. This Worker stores the result in the existing D1 database (one new
   small table), and the Dashboard panel reads it from D1 via a normal
   authenticated GET -- no outbound call to github.com anywhere in this
   Worker, ever.
5. **"Taking action" stays exactly as scoped before**: READ-ONLY in the
   Dashboard, plus "open in GitHub" links to the real alert/PR. Nothing
   about this architecture change affects that call -- it was never
   about where the data comes from, only about not merging code from
   inside the dashboard.

Not yet built -- this is the corrected plan, ready to implement on
request. Needs: one `GITHUB_DEPENDABOT_INGEST_TOKEN`-equivalent shared
secret (generated by whoever administers the repos, same handoff
discipline as every other secret here), one new D1 table/migration, one
new ingest endpoint, one new read endpoint + hook + Dashboard panel, and
one GitHub Actions workflow file per repo.

## Branch strategy

Mirrors the public site: `dev` for active work, `main` for production,
promoted only after verifying on `dev`.

## Build & deploy

```bash
npm run build       # tsc -b && vite build -> dist/client (SPA) + Worker bundle
npm run deploy       # build, then wrangler deploy
```

Deploys target **this project's own Worker only** — never the public site's.
