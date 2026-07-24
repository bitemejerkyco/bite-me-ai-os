# Amazon Ads Live Read-Only Setup (Phase 1)

## Purpose

This guide configures Amazon Ads **live read-only** authorization for advertiser profile discovery and profile selection.

This phase does **not** ingest live performance reports and does **not** allow campaign mutations.

## Amazon prerequisites

1. Create an Amazon developer application with Login with Amazon (LwA) enabled.
2. Create a security profile for the app.
3. Request Amazon Ads API access for the target advertiser account(s).
4. Configure the exact OAuth redirect URI in Amazon to match `AMAZON_ADS_REDIRECT_URI`.

## Required environment variables

Set all values server-side (never in client bundles):

- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_REDIRECT_URI`
- `AMAZON_ADS_LIVE_READ_ENABLED=false` (default disabled)
- `AMAZON_ADS_TOKEN_ENCRYPTION_KEY`

`AMAZON_ADS_TOKEN_ENCRYPTION_KEY` must resolve to exactly 32 bytes (base64 or raw 32-byte value).

## Redirect URI configuration

- Use one redirect URI and keep it identical in:
  - Amazon developer console OAuth settings
  - `AMAZON_ADS_REDIRECT_URI`
- The callback endpoint validates this exact value and rejects mismatches.

## Feature-flag activation

Default:

```bash
AMAZON_ADS_LIVE_READ_ENABLED=false
```

Enable only after credentials and redirect configuration are complete:

```bash
AMAZON_ADS_LIVE_READ_ENABLED=true
```

If disabled or misconfigured, connection fails closed.

## Security controls in this phase

- OAuth authorization-code flow is server-side only.
- OAuth `state` is random, single-use, short-lived, and actor-bound.
- Callback rejects missing, expired, reused, or mismatched state.
- Refresh tokens are stored encrypted at rest.
- Token values and client secrets are redacted from error surfaces.
- Read-only operation allowlist is centralized.
- Mutation operations are not exposed.

## Read-only limitations

Current phase supports:

- OAuth connect/disconnect
- Advertiser profile discovery
- Profile and marketplace selection

Current phase does **not** support:

- Live report ingestion
- Campaign changes (bid, budget, keyword, targeting, status, product ad)
- Generic API proxying

## Credential handling rules

- Do not commit `.env` files.
- Keep `.env.example` placeholders blank.
- Never put real credentials in docs, code, tests, or telemetry.
