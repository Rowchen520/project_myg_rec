---
name: progress-check
description: Summarizes project progress, risks, blockers, tests, deployment status, and next steps for the AI project management platform. Use when the user asks for current progress or project health.
---

# Progress Check

## Trigger

Use this skill when the user asks for project status, current progress, blockers, validation state, deployment state, or project health.

## Responsibility

Progress-check is the factual status audit. It reads evidence and reports what is known. It does not write stakeholder-facing steward briefs and does not claim unrun tests, CI, deployment, or notifications.

## Workflow

1. Read `docs/project-progress.md` and relevant project files.
2. Check Git status, recent implementation scope, tests, build, and deployment status.
3. Compare the documented milestone state with repository evidence.
4. Summarize completed work, active work, blockers, risks, validation, and next steps.
5. If the status document is stale, say which line item needs update before using it as fact.
6. Keep the answer concise and actionable.

## Output

```markdown
## 当前进度

## 风险与阻塞

## 最近验证

## 下一步
```

## Rules

- Mention only evidence-backed status.
- If tests or deployment were not run, say so directly.
- Do not fabricate CI/CD or server results.
- Treat `docs/project-progress.md` as the milestone ledger, but verify it against files, commands, and recent changes.
- Route stakeholder-ready summaries, reminders, and risk escalation wording to steward-reporting.
