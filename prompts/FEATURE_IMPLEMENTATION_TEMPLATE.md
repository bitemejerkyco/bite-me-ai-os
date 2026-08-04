# Feature Implementation Prompt Template

Implement: [FEATURE]

Business outcome:
[WHAT THE CUSTOMER SHOULD BE ABLE TO ACCOMPLISH]

Target user:
[A NOVICE SMALL-BUSINESS OWNER / ADMIN / TEAM MEMBER]

Acceptance criteria:
1. [...]
2. [...]
3. [...]

Constraints:
- Preserve existing behavior outside scope.
- Follow `AGENTS.md` and relevant `.cursor/rules`.
- Inspect existing patterns before designing.
- Include loading, empty, success, error, retry, and mobile behavior.
- Enforce authentication, authorization, validation, and workspace isolation.
- Address credit/cost idempotency if generation or external paid APIs are involved.
- Add or update tests.
- Update docs when behavior changes.

Workflow:
1. Audit relevant code and summarize plan.
2. Implement the smallest complete solution.
3. Run lint, tests, build, relevant help validation, diff check, and status.
4. Report files changed, migrations, environment variables, validation results, and remaining risks.
