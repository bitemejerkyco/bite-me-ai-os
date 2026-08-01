# TikTok Beta Launch

## Required Developer Products

- TikTok Login Kit for Web
- TikTok Content Posting API
- Optional TikTok webhook/event access if it is approved for this app

## Required Scopes

- `user.info.basic`
- `video.upload`
- `video.publish` only for direct post approval and testing

## Redirect And Webhook URLs

- Callback URL: `https://<your-app-domain>/api/integrations/tiktok/callback`
- Webhook URL: `https://<your-app-domain>/api/integrations/tiktok/webhook`

## Media Delivery

- Use a verified HTTPS prefix for TikTok pull-from-url delivery.
- Configure `TIKTOK_MEDIA_BASE_URL` to the public media base.
- Configure `TIKTOK_VERIFIED_URL_PREFIX` to the exact URL prefix TikTok is allowed to fetch.
- Keep PostMotive session cookies out of the media URL path.

## Environment Variables

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_WEBHOOK_SECRET`
- `TIKTOK_MEDIA_BASE_URL`
- `TIKTOK_VERIFIED_URL_PREFIX`
- `TIKTOK_CONTENT_POSTING_MODE=beta_upload`
- `TIKTOK_WEBHOOKS_ENABLED=false`
- `TIKTOK_TOKEN_ENCRYPTION_KEY`

## Sandbox Setup

- Keep `TIKTOK_CONTENT_POSTING_MODE=sandbox` only for legacy private-only testing.
- Verify login, token refresh, and draft delivery before enabling beta accounts.

## Beta Upload-To-Draft Setup

- Set `TIKTOK_CONTENT_POSTING_MODE=beta_upload`.
- Confirm the verified media prefix is reachable without cookies.
- Allow only the approved beta workspaces and users.
- Keep the first uploads manual and user-initiated.

## Direct Post Audit Limitation

- Direct post remains gated behind approval and `video.publish` scope.
- Do not enable direct post unless TikTok approval is confirmed for the app.

## Test Account Procedure

- Connect a single allowed workspace.
- Upload one completed video to draft delivery.
- Confirm the TikTok inbox delivery state before considering the post successful.
- Test reconnect and refresh flows before widening access.

## Launch Checklist

1. Verify the callback URL in the TikTok developer portal.
2. Verify the media URL prefix in the TikTok developer portal.
3. Confirm the allowed beta workspaces and users.
4. Confirm the token encryption key is present and rotated safely.
5. Confirm the webhook flag remains disabled unless verified.
6. Confirm Upload-to-Draft works end to end.

## Rollback And Emergency Disable

- Set `tiktok_beta_emergency_disabled` to `true`.
- Set `TIKTOK_CONTENT_POSTING_MODE=disabled` if you need to stop new connections immediately.
- Revoke active connections if needed and verify the audit trail.

## Known Limitations

- Webhooks are disabled until verified delivery rules are confirmed.
- Direct post requires TikTok approval and the `video.publish` scope.
- Upload-to-Draft depends on a verified public media prefix.
- The first beta should stay manually initiated; unattended scheduling is not enabled by default.