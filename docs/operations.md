# Operations Guide

## Deployment operations

### Current operating model
1. `security-infra/` is run manually with Terraform.
2. App platform infra baseline is run manually from GitHub Actions.
3. Application build and deployment happens automatically from `production` branch pushes.

Branch note:
- Current workflows are bound to `production` for automatic deployment behavior.
- If your team releases from `main`, update the workflow branch filters or promote changes into `production`.

### Manual security deployment
Use a human operator account with the required Azure access, preferably activated through PIM for a limited time window.

Run security Terraform manually:

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

### Manual infra baseline deployment
GitHub workflow:
- `Infra Terraform`

Run it from GitHub Actions:
1. Open `Actions -> Infra Terraform`.
2. Click `Run workflow`.
3. Set `terraform_action=apply`.
4. Provide existing `backend_image_tag` and `frontend_image_tag` values from ACR.

Destroy requires explicit confirmation:
1. Set `terraform_action=destroy`.
2. Set `confirm_destroy=DESTROY`.

### Automatic app deployment
GitHub workflow:
- `App Containers`

This workflow runs automatically on `production` branch pushes when changes affect:
- `packages/frontend/**`
- `packages/backend/**`
- `Dockerfile.frontend`
- `Dockerfile.backend`
- `.github/workflows/app-containers.yml`

What it does:
1. Builds backend and frontend container images.
2. Pushes images to ACR.
3. Logs in to Azure with OIDC.
4. Updates the `backend` and `frontend` Container Apps.

### Browser URL after deployment
Read the frontend ingress FQDN from Azure:

```bash
az containerapp show \
	--name frontend \
	--resource-group <AZURE_RESOURCE_GROUP> \
	--query properties.configuration.ingress.fqdn \
	-o tsv
```

Open the app in browser at:

```bash
https://<frontend-fqdn>
```

### Reference runbook
For the full Azure identity, OIDC, PIM, secrets, and deployment sequence, see `docs/infra.md`.

## Local run

Backend:

```bash
cd packages/backend
npm install
npm run start
```

Frontend:

```bash
cd packages/frontend
npm install
npm run dev
```

## Quality checks
Frontend quality gate:

```bash
cd packages/frontend
npm run lint && npm run test && npm run build
```

Backend type check:

```bash
cd packages/backend
npm install
npm run typecheck
```

## Common troubleshooting
- Empty match list: source websites may have changed HTML patterns; fallback data may be returned.
- Forebet detail 404: ensure `matchKey` matches current combined row key.
- CI fails at build: run local build command and compare logs.
