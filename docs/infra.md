# Infrastructure Details

## Deployment model (current)
- GitHub Actions builds container images from backend and frontend.
- Images are pushed to Azure Container Registry (ACR).
- Workflow updates Azure Container Apps (`backend`, `frontend`) to latest images.

## What gets built
- Azure Container Registry (ACR) stores backend and frontend images.
- Azure Container Apps runs the frontend and backend workloads.
- Azure Monitor / Log Analytics collects platform telemetry and supports alerts.
- Terraform state is stored in Azure Storage.
- Security controls live in the separate `security-infra` stack and protect the app subscription.

## How pieces connect
1. Frontend and backend images are built and pushed to ACR.
2. Container Apps pull those images from ACR.
3. Terraform creates or updates the app platform resources.
4. Monitoring watches cost, health and runtime anomalies.
5. Security controls can contain incidents by using kill switch actions.

## Security subscription / security stack
- `infra/` is the application platform stack.
- `security-infra/` is the security and guardrail stack.
- Recommended model: keep security controls in a dedicated security-oriented subscription or clearly separated management scope when possible.
- That layer is responsible for kill switches, subscription-level controls, budget guardrails and related alerts.

Primary workflow:
- [.github/workflows/app-containers.yml](.github/workflows/app-containers.yml)

Branch gating:
- Infra workflow is manual-only (`workflow_dispatch`).
- App and quality workflows are gated to `production` branch.

## Quick start checklist
1. Create Azure service principal for GitHub Actions.
2. Configure OIDC federated credential for GitHub Actions on that principal.
3. Grant minimum required Azure roles to that principal.
4. Create required GitHub repository secrets.
5. Set resource group as GitHub secret (`AZURE_RESOURCE_GROUP`).
6. Run infra workflow manually from Actions with selected image tags and action (`apply` or `destroy`).
7. Verify Terraform result and platform state updates successfully.

## 1) Azure service principal (OIDC)
Create principal with Azure CLI:

```bash
az ad sp create-for-rbac \
	--name "gh-nordic-analytics-deploy" \
	--role Contributor \
	--scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

Save these outputs for GitHub secrets:
- `appId` -> `AZURE_CLIENT_ID`
- `tenant` -> `AZURE_TENANT_ID`
- Subscription ID -> `AZURE_SUBSCRIPTION_ID`

OIDC note:
- Workflows use OpenID Connect (`azure/login@v2`), so `AZURE_CLIENT_SECRET` is not required.
- Add a federated credential in Entra ID for this repository + `production` branch.

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
| `AZURE_RESOURCE_GROUP` | target Azure Resource Group name | Container App update target |
| `TFSTATE_RG` | Terraform state resource group name | Terraform init backend config |
| `TFSTATE_STORAGE` | Terraform state storage account | Terraform init backend config |
| `TFSTATE_CONTAINER` | Terraform state container (for example `tfstate`) | Terraform init backend config |

## 3) Workflow values you must set
In [.github/workflows/app-containers.yml](.github/workflows/app-containers.yml):
- Ensure `AZURE_RESOURCE_GROUP` secret exists and points to the correct resource group.
- Confirm Container App names match Azure:
	- backend app name: `backend`
	- frontend app name: `frontend`

If your app names differ, update `az containerapp update --name ...` accordingly.

## 4) First infra run (manual)
1. Open `Actions -> Infra Terraform -> Run workflow`.
2. Choose `terraform_action`:
	- `apply` = create/update infra
	- `destroy` = tear infra down
3. Enter `backend_image_tag` and `frontend_image_tag`.
3. Confirm these stages pass:
	- Azure login (OIDC)
	- image tag validation in ACR (apply only)
	- Terraform init/plan/apply or destroy

Note:
- Infra run validates that requested image tags already exist in ACR.
- Images can be from today or older (for example week-old tags), as long as tags are present in registry.
- Destroy does not require fresh images and skips image validation.

## 5) Troubleshooting map (fast)
- `unauthorized: authentication required` during image push:
	- Check `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`.
- `azure/login` failure:
	- Check `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` and Entra federated credential settings.
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

## Alert-to-kill-switch flow
- Alerts can be used as the trigger to start kill switch procedures.
- Example: if budget usage or restart storm exceeds threshold, operator reviews signal and executes kill switch flow.
- Kill switch can be used to scale workloads to zero and restrict mutation paths while investigation starts.
- For high-cost runaway scenarios, the expected operational response is:
	1. Alert fires
	2. Human confirms anomaly
	3. Kill switch is executed
	4. Root cause investigation begins

## Example alert policy idea
- Warning: 5xx rate > 2% for 10 minutes
- Critical: 5xx rate > 5% for 5 minutes
- Action: notify team channel + open incident issue

Budget anomaly example:
- 80% monthly budget reached too early -> warning
- 95% budget reached or abnormal cost slope detected -> critical
- Response option: execute kill switch if traffic/spend is clearly unintended

## Rough Azure cost estimate
Very rough hobby-scale estimate for always-on minimal deployment:
- Azure Container Apps (2 small apps): about 15-60 EUR/month depending on usage and scale settings
- Azure Container Registry Basic: about 5-7 EUR/month
- Log Analytics / monitoring: about 2-20 EUR/month depending on ingestion volume
- Storage for Terraform state: usually under 1-3 EUR/month

Expected light hobby total:
- roughly 25-90 EUR/month

Main cost risks:
- noisy logs
- over-aggressive scaling
- always-on higher CPU/memory profiles
- accidental public traffic spikes
