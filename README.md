# PostMotive

PostMotive is an AI Marketing Director for small businesses. It helps owners learn the business, propose strategy, create and organize content, generate media, schedule publishing, and improve recommendations — without requiring marketing expertise or prompt engineering.

Repository: [bitemejerkyco/bite-me-ai-os](https://github.com/bitemejerkyco/bite-me-ai-os)

## Technology stack

Verified from `package.json` on `main`:

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 |
| Database / Auth / Storage | Supabase (PostgreSQL, RLS, SSR auth) |
| Video | Remotion, FFmpeg Static, Replicate (Wan 2.2 Fast economy route) |
| Email | Resend |
| Billing | Stripe |
| Tests | Vitest |
| Deployment | Vercel |

## Major application areas

| Area | Routes / modules |
|---|---|
| Marketing Director | `/`, `features/marketing-director/` |
| Business setup | `/onboarding` |
| AI Studio | `/studio`, `app/api/ai/*` |
| Content Library | `/media?tab=CONTENT_DRAFTS` (served by `/media`) |
| Media Library | `/media`, `features/media/` |
| Calendar & publishing | `/calendar`, `/publishing-queue`, `/approvals` |
| TikTok integration | `/settings/integrations/tiktok`, `app/api/integrations/tiktok/*` |
| Amazon Ads (partial) | `/analytics/amazon-ads`, sandbox + live-readonly adapters |
| Billing & credits | `/settings/billing`, `features/billing/` |
| Help & Ask Motive | `/help`, `/academy`, `features/help/` |
| Admin console | `/admin/*`, `features/admin/` |
| Creator Hub (beta) | `/creators/*` |

Domain logic lives in `features/`. UI components live in `components/`. API route handlers live in `app/api/`.

## Local setup

```bash
git clone https://github.com/bitemejerkyco/bite-me-ai-os.git
cd bite-me-ai-os
git checkout main
npm ci
cp .env.example .env.local
```

Fill in `.env.local` with development credentials (see below). Never commit real secrets.

On Windows, if `npm ci` fails with a TLS certificate error, try:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm ci
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and set values for your environment. Names only — never commit real keys.

**Required for local dev (minimum):**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)

**AI & video:**

- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `REPLICATE_API_TOKEN`, `REPLICATE_WAN_22_FAST_MODEL`

**Integrations (enable as needed):**

- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_TOKEN_ENCRYPTION_KEY`
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*`
- Amazon Ads: `AMAZON_ADS_*`

Central validation: `lib/env.ts`. Public config must use `NEXT_PUBLIC_*` only for browser-safe values. Service-role keys and provider secrets must stay server-side.

## Supabase migrations

Migration files: `supabase/migrations/` (34 files, applied in filename order).

**Local workflow (requires Supabase CLI linked to your project):**

```bash
supabase db push          # apply pending migrations to linked remote
supabase migration list   # compare local vs remote history
```

**Rules:**

- Never modify migrations that may already be applied in production.
- Add new migrations for schema changes.
- Verify RLS policies accompany new tenant-owned tables.
- After schema changes, confirm generated types if your workflow uses them.

**Production parity:** Compare local migration history against the production Supabase project before deploying schema-dependent features. This repository cannot confirm remote state without project access.

## Required validation

Run before opening a pull request or declaring work complete:

```bash
npm run lint
npm test
npm run build
npm run validate:help
git diff --check
git status --short
```

CI (`.github/workflows/ci.yml`) runs lint, build, and test on pushes/PRs to `main`. Build uses placeholder Supabase env vars.

For help registry or user-facing help changes, always include `npm run validate:help`.

## Vercel deployment

- Framework: Next.js (auto-detected)
- Production branch: `main`
- Set all required environment variables in Vercel project settings (Production, Preview, Development scopes as appropriate)
- `VERCEL_URL` is used automatically when `NEXT_PUBLIC_APP_URL` is unset
- OAuth callbacks (TikTok, Amazon Ads) must match the deployed domain
- Generation endpoints may need extended function timeouts — verify in Vercel dashboard for video/AI routes

## Security and secrets

- Never commit `.env.local`, API keys, or service-role keys.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, provider tokens, or Stripe secret keys to client bundles.
- OAuth refresh tokens and encryption keys must not be logged.
- All tenant-owned data must enforce workspace isolation via RLS and server-side ownership checks.
- Paid/credit-consuming workflows must use idempotency keys (see video credit `request_id` pattern).

## Handoff documentation

Product and engineering context for Cursor and contributors:

| File | Purpose |
|---|---|
| `AGENTS.md` | Global agent instructions |
| `.cursor/rules/` | Focused Cursor project rules |
| `docs/PROJECT_CONTEXT.md` | Product vision and customer context |
| `docs/TECHNICAL_ARCHITECTURE.md` | Architecture baseline and audit checklist |
| `docs/FEATURE_INVENTORY.md` | Feature status (verify against code) |
| `docs/UX_PRODUCT_BIBLE.md` | Novice-first UX standards |
| `docs/ROADMAP.md` | Recommended development sequence |
| `docs/KNOWN_ISSUES_AND_TECH_DEBT.md` | Risks and verification targets |
| `docs/ENVIRONMENT_AND_SETUP.md` | Environment and provider setup |
| `docs/QA_RELEASE_CHECKLIST.md` | Pre-release validation |
| `docs/DECISION_LOG.md` | Locked product decisions |
| `prompts/CURSOR_FIRST_SESSION_PROMPT.md` | First-session audit prompt |

Treat the repository code, migrations, and tests as the source of truth. Handoff docs describe intent; verify before relying on historical status labels.

## License

Private — All rights reserved.
