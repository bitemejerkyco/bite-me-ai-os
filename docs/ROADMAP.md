# Recommended Roadmap

## Phase 0 — Establish truth

Before new features:

1. Audit current `main`.
2. Map all routes, APIs, services, tables, RLS policies, integrations, and tests.
3. Run full validation.
4. Create a current-state architecture document.
5. List broken, mocked, incomplete, or disconnected features.
6. Confirm production environment and provider configuration.
7. Confirm active migrations match production.
8. Record baseline generation costs.

Deliverable: verified system inventory.

## Phase 1 — Beta reliability

Priority:

1. Authentication and workspace isolation
2. Onboarding completion and data reuse
3. Campaign create-to-schedule flow
4. Media/Content Library consistency
5. Video generation reliability
6. Credit reservation/refund correctness
7. TikTok connection and publishing
8. Resend transactional notifications
9. Error/retry visibility
10. Mobile review/approval

Exit criteria:

- No critical data-loss issue
- No duplicate credit charges
- No cross-tenant exposure
- Major workflow tests pass
- Failed generations recover cleanly
- Beta users can finish onboarding and schedule content

## Phase 2 — Novice-first UX redesign

1. Simplify dashboard
2. Consolidate overlapping creation tools
3. Guided campaign wizard
4. One review/approval center
5. Better empty states
6. Contextual Ask Motive
7. Consistent naming and statuses
8. Accessibility and mobile pass

Exit criterion: usability test with novice business owners succeeds without coaching.

## Phase 3 — Marketing Director intelligence

1. Strategy generation
2. Monthly plan
3. Goal-aware content mix
4. Brand voice enforcement
5. Compliance-aware channel recommendations
6. Performance summaries
7. Recommended next actions
8. Learning from approvals and results with human control

## Phase 4 — Commercial readiness

1. Stripe subscriptions
2. Credit packages and usage ledger
3. Plans and limits
4. Admin credit grants
5. Dunning and billing emails
6. Audit logs
7. Legal pages and consent records
8. Support and incident workflows

## Phase 5 — Integrations and growth

Evaluate by customer value, not feature count:

- Additional social channels
- Shopify
- Google Business Profile
- Email/SMS
- Amazon Ads
- Review management
- Agency/team features
- Templates and industry playbooks

## Prioritization rule

A feature should move ahead only when it:

- Completes the core workflow
- Removes customer effort
- Improves reliability or trust
- Reduces costs
- Produces measurable customer value
