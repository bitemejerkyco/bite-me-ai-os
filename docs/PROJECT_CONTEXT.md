# PostMotive Project Context

## Product

PostMotive is a multi-tenant AI marketing platform built for small businesses. Its purpose is to act as a practical marketing director rather than a collection of disconnected generation tools.

## Target customer

The primary user is a small-business owner who:

- Has limited marketing knowledge
- Does not know how to write AI prompts
- Has little time
- Needs consistent social and promotional content
- Wants clear recommendations rather than dashboards full of data
- May operate in a regulated industry

Initial and likely customer categories include restaurants, consumer packaged goods, retail, contractors, cannabis-related businesses, automotive businesses, real estate, fitness, healthcare-adjacent businesses, and local services.

## Core jobs to be done

1. Learn the business, offer, customer, brand voice, and industry.
2. Build a practical marketing strategy.
3. Turn strategy into campaigns.
4. Generate platform-appropriate content.
5. Generate or organize supporting media.
6. Review and approve content.
7. Schedule or publish content.
8. Measure performance.
9. Recommend improvements.
10. Learn from results and approved content.

## Product principles

### One-click where safe

The ideal experience moves from business setup to a ready-to-review campaign with minimal decisions. One-click does not mean hiding important approval or compliance controls.

### Guided rather than blank

Use examples, recommendations, presets, and questions. Avoid empty prompt boxes as the primary workflow.

### Progressive disclosure

Show basic choices first. Keep advanced settings available but out of the primary path.

### One source of truth

Business profile, brand voice, compliance category, connected channels, media, campaigns, approvals, and results should be reusable across the platform.

### Trust

Show what the AI is doing, current generation state, what will be published, costs or credits, and how to recover from failure.

## Brand direction

- Bright
- Premium
- Inspiring
- Modern
- Smooth and approachable
- Generous whitespace
- Rounded components
- Clear hierarchy
- Not black-and-red
- Not overly corporate
- Not intimidating or developer-oriented

The approved customer-facing assistant name is **Ask Motive**.

## Primary navigation

Current or intended core areas:

- Dashboard
- Campaigns
- Content Library
- Media Library
- Calendar
- AI or Content Studio
- Analytics
- Ask Motive / Help
- Settings
- Billing and credits where appropriate

Navigation should be audited against the actual repository before changing it.

## Compliance Mode

During onboarding, customers choose an industry such as:

- Cannabis
- Alcohol
- CBD
- Healthcare
- Financial services
- Supplements
- General retail

Compliance Mode should adapt content recommendations and flag likely platform-policy or legal risks. It should suggest safer alternatives and appropriate channels. It must not promise legal compliance or replace legal review.

For cannabis-related businesses, emphasize brand storytelling, permitted education, company updates, behind-the-scenes content, community engagement, events where permitted, customer service, website and SEO content, and lawful email/SMS strategies.

## Media Intelligence Library

This is a foundational feature.

Supported assets should include:

- Photos
- Videos
- Logos
- Graphics
- Licensed music/audio
- Other brand assets

Desired intelligence includes tagging, transcripts, key moments, grouping, search, and duplicate detection. Folder behavior must be intuitive. A moved asset should not appear as though it remains in the original user folder, while an “All Assets” system view may still represent the complete library if clearly labeled.

## One-click short-video workflow

The intended flow is:

1. Generate or select a post concept.
2. Create a short vertical video suitable for TikTok/Reels.
3. Generate or attach voice/music where appropriate.
4. Add caption and hashtags.
5. Save working content to the Content Library.
6. Save final media to the Media Library.
7. Allow review/editing.
8. Schedule or publish.
9. Reserve and deduct credits safely.
10. Refund on definitive generation failure.

The repository history indicates Replicate and an economical Wan 2.2 Fast route were introduced. Cursor must verify the current adapter, model identifiers, provider configuration, and production behavior.

## Commercial model

Intended model:

- Subscription tiers
- Usage credits for costly generation
- Video consumes credits
- Failed paid generation refunds reserved credits
- Admin can grant beta/testing credits
- Future premium AI features may consume additional credits

Stripe is installed, but Cursor must verify which billing flows are complete.

## Success definition

A new restaurant owner should be able to sign up, answer a small set of business questions, receive a useful marketing plan and content, approve it, and schedule it without needing outside training.
