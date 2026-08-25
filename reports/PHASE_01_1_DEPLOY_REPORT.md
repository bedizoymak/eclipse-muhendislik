# Phase 1.1 — Deploy Report: Parasut contacts sync to production

- **Start:** 2026-08-25T23:00:55Z
- **End:** 2026-08-25T23:16:19Z
- **Branch:** `main`
- **Commit SHA:** _(filled in after commit — see final message)_
- **Hosted Supabase project:** `yzuxdrknidveptvnwthf` (eu-central-1, already linked)
- **Live URL:** https://demo.eclipsemuhendislik.com

No secret values appear anywhere in this report — only secret *names* and whether they are set.

## 1–2. Pre-flight verification

- `git status` confirmed exactly the expected Phase 1 files were modified/untracked:
  modified: `.env.example`, `package.json`, `package-lock.json`, `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/config.toml`;
  untracked (new): `supabase/functions/parasut-sync/**`, `supabase/migrations/20260826000000_parasut_sync_infrastructure.sql`, `src/pages/Musteriler.tsx`, `src/pages/MusteriDetay.tsx`.
  Also untracked but **not mine / not touched**: `AUDIT_REPORT.md`, `src/pages/Login.tsx`. Also modified but **not mine / not touched**: `vite.config.ts` (pre-existing user work).
- Confirmed on disk: `supabase/functions/parasut-sync/index.ts`, `parasut_client.ts`, `resources/contacts.ts`; `supabase/migrations/20260826000000_parasut_sync_infrastructure.sql`; `src/pages/Musteriler.tsx`; `src/pages/MusteriDetay.tsx` — all present.

## 3. Hosted Supabase connection

- Project was already linked (`supabase/.temp/project-ref` = `yzuxdrknidveptvnwthf`), matching `VITE_SUPABASE_URL` in `.env.example`. No ref was guessed.
- `supabase projects list` confirmed project `yzuxdrknidveptvnwthf` ("Eclipse Muhendislik"), status `ACTIVE_HEALTHY`, `linked: true`.

## 4. Migration

- `supabase migration list` (before): `20260826000000_parasut_sync_infrastructure.sql` was **local only**, not yet on remote.
- `supabase db push` applied it. **Result: success.**
- `supabase migration list` (after): all three migrations show matching local/remote timestamps.

## 5–6. Secrets

- `supabase secrets list` on hosted project was **empty** before this run — no Parasut secrets existed.
- Pushed the 5 required secrets from the local (gitignored) `.env` via `supabase secrets set --env-file <temp-file-with-only-PARASUT_* lines>`, then immediately deleted the temp file. Values were never printed to any log, report, or git.
- Verified **by name only** afterward — all 5 present: `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`, `PARASUT_USERNAME`, `PARASUT_PASSWORD`, `PARASUT_COMPANY_ID`. **No secret was missing**, so this did not block the deploy.

### Unplanned incident: `supabase config push` altered live Auth settings

While pushing the `parasut` schema-exposure change in `supabase/config.toml`, `supabase config push` also silently overwrote the hosted project's **Auth** configuration with local dev defaults (this is default CLI behavior — it diffs the whole config, not just the section you meant to touch). Changed: `site_url`, `additional_redirect_urls`, `email.enable_confirmations` (→ false), `email.otp_length`/`max_frequency`, `mfa.totp.enroll_enabled`/`verify_enabled` (→ false), and the OTP email/SMS template string.

This was caught immediately from the push's own diff output, the user was stopped and asked for explicit confirmation before any further action, and the exact prior values (read directly from the diff) were restored in `supabase/config.toml` and re-pushed. A follow-up `supabase config push` now reports `Remote Auth config is up to date` — confirmed fully reverted, with only the intended `parasut` schema addition remaining. Flagging this here because it is a real, if temporary, unintended change to a live setting outside this task's scope.

## 7. Edge Function deploy

- `supabase functions deploy parasut-sync` → **success** (692 kB bundle). Dashboard: https://supabase.com/dashboard/project/yzuxdrknidveptvnwthf/functions

## 8. Hosted dry run

```
POST https://yzuxdrknidveptvnwthf.supabase.co/functions/v1/parasut-sync
{"resource":"contacts","dry_run":true}
```

- HTTP 200
- `status`: `dry_run`
- `fetched_count`: **440**
- `total_count_reported`: **440** (matches — full pagination completed, no early stop)
- `error_count`: **0**

## 9. Real sync (hosted)

Dry run matched cleanly, so the real sync was run:

```
POST https://yzuxdrknidveptvnwthf.supabase.co/functions/v1/parasut-sync
{"resource":"contacts"}
```

- HTTP 200, `status`: `success`
- `fetched_count`: **440**
- `upserted_count`: **440**
- `error_count`: **0**

## 10–11. Row-count reconciliation

- Hosted `parasut.contacts` row count (verified via service-role REST call, `Content-Range` header): **448**.
- This is **8 more** than `fetched_count`/`upserted_count` (440). Investigated rather than adjusted:
  - Queried the 8 oldest-`synced_at` rows: all have `synced_at` in the `2026-08-25T04:42–04:43Z` range (hours before this session's work) and all have `archived: true`.
  - The Parasut `/contacts` list endpoint does not return archived contacts by default, so this sync's 440 fetched rows never included them.
  - Those 8 rows were written earlier by the pre-existing `scripts/sync_parasut.py` (see repo history), are real Parasut data, and per the "no delete/archive in this phase" rule were correctly left untouched.
  - **448 = 440 (active, this sync) + 8 (archived, prior script, untouched).** No formula, estimate, or manual correction was applied — this is the real, reconciled state, and no code changes were needed.
- Latest `parasut.sync_runs` row for `contacts` (via `public.parasut_sync_status_demo`, anon-readable): `status: success`, `fetched_count: 440`, `upserted_count: 440`, `error_count: 0`, `error_message: null`.

## 12. Test / lint / build

All run after the code changes, before commit:

- `npm test` → **1/1 passed** (`src/test/example.test.ts`, pre-existing placeholder test).
- `npm run lint` → **0 errors**, 10 pre-existing warnings (react-refresh fast-refresh warnings in shadcn/ui components and `LanguageContext.tsx`, unrelated to this change).
- `npm run build:demo` → **success**, output `dist/demo/assets/index-6VzcIbEN.js` (same hash later confirmed live).
- (Informational, not part of required suite) `tsc --noEmit -p tsconfig.app.json` → one pre-existing error in `src/pages/Login.tsx:55` (`Logo` prop typing), **not caused by and not touched by this work**.

## 13–14. Commit & push

- Staged **only** Phase 1/1.1 files: `.env.example`, `package.json`, `package-lock.json`, `src/App.tsx`, `src/pages/DemoHome.tsx`, `src/pages/Musteriler.tsx`, `src/pages/MusteriDetay.tsx`, `supabase/config.toml`, `supabase/functions/parasut-sync/**`, `supabase/migrations/20260826000000_parasut_sync_infrastructure.sql`, this report.
- **Not staged / not committed** (left exactly as the user had them): `vite.config.ts`, `src/pages/Login.tsx`, `AUDIT_REPORT.md`.
- Commit SHA and push result: see end of this report / final chat message.

## 15. Frontend deploy

- No CI/CD found (no `.github/workflows`). Deployment is manual via the repo's existing `scripts/deploy_ftp.py` (used through `scripts/full_deploy.py`), uploading a static build over FTP to cPanel document roots.
- Ran `npm run build:demo` to produce a fresh `dist/demo`, then deployed **only** the demo target (`--local-dir dist/demo --remote-dir /public_html/demo`), leaving the main site target untouched.
- **Caught before it happened:** the first `--dry-run` invocation showed the remote path being mangled by Git Bash's automatic path conversion into `/C:/Program Files/Git/public_html/demo` (a local Windows path, not the real cPanel path). Fixed by setting `MSYS_NO_PATHCONV=1` for the Python invocation; re-ran `--dry-run` and confirmed the correct remote path (`/public_html/demo`) before doing any real upload.
- Real upload (no `--clean`, so nothing was deleted, only added/overwritten): **19/19 files uploaded successfully.**

## 16–17. Live verification

| Route | HTTP status | Notes |
|---|---|---|
| `https://demo.eclipsemuhendislik.com/` | 200 | `index.html` references `assets/index-6VzcIbEN.js` — the exact hash of the build just deployed |
| `https://demo.eclipsemuhendislik.com/musteriler` | 200 | same SPA shell |
| `https://demo.eclipsemuhendislik.com/musteriler/1011029218` | 200 | real, active `parasut_id` from the synced data |

**Known blocker — TLS certificate:** `demo.eclipsemuhendislik.com` currently serves a **self-signed certificate** (`subject=CN=demo.eclipsemuhendislik.com`, `issuer=CN=demo.eclipsemuhendislik.com`, issued 2026-08-25, valid 1 year) — confirmed independently via `openssl s_client` and via the WebFetch tool (which rejected it as untrusted). This is a hosting/SSL provisioning issue (likely cPanel AutoSSL not yet issued for this subdomain), unrelated to this code deploy. HTTP-status checks above were done with certificate validation bypassed (`curl -k`) to confirm the app itself responds; **no tool available in this session could render the live page in an actual browser to visually confirm real Supabase data appears on screen**, precisely because of this untrusted certificate blocking normal fetches. This is reported as an open item, not silently worked around — recommend enabling a valid certificate (AutoSSL / Let's Encrypt) for the `demo` subdomain before treating this as a customer-facing verification.

Because of the certificate issue, the render check requested in step 17 is **not independently confirmed by this session** — see "Failed or unverifiable items" below. Strong indirect evidence it will render correctly:
- The exact same page code was verified end-to-end against the **local** Supabase stack earlier (Phase 1), reading from the same `public.parasut_contacts_demo` / `public.parasut_sync_status_demo` views.
- Those same views, queried directly against the **hosted** project with the anon key (bypassing the browser/cert issue), return real rows (verified in this session, e.g. `{"parasut_id":1011029218,"name":"2F MAKİNE SAN. VE DIŞ TİC. LTD. ŞTİ."}`).
- The deployed `index.html` references the freshly built bundle hash, confirming the new code (not stale code) is what's live.

## Changed files (this session, Phase 1.1)

Modified: `.env.example`, `package.json`, `package-lock.json`, `src/App.tsx`, `src/pages/DemoHome.tsx`, `supabase/config.toml`
Added: `src/pages/Musteriler.tsx`, `src/pages/MusteriDetay.tsx`, `supabase/functions/parasut-sync/index.ts`, `supabase/functions/parasut-sync/parasut_client.ts`, `supabase/functions/parasut-sync/resources/contacts.ts`, `supabase/migrations/20260826000000_parasut_sync_infrastructure.sql`, `reports/PHASE_01_1_DEPLOY_REPORT.md`
Deployed (not committed, build output): `dist/demo/**` → uploaded via FTP

## Failed or unverifiable items

1. **Visual/browser render of real data on the live site could not be confirmed in this session** — blocked by the self-signed TLS certificate on `demo.eclipsemuhendislik.com` rejecting all trust-validating HTTP clients (WebFetch, plain curl). HTTP 200 + matching bundle hash + working Supabase REST responses were confirmed instead (see above).
2. **`supabase config push` transiently altered live Auth settings** (see section 5–6) — caught, confirmed with the user, and fully reverted within this session. Documented as an incident, not hidden.
3. `tsc --noEmit` reports one pre-existing type error in `src/pages/Login.tsx` — not in scope, not touched, mentioned for completeness only.

## Sample real `parasut_id` values for Claude Browser / manual verification

All are real, currently active (non-archived) contacts from this session's hosted sync — pick any for `/musteriler/:parasutId`:

- `1011029218` — 2F MAKİNE SAN. VE DIŞ TİC. LTD. ŞTİ.
- `1066859197` — 3DCİM 3 BOYUTLU ENDÜSTRİYEL BASKI ÇÖZÜMLERİ LİMİTED ŞİRKETİ
- `1017928283` — ABBAS ÇELİKTEN
- `1017331532` — ACAR SONDAJ MAKİNA OTOMOYİV İNŞAAT NAK.SAN VE TİC.LTD.ŞTİ.
- `1011029226` — ADEM CESUR
