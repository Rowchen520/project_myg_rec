---
name: development-execution
description: Implements scoped code changes for the AI project management platform while following TypeScript, JSDoc, formatting, and minimal-change rules. Use when developing features or fixing defects.
---

# Development Execution

## Trigger

Use this skill only after the task has an acceptance criterion, affected area, and validation expectation. For architecture or product ambiguity, route back to product-definition or demand-management before coding.

## Workflow

1. Read the relevant requirement, architecture notes, existing files, and tests.
2. Confirm the change belongs to platform runtime code, Cursor skill process, or documentation.
3. Implement the smallest coherent change that satisfies the acceptance criteria.
4. Keep UI state, application services, domain logic, and infrastructure boundaries separated when practical.
5. Use TypeScript types for shared contracts.
6. Use JSDoc comments for exported functions, complex helpers, and non-obvious behavior.
7. Run the narrowest relevant validation first, then broader build checks when the risk justifies it.

## Coding Rules

- Keep UI state and domain logic separated when practical.
- Prefer pure functions for agent analysis and dashboard aggregation.
- Do not hard-code secrets, server addresses, or API keys.
- Preserve user changes and avoid unrelated refactors.
- AI provider output must be normalized and validated before it can become project truth.
- Server-side write paths must enforce role and project scope before persistence.

## Definition Of Done

```markdown
## Implementation Done
- Requirement:
- Files Changed:
- Behavior:
- Validation Run:
- Build Impact:
- Risks Or Deferred Work:
```

## Implementation Gate

- The change maps to a task acceptance criterion.
- Shared data contracts are typed and documented.
- Exported or non-obvious logic has JSDoc where useful.
- No platform runtime UI exposes Cursor-only unattended development as a product feature.
- Tests or validation gaps are stated before handoff.

## Completion

A development task is complete only when implementation, tests, and build impact are understood.
