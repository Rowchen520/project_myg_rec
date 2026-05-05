---
name: product-definition
description: Defines product goals, user journeys, page scope, data fields, and acceptance criteria for the AI project management platform. Use when converting user ideas into product requirements.
---

# Product Definition

## Trigger

Use this skill when a request changes product scope, creates a new page or workflow, changes acceptance criteria, or asks to turn an idea into implementation-ready requirements.

## Workflow

1. Identify the target user, business goal, success metric, and constraints.
2. Write the main user journey before listing features.
3. Define scope boundaries: in scope, out of scope, assumptions, and open questions.
4. Convert the goal into user stories and P0/P1/P2 acceptance criteria.
5. Define pages, interactions, data fields, and API/data dependencies.
6. Mark missing information as assumptions with a default proposal.
7. Hand off only testable requirements to demand-management.

## Output

Use this structure:

```markdown
## Product Goal

## Target Users

## User Journey

## Scope Boundary
- In Scope:
- Out Of Scope:
- Assumptions:

## User Stories

## Pages And Interactions

## Data Fields

## Acceptance Criteria
- P0:
- P1:
- P2:

## Handoff To Demand Management
```

## Product Gate

- Every P0 story has a testable acceptance criterion.
- The first user journey is clear enough to demo without hidden steps.
- Data fields and API dependencies are named, even if implementation is deferred.
- Out-of-scope items are explicit when they could be confused with MVP scope.

## Rules

- Keep scope focused on the next deliverable.
- Prefer demo-ready behavior before complex optimization.
- Do not introduce hidden requirements that cannot be tested.
- Do not treat Cursor development automation as a platform runtime feature.
