# Cursor First-Session Prompt

You are taking over development of PostMotive in this repository.

First, read:

- `AGENTS.md`
- every file in `.cursor/rules/`
- `docs/PROJECT_CONTEXT.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/FEATURE_INVENTORY.md`
- `docs/KNOWN_ISSUES_AND_TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/DECISION_LOG.md`

Do not edit code yet.

Perform a complete current-state repository audit and produce:

1. Repository structure and architectural map
2. Current branch, last relevant commits, and git status
3. Route and screen inventory
4. API/server-action inventory
5. Database table, migration, RLS, function, trigger, and storage inventory
6. Authentication and workspace-isolation model
7. AI provider and prompt architecture
8. Video generation lifecycle
9. Credit/billing architecture
10. Social integration status, especially TikTok
11. Resend/email status
12. Test coverage and failing validation
13. Environment-variable inventory without exposing values
14. Features that are complete, partial, mocked, broken, or only documented
15. Security, data-loss, cost, and deployment risks
16. The ten highest-priority tasks to reach a reliable beta

Run the existing validation commands, but do not make fixes until the audit is presented.

For every conclusion, cite the repository files and lines or exact symbols that support it. Clearly distinguish verified facts from inferences. Treat the repository and deployed schema as the source of truth, not this handoff package.
