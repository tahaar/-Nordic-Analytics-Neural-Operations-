# Architecture Overview

## What the app does
Nordic Analytics Neural Operations combines three betting tip sources (Forebet, OLBG, Vitibet), normalizes them into one match list, and presents them in a React UI.

## System components
- Frontend: React + Material UI
- Backend: Express + TypeScript
- Cache: In-memory + disk file (/data/cache.json)
- Infra: Azure Container Apps + ACR + Terraform

## Runtime controls
- All `/api/*` routes require a valid Entra ID bearer token with the `AppUser` role.
- Admin-only operational data is exposed via `GET /api/admin/memory` and requires the `Admin` role.
- Backend cache persists to disk, drops expired entries on access/save, and exposes coarse cache metrics for operators.

## Operational behavior
- Normal end users interact with match, scraper and bot endpoints through the frontend.
- Admin users get one extra operational surface in the frontend: an admin memory view backed by `GET /api/admin/memory`.
- The backend cache is intentionally simple: in-memory first, optional disk persistence second, TTL-based expiry throughout.
- This keeps the implementation understandable while still giving enough observability for a small Azure hobby deployment.

## Request flow
1. Frontend calls `/api/matches/combined`.
2. Backend fetches source data from scraper services.
3. Backend normalizes records to `matchKey`.
4. Frontend renders combined rows and enables pinning / betslips.

## Data model in practice
Example combined row:

```json
{
  "matchKey": "arsenal-vs-chelsea",
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  "kickoff": "19:30",
  "forebet": { "predictedScore": "2-1" },
  "olbg": { "stars": 4, "popularPick": "Home win" },
  "vitibet": { "recommendation": "1" },
  "tips": [
    { "id": "forebet:arsenal-vs-chelsea", "source": "forebet", "tipType": "1X2", "tipValue": "2-1" }
  ]
}
```

## Security baseline
- Frontend login target: Entra ID (MFA via policy)
- Backend: token validation and role enforcement active for `/api/*`
- Infra controls: budget guardrails, kill switch, monitoring alerts
