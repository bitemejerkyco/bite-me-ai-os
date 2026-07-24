# Amazon Ads Sponsored Products Sandbox Certification

## Status

Implementation mode: `SANDBOX_READ_ONLY`

Live availability: disabled

Marketing provider certification: `PARTIAL`

## Included

- Sponsored Products campaigns and daily budgets
- Ad groups and default bids (observed only)
- Product ads
- Keywords, product targeting, and automatic targeting
- Search-term performance
- Impressions, clicks, spend, CPC, CTR
- Orders, sales, conversion rate, ACOS, and ROAS
- Campaign status
- ISO 4217 source currency
- Marketplace, attribution window, and IANA timezone
- Token pagination and bounded page size
- Provider request IDs and rate-limit headers
- Initial, historical, and incremental sync metadata
- Platform Connector sync runs and checkpoints
- Canonical evidence records

## Read-only boundary

The adapter exposes entity list reads and Reporting API export jobs. Report creation is an
asynchronous read operation. It does not expose campaign creation, campaign activation,
status mutation, bid changes, budget changes, keyword changes, target changes, negative
targeting changes, or deletion/archive operations.

Both the provider and sync service reject non-sandbox normalization contexts. The transport
uses fixed entity paths, fixed report types, bounded identifiers, and mutation-shaped request
rejection.

## Checkpoint model

Entity checkpoint:

`amazon-ads:{profileId}:{marketplaceId}:entities`

Report checkpoint:

`amazon-ads:{profileId}:{marketplaceId}:report:{reportType}`

Entity checkpoints retain a token per resource. Report checkpoints retain report identity,
date range, attribution window, completion status, completed-through date, and processed row
count. Credentials and provider payloads are never stored.

## Remaining live-certification gates

- Approved Amazon Ads API access and an isolated sandbox/test advertiser profile
- Current regional endpoint and API-version verification
- OAuth/profile permission and credential rotation tests
- Real throttling and retry-header verification
- Multi-page and large-report download certification
- Marketplace timezone day-boundary tests
- Currency and cross-marketplace isolation tests
- Attribution-window and report-column verification
- Historical lookback and late-conversion reconciliation
- Operational approval for live availability
