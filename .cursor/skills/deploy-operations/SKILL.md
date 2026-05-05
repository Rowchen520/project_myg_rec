---
name: deploy-operations
description: Manages Docker, GitHub Actions, VPS deployment, environment variables, and health checks for the AI project management platform. Use when preparing or troubleshooting deployment.
---

# Deploy Operations

## Trigger

Use this skill when preparing a release, troubleshooting Docker/GitHub Actions/VPS deployment, changing environment variables, or validating production health.

## Workflow

1. Verify tests and build pass before deployment.
2. Confirm required environment variables are documented in `.env.example`.
3. Build the Docker image and start services with Docker Compose.
4. Run the health check endpoint and page smoke checks.
5. If deployment fails, inspect Docker logs, SSH connectivity, secrets, and service health.

## Required Secrets

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- `APP_ENV`

## Safety Rules

- Never commit real secrets.
- Prefer GitHub Secrets and server-side `.env`.
- Do not force-push or reset deployment branches unless explicitly requested.

## Release Gate

- `npm run test`, `npm run lint`, and `npm run build` have passed or blockers are documented.
- Docker image builds successfully before VPS rollout.
- Health check endpoint succeeds after service start.
- Missing VPS credentials are recorded as deployment blockers, not as successful deployment.
- Rollback notes are captured when a release changes runtime configuration or persistence.
