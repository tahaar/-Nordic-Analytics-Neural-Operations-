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

### Shared Types
- TypeScript interfaces for betting domain
- Zod schemas for validation

## DevOps & CI/CD

- **Infra Pipeline**: Terraform init/plan/apply on infra changes
- **App Pipeline**: Docker build/push + Container App update on code changes
- **Manual Security**: Security infra run manually for safety

Workflows:
- [.github/workflows/infra-terraform.yml](.github/workflows/infra-terraform.yml)
- [.github/workflows/app-containers.yml](.github/workflows/app-containers.yml)

## Infrastructure

- Azure Container Apps for hosting
- Azure Container Registry for images
- Terraform modules for infra provisioning
- Azure Storage for Terraform state

## Security

- Entra ID MFA login
- Kill-switch for emergency shutdown
- Cost budgets and alerts
- Subscription-level locks

Security docs:
- [Kill Switch](docs/kill-switch.md)
- [Cost Controls](docs/cost-controls.md)
- [Security Infra](security-infra/README.md)

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

## Team & Roles

- [Team Roles](docs/team-roles.md)

## Getting Started

1. Clone the repo
2. Set up Azure credentials as GitHub secrets
3. Run infra pipeline for initial setup
4. Develop features and push to trigger deployments

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
