<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

PostMotive is a single Next.js 16 (App Router, Turbopack) + Supabase app. Standard commands live in `package.json` (`dev`, `build`, `lint`, `test`, `validate:help`) and the CI flow is in `.github/workflows/ci.yml` (Node 22, `npm ci` → lint → build → test). Node 22 + npm are already provisioned; the update script runs `npm ci`.

### Services and how to start them (not run by the update script)

The app requires a local Supabase instance (Postgres + Auth + Storage); `lib/env.ts` throws `ENV_CONFIG_MISSING` at boot without the Supabase env vars. Docker and the Supabase CLI are preinstalled in the VM snapshot, but the daemon and stack are not auto-started. On a fresh session:

- Start Docker (no systemd in this VM): `sudo dockerd > /tmp/dockerd.log 2>&1 &`. If `docker ps` fails with a socket permission error, run `sudo chmod 666 /var/run/docker.sock` (the `ubuntu` user is in the `docker` group, but a running daemon/socket may predate that membership).
- Start Supabase from the repo root: `supabase start` (applies all `supabase/migrations/*`; first run pulls images). Get local URLs/keys with `supabase status`. Supabase Studio: `http://127.0.0.1:54323`.
- Start the app: `npm run dev` → `http://localhost:3000`.

### Environment variables

`.env.local` is git-ignored and must be recreated to point at the local Supabase stack. Minimum required to boot: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from supabase status>`, `SUPABASE_SERVICE_ROLE_KEY=<secret key from supabase status>`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`. All third-party keys in `.env.example` (OpenAI, Replicate, Stripe, Resend, TikTok, Amazon Ads) are optional — their absence does not block boot; each throws only when its specific feature is invoked.

### Gotchas

- Lint: `supabase start` writes generated files under `supabase/.temp/`, which ESLint lints and reports as 150+ spurious errors. The real baseline is clean (warnings only). Run lint with `npx eslint --ignore-pattern "supabase/**"`, or run it before `supabase start` / after `supabase stop`.
- Auth: email confirmations are disabled locally (`supabase/config.toml` → `enable_confirmations = false`), so sign-up auto-creates a session and redirects to `/`. Workspaces auto-bootstrap on first dashboard load. Auth/transactional emails are captured by Mailpit at `http://127.0.0.1:54324` (nothing is sent externally).
