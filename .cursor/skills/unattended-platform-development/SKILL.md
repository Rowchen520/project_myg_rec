---
name: unattended-platform-development
description: Orchestrates a multi-round unattended R&D loop in Cursor: product research, PM requirements, technical breakdown, parallel developer subagents, test-fix loops, product review, release validation, and progress reporting. Use only for Cursor development work, not as a platform runtime feature.
---

# Unattended Platform Development

## Principle

This skill is for Cursor-based development automation. The product platform must not expose this as a business feature.

## Trigger

Use this skill only when the user explicitly requests a large Cursor development loop, multi-agent implementation, multi-round optimization, or unattended platform development. For small scoped edits, use product-definition, demand-management, development-execution, and test-verification instead.

## Runtime Boundary

- This skill is an engineering workflow for building the repository.
- It must not create product UI that represents Cursor development automation as a platform runtime feature.
- Platform runtime Agent workflows must stay focused on project management: demand intake, task planning, progress sync, risk diagnosis, collaboration, steward updates, and notifications.
- If a product feature request depends on this workflow, first rewrite it as a user-facing project management capability before implementation.

Follow OpenAI-style agent workflow ideas:

- Handoffs: each specialist passes a structured output to the next specialist.
- Background work: long research, development, tests, and deployment checks can run as separate subagent tasks.
- Tracing: record commands, files touched, decisions, failures, and review outcomes.
- Guardrails: block unsafe, unclear, or untestable work before it reaches development.
- Evaluation loop: tests, product acceptance, and iteration record review drive repeated improvement.
- Self-improvement: after each round, inspect traces and evidence to decide whether the workflow, skills, docs, or task strategy should be updated.

## Subagent Map

Use these subagents as a controlled R&D loop:

1. MissionControlAgent: owns iteration state, trace log, stop conditions, and final summary.
2. IndustryResearchAgent: researches industry practice and mature product references.
3. ProductManagerAgent: writes PRD, user stories, acceptance criteria, and product review checklist.
4. ArchitectureDesignerAgent: owns architecture direction, domain boundaries, data flow, extensibility, integration contracts, and architecture iteration proposals.
5. TechLeadAgent: turns PRD and architecture guidance into task graph, dependency order, and work packages.
6. DeveloperAgent: implements a single work package with minimal scoped changes.
7. DeveloperReviewAgent: reviews code implementation for efficiency, performance, maintainability, bundle/runtime impact, and unnecessary complexity.
8. IntegrationAgent: merges compatible work, resolves conflicts, and runs broad checks.
9. TestAgent: runs tests, lint, build, E2E, and records reproducible failures.
10. FixAgent: fixes only evidence-backed failures and returns work to TestAgent.
11. UIDesignerAgent: reviews the built UI for aesthetics, design consistency, hierarchy, motion, accessibility, and brand tone before product review.
12. ProductReviewAgent: uses the built feature and reviews against product acceptance criteria.
13. PMReviewAgent: re-evaluates the iteration outcome on three product dimensions: innovation, practicality, and intelligence, and emits actionable optimization tasks until the platform feels production-grade.
14. ReleaseAgent: performs CI/Docker/VPS checks only after architecture, developer, product, UI, and PM reviews pass or are explicitly waived.
15. ProgressAgent: reports iteration state, evidence, risks, and next round.
16. StewardAgent: escalates repeated failures, product gaps, and unresolved risks.
17. IterationSupervisorAgent: audits the complete iteration record, checks handoff quality, gate compliance, and repeated failure patterns.
18. ProcessMemoryAgent: converts validated lessons into updates for skills, docs, templates, checklists, or next-round strategy.

## Iteration Workflow

Each round must run in this order:

1. MissionControlAgent creates `iteration_id`, objective, constraints, evidence log, and stop conditions.
   - Unattended development must plan for at least 3 development iterations by default.
   - The loop may stop before 3 iterations only when a Stop Condition is triggered or the user explicitly narrows the scope.
   - Each iteration must either improve shipped behavior or create a clearly justified optimization task for the next round.
2. IndustryResearchAgent researches mature products, industry patterns, user workflows, and comparable features.
3. ProductManagerAgent turns research into a testable PRD:
   - product goal
   - target users
   - user stories
   - data fields
   - interaction scope
   - acceptance criteria
   - product review checklist
4. ArchitectureDesignerAgent creates or updates architecture guidance:
   - system boundaries
   - data model and integration contracts
   - scalability and extensibility notes
   - performance-sensitive paths
   - architecture risks and iteration proposals
5. TechLeadAgent creates a technical plan:
   - architecture notes
   - task graph
   - dependency order
   - parallel work packages
   - affected files
   - expected tests
6. DeveloperAgent subagents implement parallel work packages only when their file scopes do not conflict.
7. DeveloperReviewAgent reviews implementation efficiency and performance. Gaps return to DeveloperAgent or TechLeadAgent.
8. IntegrationAgent combines completed work packages and runs broad validation.
9. TestAgent runs required validation.
10. If validation fails, TestAgent sends failure evidence to FixAgent.
11. FixAgent applies the smallest fix and returns to TestAgent.
12. Repeat steps 9-11 until tests pass or the retry limit is reached.
13. ArchitectureDesignerAgent reviews the final implementation against the Architecture Gate. Gaps return to TechLeadAgent or DeveloperAgent.
14. UIDesignerAgent reviews the new screens against the UI Design Gate. Gaps return to DeveloperAgent (visual or motion fix) or to ProductManagerAgent (information architecture or copy issue).
15. ProductReviewAgent runs the feature against the PRD checklist.
16. If product review fails:
    - implementation gap returns to DeveloperAgent
    - test gap returns to TestAgent
    - unclear product decision returns to ProductManagerAgent
    - architectural mismatch returns to TechLeadAgent
17. PMReviewAgent re-evaluates the iteration on innovation, practicality, and intelligence. Each rejected dimension produces a follow-up optimization task that re-enters the loop at the right specialist (Product, Architecture, TechLead, Developer, or UIDesigner). The iteration is only considered done when no PMReview dimension is below the project bar.
18. If product, UI, architecture, developer, and PM reviews pass, ReleaseAgent can run CI/Docker/VPS checks when credentials exist.
19. ProgressAgent and StewardAgent summarize evidence, risk, next round, and unresolved items.
20. IterationSupervisorAgent audits the iteration evidence log:
    - missing handoff payloads
    - weak research evidence
    - unclear PRD or acceptance criteria
    - unstable task decomposition
    - repeated test failures
    - product review rejection reasons
    - UI design gate rejections and unfixed visual debt
    - architecture review rejections and unresolved architecture debt
    - developer review rejections for inefficient or low-performance implementation
    - PM review rejections per dimension (innovation, practicality, intelligence)
    - stale docs or misleading workflow instructions
21. ProcessMemoryAgent decides whether to update process artifacts:
    - update this skill only when the workflow rule itself was wrong or incomplete
    - update project docs when product or architecture knowledge changed
    - update test checklists when failures escaped existing validation
    - update next-round task strategy when planning or handoffs caused rework
    - do not update docs or skills for one-off implementation mistakes
22. MissionControlAgent starts the next iteration only after supervisor findings are resolved or explicitly deferred. In unattended mode, it continues until at least 3 iterations have completed or a Stop Condition is reached.

## Gates

- Research Gate: research has at least 2-3 mature references or explains why evidence is unavailable.
- PRD Gate: every P0 user story has testable acceptance criteria.
- Minimum Iteration Gate: unattended development runs at least 3 development iterations unless a Stop Condition or explicit user scope limit applies. Each iteration must include implementation or evidence-backed optimization work.
- Architecture Gate: ArchitectureDesignerAgent confirms boundaries, data model, integration contracts, scalability, performance-sensitive paths, and architecture debt are acceptable or tracked as next-round tasks.
- Plan Gate: P0 tasks have owner role, dependency, affected area, architecture impact, and validation command.
- Parallel Gate: no two DeveloperAgent subagents may modify the same high-risk file set at the same time.
- Implement Gate: changes are scoped, typed, and use JSDoc for exported or non-obvious logic.
- Developer Review Gate: DeveloperReviewAgent confirms code is efficient, high-performance for the expected usage, maintainable, avoids unnecessary recomputation or bundle growth, and does not introduce avoidable complexity.
- Test Gate: `npm run test`, `npm run lint`, `npm run build`, and relevant `npm run test:e2e` pass.
- Fix Gate: every fix maps to a failing command, assertion, or product review item.
- UI Design Gate: UIDesignerAgent confirms visual hierarchy, spacing rhythm, color contrast, motion polish, accessibility roles, and brand consistency. Each rejection lists the screen, the rule violated, and the proposed fix.
- Product Review Gate: ProductReviewAgent can use the feature and mark P0 acceptance criteria passed or explicitly rejected.
- PM Review Gate: PMReviewAgent rates the iteration on innovation, practicality, and intelligence. Each dimension below the bar must spawn a tracked optimization task before the iteration can be marked complete.
- Release Gate: CI/Docker/VPS health checks pass or missing credentials are documented as blockers.
- Report Gate: every status claim links to evidence from commands, files, review notes, or product acceptance.
- Supervision Gate: IterationSupervisorAgent confirms the evidence log is complete and identifies process gaps.
- Memory Gate: ProcessMemoryAgent records only reusable lessons, not noisy one-off mistakes.

## Failure Loop

- Product ambiguity returns to ProductManagerAgent.
- Weak research returns to IndustryResearchAgent.
- Missing architecture direction, unclear boundaries, weak integration contract, or scalability concern returns to ArchitectureDesignerAgent.
- Missing dependency or priority conflict returns to TechLeadAgent.
- Inefficient implementation, avoidable recomputation, unnecessary bundle growth, or performance regression returns to DeveloperAgent with DeveloperReviewAgent evidence.
- Test or build failure returns to FixAgent with the failing command and minimal reproduction.
- Product review failure returns to ProductManagerAgent, TechLeadAgent, DeveloperAgent, or TestAgent based on root cause.
- UI design rejection returns to DeveloperAgent with the screen, the violated design rule, and the proposed fix; copy or IA gaps return to ProductManagerAgent.
- PM review rejection on innovation, practicality, or intelligence must spawn tracked optimization tasks routed to the right specialist. The iteration cannot close while any dimension stays below the bar.
- The same failure may be retried at most 3 times before StewardAgent marks it as High risk.
- Deployment failure returns to ReleaseAgent with SSH, Compose, secret, or health category.
- Missing or low-quality iteration records return to MissionControlAgent for evidence completion.
- Repeated process mistakes return to ProcessMemoryAgent to update skill, checklist, or documentation.

## Evidence Log

Every iteration must maintain a concise evidence log:

```markdown
## Iteration
- id:
- objective:
- product references:
- PRD:
- architecture design:
- work packages:
- commands:
- failing evidence:
- fixes:
- developer review (efficiency/performance):
- architecture review:
- ui design review:
- product review:
- pm review (innovation/practicality/intelligence):
- pm follow-up tasks:
- iteration count:
- release check:
- supervision review:
- reusable lessons:
- process updates:
- risks:
- next round:
```

## Iteration Supervision

After every iteration, run IterationSupervisorAgent before starting the next round.

Use this checklist:

```markdown
## Iteration Supervision Review
- Were all handoffs structured and complete?
- Did each gate have evidence?
- Did unattended mode complete at least 3 development iterations, or cite a valid Stop Condition?
- Which failure repeated?
- Which issue escaped earlier checks?
- Did ArchitectureDesignerAgent review architecture boundaries, data flow, integration contracts, scalability, and architecture debt?
- Did DeveloperReviewAgent review implementation efficiency, performance, maintainability, and avoidable complexity?
- Was product review based on acceptance criteria?
- Did UIDesignerAgent review every new or modified screen?
- Did PMReviewAgent emit follow-up tasks for any rejected dimension?
- Did any doc, skill, prompt, checklist, or test become stale?
- Should the next round change scope, agent order, parallelism, or validation?
```

The supervisor must classify findings:

- `process_update`: workflow, skill, checklist, or doc should change.
- `product_update`: PRD, acceptance criteria, or product docs should change.
- `test_update`: validation missed an important behavior.
- `planning_update`: task decomposition or dependency strategy caused rework.
- `architecture_update`: architecture boundaries, contracts, scalability assumptions, or design docs should change.
- `performance_update`: implementation efficiency, runtime performance, bundle size, or expensive recomputation needs follow-up.
- `no_update`: the issue was a one-off implementation mistake.

## Process Memory

ProcessMemoryAgent applies Hermes-style self-improvement:

- Persist useful lessons from completed iterations.
- Improve skills during use when repeated failures reveal missing instructions.
- Nudge future iterations with remembered risks, patterns, and successful strategies.
- Search prior iteration records before repeating an approach.
- Keep updates small, evidence-backed, and reversible.

Do not automatically rewrite process artifacts unless IterationSupervisorAgent marks the finding as reusable and evidence-backed.

## Stop Conditions

Stop and report instead of continuing when:

- PRD has no testable acceptance criteria.
- Required credentials or external systems are missing.
- A destructive action is required without explicit user approval.
- The same failure repeats 3 times.
- ProductReviewAgent rejects the feature for a product decision that needs user clarification.
- UIDesignerAgent rejects the UI for a brand or accessibility decision that requires explicit design direction.
- ArchitectureDesignerAgent rejects the architecture for a product-scale or integration decision that needs user direction.
- DeveloperReviewAgent rejects the implementation for a performance trade-off that needs user direction.
- PMReviewAgent rejects the iteration on a dimension that needs user input on the bar (innovation, practicality, or intelligence).
- IterationSupervisorAgent cannot find enough evidence to judge the iteration.
- ProcessMemoryAgent identifies a process update that requires user approval before editing shared rules.
