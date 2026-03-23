# Infrastructure Details

## Planned deployment model
- Build images in GitHub Actions
- Push images to Azure Container Registry
- Update Azure Container Apps (frontend + backend)

## Minimal runtime layout
- frontend container: serves SPA
- backend container: serves `/api/*`
- optional reverse-proxy path routing in front of both apps

## Environment variables
Recommended minimum:
- `PORT` for backend
- `CACHE_FILE` for cache persistence path
- Entra/MSAL variables for frontend auth integration

## Alerting (platform level)
Recommended alerts:
- Container restart count spike
- HTTP 5xx error rate above threshold
- CPU and memory saturation
- Budget threshold alerts (cost guardrails)

## Example alert policy idea
- Warning: 5xx rate > 2% for 10 minutes
- Critical: 5xx rate > 5% for 5 minutes
- Action: notify team channel + open incident issue
