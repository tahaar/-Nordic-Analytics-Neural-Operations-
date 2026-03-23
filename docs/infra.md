# Infrastructure Details

## Deployment model (current)
- GitHub Actions builds container images from backend and frontend.
- Images are pushed to Azure Container Registry (ACR).
- Workflow updates Azure Container Apps (`backend`, `frontend`) to latest images.

Primary workflow:
- [.github/workflows/app-containers.yml](.github/workflows/app-containers.yml)

## Quick start checklist
1. Create Azure service principal for GitHub Actions.
2. Grant minimum required Azure roles to that principal.
3. Create required GitHub repository secrets.
4. Set resource group as GitHub secret (`AZURE_RESOURCE_GROUP`).
5. Run workflow manually from GitHub Actions once (`workflow_dispatch`).
6. Verify both container apps updated successfully.

## 1) Azure service principal (principal + secret)
Create principal and client secret with Azure CLI:

```bash
az ad sp create-for-rbac \
	--name "gh-nordic-analytics-deploy" \
	--role Contributor \
	--scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

Save these outputs for GitHub secrets:
- `appId` -> `AZURE_CLIENT_ID`
- `tenant` -> `AZURE_TENANT_ID`
- `password` -> `AZURE_CLIENT_SECRET`
- Subscription ID -> `AZURE_SUBSCRIPTION_ID`

Note:
- Start with resource-group scoped access (not whole subscription) for least privilege.
- `Contributor` is simplest to start; tighten to custom/limited roles later if needed.

## 2) GitHub secrets: what and where
Go to:
- GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Create these exact secrets (used by workflow):

| Secret name | Value source | Used for |
|---|---|---|
| `ACR_LOGIN_SERVER` | e.g. `myregistry.azurecr.io` | Image tag registry |
| `ACR_USERNAME` | ACR admin username or service principal username | Docker login |
| `ACR_PASSWORD` | ACR password | Docker login |
| `AZURE_CLIENT_ID` | service principal `appId` | Azure login |
| `AZURE_TENANT_ID` | service principal `tenant` | Azure login |
| `AZURE_SUBSCRIPTION_ID` | subscription id | Azure login |
| `AZURE_CLIENT_SECRET` | service principal `password` | Azure login |
| `AZURE_RESOURCE_GROUP` | target Azure Resource Group name | Container App update target |

## 3) Workflow values you must set
In [.github/workflows/app-containers.yml](.github/workflows/app-containers.yml):
- Ensure `AZURE_RESOURCE_GROUP` secret exists and points to the correct resource group.
- Confirm Container App names match Azure:
	- backend app name: `backend`
	- frontend app name: `frontend`

If your app names differ, update `az containerapp update --name ...` accordingly.

## 4) First deployment run
1. Push changes to `main`, or run manually via `Actions -> App Containers -> Run workflow`.
2. Confirm these stages pass:
	 - ACR login
	 - backend image build/push
	 - frontend image build/push
	 - Azure login
	 - container app updates
3. In Azure, verify latest revision in both apps.

## 5) Troubleshooting map (fast)
- `unauthorized: authentication required` during image push:
	- Check `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`.
- `azure/login` failure:
	- Check `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_SECRET`.
- `Resource group not found`:
	- Check `AZURE_RESOURCE_GROUP` secret value.
- `Container app not found`:
	- Check `--name backend` and `--name frontend` values.

## Minimal runtime layout
- frontend container: serves SPA
- backend container: serves `/api/*`
- optional reverse-proxy path routing in front of both apps

## Runtime environment variables
Recommended minimum:
- `PORT` for backend
- `CACHE_FILE` for cache persistence path
- Entra/MSAL variables for frontend auth integration
- Optional bot provider variables for backend chat:
	- `BOT_PROVIDER` (`affiliateplus` or `gemini`)
	- `GEMINI_API_KEY` (if using Gemini)
	- `GEMINI_MODEL` (optional override)

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
