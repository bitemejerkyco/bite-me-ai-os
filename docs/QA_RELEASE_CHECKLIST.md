# QA and Release Checklist

## Before coding

- [ ] Correct repository and branch
- [ ] Clean or understood git status
- [ ] Relevant rules/docs read
- [ ] Existing implementation inspected
- [ ] Acceptance criteria written
- [ ] Data/security/cost risks identified

## Automated validation

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run validate:help` when applicable
- [ ] `git diff --check`
- [ ] `git status --short`

## Functional testing

- [ ] Happy path
- [ ] Empty state
- [ ] Invalid input
- [ ] Unauthenticated request
- [ ] Wrong-workspace request
- [ ] Provider timeout
- [ ] Provider failure
- [ ] Retry
- [ ] Duplicate submission
- [ ] Mobile viewport
- [ ] Keyboard/focus
- [ ] Data persists after refresh

## Generation and credits

- [ ] Cost shown before action
- [ ] Credit reservation is atomic
- [ ] Duplicate request does not double-charge
- [ ] Completion consumes correctly
- [ ] Definitive failure refunds
- [ ] Retry policy is explicit
- [ ] Output stored once
- [ ] User sees durable status

## Database

- [ ] New migration added
- [ ] Backfill precedes constraint
- [ ] RLS verified
- [ ] Existing production data considered
- [ ] Rollback/recovery documented
- [ ] Generated types updated if applicable

## Deployment

- [ ] Preview deployment checked
- [ ] Environment variables present
- [ ] Migration applied in correct order
- [ ] Production smoke test
- [ ] Logs reviewed
- [ ] No secret or debug leakage
- [ ] Changelog/docs updated
