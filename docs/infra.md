# Infrastructure Details

## Status first
- `infra/modules/container-apps` now provisions a basic but working Azure Container Apps baseline.
- The `networking` and `monitoring` modules are still placeholders, so infra is not fully production-complete from Terraform alone.
- The app deployment workflow can still build and push images safely once Azure credentials and variable values are configured.

## Recommended order: start from the security subscription
Keep this order simple:
1. Create or choose a separate security-oriented subscription or management scope.
2. Create the guardrails there first: budget alerts, kill switch logic, locks, monitoring ownership.
3. Create the application subscription and app resource group after that.
4. Create Terraform state storage.
5. Create ACR and Container Apps environment.
6. Configure GitHub OIDC.
7. Deploy images.
8. Run infra workflow manually only after the above is understood and verified.

## Deployment model (current)
- GitHub Actions builds container images from backend and frontend.
- Images are pushed to Azure Container Registry (ACR).
- Workflow updates Azure Container Apps (`backend`, `frontend`) to latest images.

## What gets built
- Azure Container Registry (ACR) stores backend and frontend images.
- Azure Container Apps runs the frontend and backend workloads.
- Log Analytics workspace is attached to the Container Apps environment.
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

## Simple Azure bootstrap guide

### Step 0: create the security subscription / management layer
Goal:
- Keep emergency controls outside the normal app deploy path.

What to create:
- A dedicated Azure subscription for security controls if possible.
- If a separate subscription is not available, create at least a clearly separated resource group and ownership model for security resources.

What belongs there:
- Budget alerts
- Monitoring ownership
- Kill switch automation / runbooks
- Read-only / containment procedures

Minimum outcome before app deploy:
- Someone knows who can trigger containment.
- Cost alerts have an owner.
- There is a documented stop procedure.

### Step 1: create the app subscription resources
In the application subscription create:
- One resource group for the app platform
- One resource group or storage account for Terraform state
- One Azure Container Registry
- One Container Apps environment
- Backend and frontend Container Apps

### Step 2: create Terraform state backend
Create these Azure resources for remote state:
- Resource group: for example `rg-nordic-tfstate`
- Storage account: globally unique name, for example `nordictfstate001`
- Blob container: for example `tfstate`

These are later mapped to GitHub secrets:
- `TFSTATE_RG`
- `TFSTATE_STORAGE`
- `TFSTATE_CONTAINER`

### Step 3: create Azure Container Apps platform
At minimum create:
- Container Apps environment
- Container App `backend`
- Container App `frontend`
- Log Analytics workspace
- Ingress for frontend
- Ingress for backend if frontend calls it directly from browser
- ACR pull permissions for the apps

Recommended first sizing for hobby use:
- Backend: 0.25-0.5 vCPU, 0.5-1.0 Gi memory
- Frontend: 0.25 vCPU, 0.5 Gi memory
- Min replicas: 0 or 1 depending on whether cold starts are acceptable
- Max replicas: start low, for example 1-2

Memory note:
- Backend cache now prunes expired entries on reads and disk saves, and operators can inspect current cache/process memory from the admin endpoint.
- Keep memory limits small at first and monitor restart count plus memory working set.
- The current Terraform defaults set backend memory to `1Gi` and frontend memory to `0.5Gi`.

Practical operator workflow:
1. Open the frontend as an admin user.
2. Navigate to the Admin Memory tab.
3. Check RSS, heap usage and cache entry count.
4. If memory climbs unexpectedly, compare the admin view against Container Apps restart count and memory metrics.
5. Reduce cache TTLs or container memory only after you have observed the pattern, not before.

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

Do not store these in the repo:
- Any `.env` file with real values
- `GEMINI_API_KEY`
- ACR passwords
- Token dumps or copied JWTs
- Terraform state snapshots

Repo safety note:
- `.gitignore` already excludes `.env` files.
- Keep using GitHub Actions secrets or Azure-managed secret stores for runtime values.

Frontend build-time variables to set outside git:
- `VITE_AZURE_TENANT_ID`
- `VITE_AZURE_CLIENT_ID`

Backend runtime variables to set outside git:
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `BOT_PROVIDER`
- `GEMINI_API_KEY` if Gemini is used
- `GEMINI_MODEL` optional
- `CACHE_FILE` optional
- `PORT` optional if container target port differs from default

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
- `infra/modules/container-apps/main.tf` now creates the resource group, Log Analytics workspace, ACR, Container Apps environment, and `backend` / `frontend` apps.
- Safe approach today: use Terraform for the baseline platform, then let the app workflow update images.

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
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- Entra/MSAL variables for frontend auth integration
- Optional bot provider variables for backend chat:
	- `BOT_PROVIDER` (`affiliateplus` or `gemini`)
	- `GEMINI_API_KEY` (if using Gemini)
	- `GEMINI_MODEL` (optional override)

Role note:
- All normal API calls require `AppUser`.
- `GET /api/admin/memory` additionally requires `Admin`.

Why this split exists:
- `AppUser` is the baseline application role for all authenticated traffic.
- `Admin` is reserved for operational visibility so regular users do not see runtime internals.
- This keeps the authorization model simple and easy to explain in Entra ID app role configuration.

Recommended security posture for runtime config:
- Put sensitive values in Azure-managed secrets or GitHub Actions secrets, not source control.
- Treat frontend `VITE_` variables as public configuration, not secrets.
- Only backend-only values may be treated as secrets.

## Minimal secure deployment checklist
Before calling the app safely deployable, confirm these are true:
1. Repo contains no real `.env` secrets, key files, or exported tokens.
2. GitHub Actions uses OIDC and no long-lived Azure client secret.
3. Backend API requires Entra token and `AppUser` role.
4. Frontend sends bearer token only to `/api/*`.
5. ACR credentials exist only in GitHub or Azure secret storage.
6. Budget alerts and kill switch owner are defined.
7. Container CPU and memory limits are set conservatively.
8. Monitoring alerts exist for CPU, memory, restart count, and 5xx spikes.

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

## Short answer: is the repo safe to deploy?
Yes, with normal small-project caution:
- I do not see real secrets embedded in the repo snapshot.
- Auth now exists on the backend path.
- `.env` files are ignored.
- The remaining risk is operational, not a clear secret leak in git: incomplete Terraform runtime definition, missing Azure-side setup, and making sure secrets stay in Actions/Azure rather than files.
