---
name: demand-management
description: Breaks product requirements into demand pools, priorities, dependencies, milestones, and project tasks. Use when planning or reorganizing work for the AI project management platform.
---

# Demand Management

## Trigger

Use this skill after product-definition has a stable goal, user journey, scope boundary, and P0 acceptance criteria. Also use it when priorities, dependencies, milestones, or project risks need to be reorganized.

## Workflow

1. Read the product goal, scope boundary, user journey, and acceptance criteria.
2. Split work into epics, user stories, and implementation tasks.
3. Assign task ID, priority, owner role, dependencies, milestone, affected area, and validation command.
4. Build a dependency order before proposing parallel work.
5. Flag risks when a task blocks delivery, lacks acceptance criteria, or depends on missing data/API decisions.
6. Hand implementation-ready tasks to development-execution and validation-ready tasks to test-verification.

## Task Template

```markdown
## Task
- ID:
- Goal:
- Owner Role:
- Priority:
- Milestone:
- Dependencies:
- Affected Area:
- Acceptance:
- Validation:
- Risk:
```

## Priority Rules

- P0: Required for demo, build, deployment, or data integrity.
- P1: Required for core platform usability.
- P2: Useful enhancement after the main workflow works.

## Handoff

Send implementation-ready items to development-execution and validation-ready items to test-verification.

## Demand Gate

- Every P0 task maps to a P0 acceptance criterion.
- Every task has an owner role, dependency status, milestone, and validation method.
- Tasks touching shared architecture or data contracts are marked before development.
- Risk escalation is explicit for blockers that affect demo, build, deployment, data integrity, or project schedule.
