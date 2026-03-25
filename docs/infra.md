# Infrastructure Details

## Verified from code and Terraform
- Application platform resources are provisioned from Terraform in `infra/`.
- Current Terraform creates the application resource group, Azure Container Registry, Log Analytics workspace, Container Apps environment, and the `backend` and `frontend` Container Apps.
- App images are built and deployed by GitHub Actions from `.github/workflows/app-containers.yml` on `production` branch pushes.
- Infra baseline is applied manually from `.github/workflows/infra-terraform.yml` using `workflow_dispatch`.
- Security controls live in the separate `security-infra/` stack and are intended to be run manually with Terraform against Azure.
- `infra/modules/networking` and `infra/modules/monitoring` are still placeholders, so Terraform does not yet cover a fully production-complete platform.

## Branch model note
- Current GitHub Actions deployment filters target the `production` branch.
- If the repository's day-to-day default branch is `main`, that does not automatically trigger app deployment.
- Automatic deployment happens only after changes land on `production`, unless the workflow branch filters are changed.

## Operating model
1. Create and protect the security layer first.
2. Create the GitHub deployment identity and connect it to Azure with OIDC.
3. Run `security-infra/` manually with Terraform.
4. Run the infra baseline manually from GitHub Actions.
5. Push application changes to `production` to trigger image build and deployment.

## What Terraform currently provisions

### Application stack from `infra/`
- Resource group
- Azure Container Registry (ACR)
- Log Analytics workspace
- Azure Container Apps environment
- Container App `backend`
- Container App `frontend`

### Security stack from `security-infra/`
- Subscription/app resource organization modules
- Kill switch module
- Cost and security guardrail modules

## Recommended Azure layout

### Security layer
Recommended:
- A separate security-oriented subscription if possible.

Fallback:
- A dedicated security resource group and clearly separate ownership model.

This layer should contain:
- Budget alerts
- Cost guardrails
- Kill switch procedures
- Monitoring ownership
- Containment runbooks

### Application layer
Application subscription should contain:
- App resource group
- Terraform state backend resources if you keep them in the same subscription
- ACR
- Container Apps environment
- Backend and frontend Container Apps

## Step-by-step runbook

### Step 0: Prepare the security layer first
Do this before exposing the application publicly.

Minimum outcome:
1. Someone owns containment actions.
2. Budget alerts have an owner.
3. A kill switch process exists.
4. The security Terraform stack can be run manually.

### Step 1: Create the GitHub deployment identity
This repo uses Azure OIDC login from GitHub Actions.

Create:
1. An Entra app registration.
2. A service principal for that app.
3. Azure role assignments at the correct scope.
4. A federated credential for this GitHub repository.

Where to create it:
- Entra admin center -> App registrations
- Entra admin center -> Enterprise applications
- Azure Portal -> target scope -> Access control (IAM)

Azure CLI example:

```bash
az ad app create --display-name gh-nordic-analytics-deploy
az ad sp create --id <APP_CLIENT_ID>
```

Bootstrap shortcut if needed:

```bash
az ad sp create-for-rbac \
	--name gh-nordic-analytics-deploy \
	--role Contributor \
	--scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

Collect these values for GitHub:
- Application client ID -> `AZURE_CLIENT_ID`
- Tenant ID -> `AZURE_TENANT_ID`
- Subscription ID -> `AZURE_SUBSCRIPTION_ID`

Note:
- OIDC means `AZURE_CLIENT_SECRET` is not required.

### Step 2: Add GitHub OIDC federated credential
Without this, the workflows cannot log in to Azure.

Where:
1. Entra admin center -> App registrations -> `gh-nordic-analytics-deploy`
2. Open `Federated credentials`
3. Add `GitHub Actions deploying Azure resources`

Use these values:
- Repository: `tahaar/-Nordic-Analytics-Neural-Operations-`
- Branch subject: `production`

Why `production`:
- The app deployment workflow triggers on pushes to `production`.

### Step 3: Assign Azure roles at the right scope
Based on the current workflows and Terraform, the deployment identity needs access to:
- The application resource group
- Terraform state backend scope
- ACR-related operations used by workflow steps

Practical starting point:
1. `Contributor` on the application resource group
2. Additional access on the Terraform state storage scope if that storage is elsewhere

Keep scope narrow:
- Prefer resource group scope over subscription scope
- Grant separate tfstate access only where needed

### Step 4: Enable PIM for time-limited access
If you want deployment access to be valid only for a limited window, use Privileged Identity Management.

Recommended model for this repo:
1. Manual `security-infra/` actions are done by a human operator with PIM-activated access.
2. GitHub workflow identity is tightly scoped for app deployment.
3. If your governance model supports it, the workflow path may also be put behind eligible access.

Where to configure PIM:
- Azure Portal -> Entra ID -> Privileged Identity Management
- Azure Portal -> target Azure resource scope -> role settings / eligible assignments

What to do:
1. Make the required deployment role eligible instead of permanently active where supported.
2. Require MFA, justification, and short activation duration.
3. Activate the role before manual security Terraform runs.
4. If your model supports eligible non-human identity governance, activate that assignment before triggering protected workflows.

Manual activation flow:
1. Open Azure Portal -> Entra ID -> Privileged Identity Management.
2. Open `My roles`.
3. Find the required role on the target scope.
4. Click `Activate`.
5. Enter justification and duration.
6. Complete MFA or approval if required.
7. Confirm the role is Active before continuing.

### Step 5: Create Terraform state backend
Create remote state resources in Azure.

Minimum resources:
- Resource group, for example `rg-nordic-tfstate`
- Storage account, for example `nordictfstate001`
- Blob container, for example `tfstate`

These map to GitHub secrets:
- `TFSTATE_RG`
- `TFSTATE_STORAGE`
- `TFSTATE_CONTAINER`

### Step 6: Store required GitHub Actions secrets
Go to:
- GitHub repository -> Settings -> Secrets and variables -> Actions

Create these secrets:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `ACR_LOGIN_SERVER`
- `ACR_USERNAME`
- `ACR_PASSWORD`
- `TFSTATE_RG`
- `TFSTATE_STORAGE`
- `TFSTATE_CONTAINER`

Do not store in git:
- Real `.env` files
- ACR passwords
- Azure access tokens
- API keys
- Terraform state snapshots

### Step 7: Run security Terraform manually
This stack is intentionally not run from pipeline.

Development example:

```bash
cd security-infra
terraform init
terraform plan -var-file=envs/dev/main.tfvars
terraform apply -var-file=envs/dev/main.tfvars
```

Production example:

```bash
cd security-infra
terraform init
terraform plan -var-file=envs/prod/main.tfvars
terraform apply -var-file=envs/prod/main.tfvars
```

### Step 8: Run app platform infra baseline from GitHub Actions
The infra workflow is manual.

Workflow:
- `.github/workflows/infra-terraform.yml`

How to run:
1. Open GitHub -> Actions -> `Infra Terraform`.
2. Click `Run workflow`.
3. Set `terraform_action=apply`.
4. Enter `backend_image_tag` and `frontend_image_tag` that already exist in ACR.

Destroy flow:
1. Set `terraform_action=destroy`.
2. Set `confirm_destroy=DESTROY`.

What the workflow does:
- Logs in to Azure with OIDC
- Validates image tags exist in ACR before apply
- Runs `terraform init`
- Runs `terraform plan`
- Runs `terraform apply` or `terraform destroy`

### Step 9: Trigger the real application build and deployment
The app deployment workflow is automatic on `production` push.

Important:
- Pushing to `main` does not trigger this workflow with the current configuration.
- Merge, push, or release into `production` if you want the deployment to run as currently coded.

Workflow:
- `.github/workflows/app-containers.yml`

It triggers on changes to:
- `packages/frontend/**`
- `packages/backend/**`
- `Dockerfile.frontend`
- `Dockerfile.backend`
- `.github/workflows/app-containers.yml`

What it does:
1. Logs in to ACR
2. Builds backend image
3. Pushes backend image as `betting-backend:latest`
4. Builds frontend image
5. Pushes frontend image as `betting-frontend:latest`
6. Logs in to Azure with OIDC
7. Updates Container App `backend`
8. Updates Container App `frontend`

How to trigger it:
1. Merge or push a qualifying change to `production`.
2. Open GitHub -> Actions -> `App Containers`.
3. Verify the workflow completed successfully.

### Step 10: Open the application in browser
The browser URL is the frontend Container App ingress FQDN.

Get it with Azure CLI:

```bash
az containerapp show \
	--name frontend \
	--resource-group <AZURE_RESOURCE_GROUP> \
	--query properties.configuration.ingress.fqdn \
	-o tsv
```

Open:

```bash
https://<frontend-fqdn>
```

Optional backend check:

```bash
az containerapp show \
	--name backend \
	--resource-group <AZURE_RESOURCE_GROUP> \
	--query properties.configuration.ingress.fqdn \
	-o tsv
```

## Runtime notes

### Container sizing defaults in current Terraform
- Backend: `0.5` CPU, `1Gi` memory
- Frontend: `0.25` CPU, `0.5Gi` memory
- Both apps: `min_replicas = 0`, `max_replicas = 2`

### Memory operations note
- Backend cache prunes expired entries on reads and disk saves.
- Admin users can inspect runtime memory through the admin endpoint/UI.

Practical operator workflow:
1. Open the frontend as an admin user.
2. Go to the Admin Memory view.
3. Compare memory values with Container Apps restart and memory metrics.

## Minimal secure deployment checklist
1. No real secrets are committed to git.
2. GitHub Actions uses OIDC, not a long-lived Azure client secret.
3. Security guardrails exist before public rollout.
4. `security-infra/` is run manually.
5. GitHub deployment identity is narrowly scoped.
6. PIM is enabled for manual privileged operations.
7. Required GitHub secrets are configured.
8. Frontend URL is validated after deployment.

## Troubleshooting
- `azure/login` fails:
	Check `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and federated credential setup.
- ACR push fails:
	Check `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`.
- Terraform backend init fails:
	Check `TFSTATE_RG`, `TFSTATE_STORAGE`, `TFSTATE_CONTAINER` and Azure permissions to that storage.
- `Resource group not found`:
	Check `AZURE_RESOURCE_GROUP`.
- `Container app not found`:
	Check that the app names are exactly `backend` and `frontend`.

## Operating model (simple and safe)
1. Security controls first, manually with Terraform from `security-infra/`.
2. App platform baseline from `infra/` (manual infra workflow).
3. Application build/deploy from app pipeline on `production` push.
4. Sensitive Azure role activation uses PIM and is time-limited.

## Step-by-step: what to do manually

### Step 1: Activate Azure role with PIM before running protected actions
Use Entra Privileged Identity Management so elevated access is valid only for a limited window.

Recommended identity model for this repo:
- Create one Entra application / service principal for GitHub Actions OIDC login.
- Grant it standing access only if you explicitly accept always-available deployment rights.
- Prefer eligible role assignment through PIM when your tenant and licensing model supports it.

What must exist first:
1. An Entra application registration for GitHub deployments.
2. A service principal for that application in the tenant.
3. A federated credential on that application so GitHub Actions can exchange its OIDC token for Azure access.
4. Azure role assignments at the correct scope.
5. PIM enabled for the subscription, resource group, or group-based role path you use for deployment.

Where this is configured:
- Entra admin center -> App registrations: create the app registration.
- Entra admin center -> Enterprise applications: verify the service principal exists.
- Entra admin center -> App registrations -> your app -> Federated credentials: add GitHub OIDC trust.
- Azure Portal -> target subscription or resource group -> Access control (IAM): create the role assignment.
- Entra ID / Azure resources -> Privileged Identity Management: make the deployment role eligible and activate it when needed.

1. Open Azure Portal -> Entra ID -> Privileged Identity Management.
2. Go to `My roles` and find the role used for deployment (for example Contributor on target scope).
3. Click `Activate`, provide justification and duration.
4. Complete MFA/approval if required by policy.
5. Confirm role is Active before running Terraform/app deployment actions.

Notes:
- Keep activation duration as short as practical.
- If the workflow identity is controlled by group-based eligible roles, activate the required group/role before triggering GitHub workflows.

### Step 1a: Create the GitHub deployment identity
Create an Entra app registration and service principal for this repository.

Azure CLI example:

```bash
az ad app create --display-name gh-nordic-analytics-deploy
az ad sp create --id <APP_CLIENT_ID>
```

Collect these values:
- Application (client) ID -> `AZURE_CLIENT_ID`
- Directory (tenant) ID -> `AZURE_TENANT_ID`
- Subscription ID -> `AZURE_SUBSCRIPTION_ID`

If you want a simpler single command and accept immediate role assignment while bootstrapping, you can also use:

```bash
az ad sp create-for-rbac \
	--name gh-nordic-analytics-deploy \
	--role Contributor \
	--scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

Use this only as bootstrap if needed. After bootstrap, prefer tightening permissions and making access eligible through PIM.

### Step 1b: Add GitHub OIDC federated credential
This repo uses `azure/login@v2` with OIDC, so GitHub must be trusted as a federated identity provider on the Entra application.

Where to add it:
1. Entra admin center -> App registrations -> `gh-nordic-analytics-deploy`.
2. Open `Federated credentials`.
3. Add credential type `GitHub Actions deploying Azure resources`.
4. Select repository `tahaar/-Nordic-Analytics-Neural-Operations-`.
5. Restrict subject to the branch used by deployments.

Recommended subject for current workflows:
- `production` branch, because app deployment triggers from `production` push.

Why this matters:
- Without federated credential setup, the workflow cannot exchange GitHub's OIDC token for Azure access.
- This repo does not require `AZURE_CLIENT_SECRET` when OIDC is configured correctly.

### Step 1c: Assign Azure roles at the correct scope
Based on current code, GitHub workflows need access to:
- Read/write the application resource group containing Container Apps.
- Read ACR tags during infra validation.
- Update Container Apps during app deployment.
- Access Terraform backend storage during infra workflow.

Practical minimum starting point:
1. `Contributor` on the application resource group.
2. Additional rights on the Terraform state storage scope if backend storage is outside that resource group.
3. ACR access sufficient for tag validation and image operations used by the workflow path.

Keep scope narrow:
- Prefer resource-group scope over whole subscription.
- If tfstate is in a separate resource group, grant only the needed storage scope there.

### Step 1d: Enable PIM for the deployment path
If you want the deployment identity to be time-limited instead of permanently active, make the role eligible through PIM.

Two practical models:
1. Human operator model:
- A human admin account has eligible access via PIM.
- The human activates the role and runs manual Azure/Terraform actions.
- This definitely works for the `security-infra/` manual flow.

2. Workflow identity model:
- The GitHub deployment service principal is placed behind a PIM-controlled assignment if your Entra/Azure setup supports that operating model.
- You activate the eligible assignment before triggering workflows.
- Use this only if your tenant governance supports non-human identity governance in the intended scope.

Conservative recommendation for this repo:
- Use PIM-mandated human access for `security-infra/` manual Terraform.
- Use a tightly scoped GitHub OIDC deployment principal for app resource group deployment.
- If your governance model allows it, also place that deployment path behind PIM-controlled eligibility.

What to configure in portal:
1. Azure Portal -> Privileged Identity Management.
2. Open the managed resource scope or role management view.
3. Locate the target role assignment.
4. Convert standing assignment to eligible assignment where supported.
5. Add activation rules: MFA, justification, maximum activation duration, optional approval.

### Step 1e: Map the identity to GitHub secrets
After identity creation, store these repository secrets in GitHub Actions:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

These are used directly by both:
- `.github/workflows/infra-terraform.yml`
- `.github/workflows/app-containers.yml`

### Step 2: Run security stack manually (no pipeline)
Run this from local terminal against Azure:

```bash
cd security-infra
terraform init
terraform plan -var-file=envs/dev/main.tfvars
terraform apply -var-file=envs/dev/main.tfvars
```

Production example:

```bash
cd security-infra
terraform init
terraform plan -var-file=envs/prod/main.tfvars
terraform apply -var-file=envs/prod/main.tfvars
```

This is intentionally manual to reduce accidental changes to guardrails.

### Step 3: Trigger app platform infra from GitHub Actions
Infra baseline is run manually from GitHub Actions:

1. GitHub -> Actions -> `Infra Terraform`.
2. Click `Run workflow`.
3. Set `terraform_action` to `apply` (or `destroy` only when needed).
4. Provide `backend_image_tag` and `frontend_image_tag` that already exist in ACR.
5. For destroy, set `confirm_destroy=DESTROY`.

Expected behavior from workflow code:
- Uses OIDC Azure login (`azure/login@v2`) with `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- Validates ACR tags exist before apply.
- Runs Terraform `init/plan/apply` or `destroy` in `infra/`.

### Step 4: Trigger real app build + deployment
App pipeline is automatic from `production` branch push and path filters.

It triggers when you push changes affecting:
- `packages/frontend/**`
- `packages/backend/**`
- `Dockerfile.frontend`
- `Dockerfile.backend`
- `.github/workflows/app-containers.yml`

How to launch build/deploy:
1. Merge or push commit to `production` branch with one of the paths above changed.
2. Open GitHub -> Actions -> `App Containers`.
3. Verify steps pass: ACR login -> backend image build/push -> frontend image build/push -> Azure login -> Container App updates.

### Step 5: Open the app in browser
Frontend URL comes from the `frontend` Container App ingress FQDN.

Get URL via Azure CLI:

```bash
az containerapp show \
	--name frontend \
	--resource-group <AZURE_RESOURCE_GROUP> \
	--query properties.configuration.ingress.fqdn \
	-o tsv
```

Open in browser:

```bash
https://<frontend-fqdn>
```

Optional: backend URL check

```bash
az containerapp show \
	--name backend \
	--resource-group <AZURE_RESOURCE_GROUP> \
	--query properties.configuration.ingress.fqdn \
	-o tsv
```

## Required GitHub secrets for pipelines
Minimum required for current workflows:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `ACR_LOGIN_SERVER`
- `ACR_USERNAME`
- `ACR_PASSWORD`
- `TFSTATE_RG`
- `TFSTATE_STORAGE`
- `TFSTATE_CONTAINER`

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
