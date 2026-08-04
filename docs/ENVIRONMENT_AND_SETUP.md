# Environment and Setup

## Local setup

```bash
git clone https://github.com/bitemejerkyco/bite-me-ai-os.git
cd bite-me-ai-os
npm install
npm run dev
```

Use the repository's lockfile and preferred clean-install command for CI.

## Required environment audit

Cursor should search for:

- `process.env`
- `NEXT_PUBLIC_`
- Supabase URL and keys
- Service-role key usage
- Replicate token/model settings
- Resend API key and sender domain
- Stripe keys, webhook secret, price IDs
- TikTok client ID/secret, redirect URI, scopes
- Application URL
- Cron or queue secrets
- Encryption keys
- Admin allowlists
- Storage bucket names

Create or update `.env.example` with names and descriptions only. Never include real values.

## Secret rules

- `NEXT_PUBLIC_*` values are visible to browsers.
- Supabase service-role keys must never reach client bundles.
- Provider API keys must remain server-side.
- OAuth client secrets and refresh tokens must not be logged.
- Stripe webhook secrets must be verified server-side.
- Use separate development, preview, and production credentials.

## Supabase

Verify:

- Project reference
- Local configuration
- Migration command and workflow
- Generated types
- Storage buckets and policies
- Auth redirect URLs
- Production migration process
- Backup/recovery approach

## Vercel

Verify:

- Correct project linked
- Production branch
- Preview deployments
- Framework/build settings
- Environment variable scopes
- Domain
- Function timeouts for generation endpoints
- Cron jobs
- Deployment protection
- Logs and alerts

## Provider readiness

For every external provider document:

- Owner/account
- Sandbox and production status
- Scopes/permissions
- Rate limits
- Cost model
- Timeout
- Retry policy
- Webhook/callback verification
- Data retained
- Failure behavior
- Support contact
