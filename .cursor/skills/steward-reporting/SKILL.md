---
name: steward-reporting
description: Generates AI steward progress reports, risk alerts, delay warnings, deployment summaries, and project briefs. Use when preparing dashboard messages or scheduled project updates.
---

# Steward Reporting

## Trigger

Use this skill when preparing dashboard messages, scheduled project updates, stakeholder summaries, risk alerts, delay warnings, deployment summaries, or project briefs based on verified progress data.

## Responsibility

Steward-reporting turns verified project facts into concise stakeholder communication. It depends on progress-check or equivalent evidence for factual status and should not be the milestone ledger.

## Workflow

1. Collect verified project data, task changes, risk records, tests, builds, and deployment results.
2. Identify progress, blockers, workload imbalance, high-impact risks, and required confirmations.
3. Generate a short stakeholder-ready brief with source evidence and recommended next actions.
4. Route urgent risks to dashboard notifications and configured delivery channels only when those channels actually ran.
5. If evidence is incomplete, mark the item as `需要确认` instead of presenting it as fact.

## Report Template

```markdown
## 项目进展
- 已完成：
- 进行中：
- 下一步：

## 风险项次
- 风险：
- 影响：
- 建议：

## 需要确认
- 事项：
```

## Steward Gate

- Every status claim maps to a project, task, risk, validation command, deployment signal, or explicitly stated assumption.
- High risks include impact, owner role, and next action.
- Deployment or notification claims are only made when a command, CI result, health check, or delivery record exists.
- The brief is written for project managers and stakeholders, not as an implementation changelog.

## Rules

- Every recommendation should map to a project, task, risk, or deployment signal.
- Use Low, Medium, or High for risk levels.
- Do not claim a push notification was sent unless a delivery channel actually ran.
- Keep `docs/project-progress.md` as the progress ledger and link back to it when preparing periodic summaries.
