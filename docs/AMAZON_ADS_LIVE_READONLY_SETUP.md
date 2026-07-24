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
- Authenticated actor/workspace are derived from a server-side resolver, never from browser query/body parameters.
- OAuth `state` is random, single-use, short-lived, and actor-bound.
- Callback rejects missing, expired, reused, or mismatched state.
- Callback rejects malformed/oversized code or state inputs and unexpected scopes.
- POST mutation routes enforce Origin/Host/content-type checks and CSRF token verification.
- Refresh tokens are stored encrypted at rest using AES-256-GCM with random IVs and auth tags.
- Encrypted token payloads require explicit format versioning (`v1`); unknown/unversioned payloads are rejected.
- Production rejects in-memory **and file-backed** OAuth state/token stores.
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

## Development demonstration setup (non-production only)

Development-only local demo auth can be enabled with:

- `BITEME_AUTH_SESSION_SIGNING_KEY`
- `AMAZON_ADS_DEV_WORKSPACE_ID`
- `AMAZON_ADS_DEV_USER_ID`

This local signed-session resolver is **development-only** and is rejected for production use.

## Production prerequisites (must be completed before enabling live mode)

1. **Real authenticated session provider**
   - Wire an `AuthenticatedActorResolver` implementation that resolves actor/workspace from your trusted login/session issuer.
   - The built-in development signed-session resolver is not production-capable.
2. **Shared atomic OAuth state store**
   - Implement a production `AmazonAdsStateStore` adapter backed by a shared datastore (for example Redis or database) with atomic create/consume semantics.
   - In-memory and local file state stores are development/test only.
3. **Durable encrypted token store**
   - Implement a production `AmazonAdsTokenStore` adapter backed by durable storage (for example database) with encryption key management through managed KMS/HSM.
   - In-memory and local file token stores are development/test only.
4. **Complete Amazon configuration**
   - All required Amazon OAuth configuration values must be set and valid.

If any prerequisite is missing, production stays fail-closed and live connect remains unavailable.

## Remaining Phase 2 work

- Production auth resolver integration with the platform identity/session system.
- Production state store adapter (shared atomic store).
- Production token store adapter (durable datastore + managed key lifecycle).
- Live performance report ingestion (still out of scope for this phase).

## Credential handling rules

- Do not commit `.env` files.
- Keep `.env.example` placeholders blank.
- Never put real credentials in docs, code, tests, or telemetry.
