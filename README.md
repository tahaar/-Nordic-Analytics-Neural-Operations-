# Nordic Analytics Neural Operations

Betting domain application with full-stack TypeScript, Azure Container Apps, and security guardrails.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Development](#development)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Shared Types](#shared-types)
- [DevOps & CI/CD](#devops--cicd)
- [Infrastructure](#infrastructure)
- [Security](#security)
- [Documentation](#documentation)
- [Team & Roles](#team--roles)

## Overview

This monorepo contains a betting domain application built with:
- **Frontend**: React + Material UI + MSAL for Entra ID MFA login
- **Backend**: Node.js + Express + TypeScript + Zod validation
- **Infra**: Azure Container Apps + Terraform + Azure Storage backend
- **Security**: Kill-switch, cost guardrails, monitoring alerts

## Architecture

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [Infrastructure Details](docs/infra.md)

## Development

### Frontend
- React with TypeScript
- Material UI components
- MSAL React for authentication
- Custom hooks for bets and odds

### Backend
- Express.js with TypeScript
- Zod schema validation
- Dependency injection
- JWT token validation
- Cache persistence with TTL pruning and admin memory metrics

### Shared Types
- TypeScript interfaces for betting domain
- Zod schemas for validation

## DevOps & CI/CD

- **Infra Pipeline**: Terraform init/plan/apply on infra changes
- **App Pipeline**: Docker build/push + Container App update on code changes
- **Manual Security**: Security infra run manually for safety

### Deploy Overview
Current intended deployment model:
1. Create and configure the security layer first.
2. Create the GitHub Azure deployment identity and configure OIDC.
3. Use PIM for time-limited privileged manual actions.
4. Run `security-infra/` manually with Terraform.
5. Run the infra baseline manually from GitHub Actions.
6. Push application changes to `production` to trigger build and deployment.
7. Read the frontend Container App ingress FQDN from Azure and open it in browser.

Branch roles:
- `main` = work branch
- `production` = deployment branch

Important distinctions:
- `security-infra/` is manual by design.
- `.github/workflows/infra-terraform.yml` is manually triggered.
- `.github/workflows/app-containers.yml` deploys the app automatically from `production` pushes.

Full step-by-step runbook:
- [Infrastructure Details](docs/infra.md)
- [Security Infra](security-infra/README.md)

Workflows:
- [.github/workflows/infra-terraform.yml](.github/workflows/infra-terraform.yml)
- [.github/workflows/app-containers.yml](.github/workflows/app-containers.yml)
- [.github/workflows/frontend-quality.yml](.github/workflows/frontend-quality.yml)
- [.github/workflows/backend-quality.yml](.github/workflows/backend-quality.yml)

Trigger policy:
- Infra workflow runs manually only (`workflow_dispatch`) and supports both `apply` and `destroy`.
- App and quality workflows run automatically only on `production` branch.

Branch note:
- Repository default branch may be `main`, but the current deployment workflows are configured against `production`.
- If your actual release flow uses `main`, update the workflow branch filters before relying on automatic deployment.

## Infrastructure

- Azure Container Apps for hosting
- Azure Container Registry for images
- Terraform modules for infra provisioning
- Azure Storage for Terraform state
- Step-by-step setup checklist: [Infrastructure Details](docs/infra.md)
- Start from the security layer first: [Security Infra](security-infra/README.md)

## Security

- Entra ID MFA login
- Kill-switch for emergency shutdown
- Cost budgets and alerts
- Subscription-level locks

Security docs:
- [Kill Switch](security-infra/docs/kill-switch.md)
- [Cost Controls](security-infra/docs/cost-guardrails.md)
- [Security Infra](security-infra/README.md)
- [Infrastructure Runbook](docs/infra.md)

## Documentation

### Development Guides
- [Patterns and Principles](security-infra/ai-notes/patterns-and-principles.md)

### Prompts
- [Architect](prompts/arkkitehti.md)
- [Organizer](prompts/organisaattori.md)
- [Fullstack Backend](prompts/fullstack-backend.md)
- [Fullstack Frontend](prompts/fullstack-frontend.md)
- [Test Manager](prompts/testipaallikko.md)
- [Cost Controller](prompts/kustannusvahti.md)
- [Role Master](prompts/roolimestari.md)
- [Gemini Backlog Bot](prompts/gemini-backlog.md)
- [Claude Implementation](prompts/claude-impl.md)

### Operations
- [Operations Guide](docs/operations.md)

### Technical Docs
- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Infrastructure](docs/infra.md)

## Team & Roles

- [Team Roles](docs/team-roles.md)

## Getting Started

1. Clone the repo
2. Create the security subscription / security control layer first
3. Create Azure runtime resources and GitHub OIDC/secrets
4. Run infra workflow manually where applicable
5. Develop features and push to trigger deployments

For Azure bootstrap and deployment:
- [Infrastructure Details](docs/infra.md)
- [Security Infra](security-infra/README.md)

## Project Structure

```
.
├── packages/
│   ├── shared-types/
│   ├── backend/
│   └── frontend/
├── infra/
├── security-infra/
├── docs/
├── prompts/
├── bots/
└── .github/workflows/
```  
