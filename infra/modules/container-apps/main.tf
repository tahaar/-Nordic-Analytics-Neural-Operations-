variable "location" {
	description = "Azure region for container app resources"
	type        = string
}

variable "resource_group_name" {
	description = "Resource group name for container apps"
	type        = string
}

variable "container_registry_name" {
	description = "Azure Container Registry name"
	type        = string
}

variable "container_apps_environment_name" {
	description = "Container Apps environment name"
	type        = string
}

variable "backend_image" {
	description = "Backend container image"
	type        = string
}

variable "frontend_image" {
	description = "Frontend container image"
	type        = string
}

variable "backend_env" {
	description = "Backend non-secret environment variables"
	type        = map(string)
	default     = {}
}

variable "frontend_env" {
	description = "Frontend non-secret environment variables"
	type        = map(string)
	default     = {}
}

resource "azurerm_resource_group" "this" {
	name     = var.resource_group_name
	location = var.location
}

resource "azurerm_log_analytics_workspace" "this" {
	name                = "law-${var.resource_group_name}"
	location            = azurerm_resource_group.this.location
	resource_group_name = azurerm_resource_group.this.name
	sku                 = "PerGB2018"
	retention_in_days   = 30
}

resource "azurerm_container_registry" "this" {
	name                = var.container_registry_name
	location            = azurerm_resource_group.this.location
	resource_group_name = azurerm_resource_group.this.name
	sku                 = "Basic"
	admin_enabled       = true
}

resource "azurerm_container_app_environment" "this" {
	name                       = var.container_apps_environment_name
	location                   = azurerm_resource_group.this.location
	resource_group_name        = azurerm_resource_group.this.name
	log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
}

locals {
	backend_env_list = [for key, value in var.backend_env : {
		name  = key
		value = value
	}]

	frontend_env_list = [for key, value in var.frontend_env : {
		name  = key
		value = value
	}]
}

resource "azurerm_container_app" "backend" {
	name                         = "backend"
	container_app_environment_id = azurerm_container_app_environment.this.id
	resource_group_name          = azurerm_resource_group.this.name
	revision_mode                = "Single"

	registry {
		server               = azurerm_container_registry.this.login_server
		username             = azurerm_container_registry.this.admin_username
		password_secret_name = "acr-password"
	}

	secret {
		name  = "acr-password"
		value = azurerm_container_registry.this.admin_password
	}

	template {
		min_replicas = 0
		max_replicas = 2

		container {
			name   = "backend"
			image  = var.backend_image
			cpu    = 0.5
			memory = "1Gi"

			dynamic "env" {
				for_each = local.backend_env_list
				content {
					name  = env.value.name
					value = env.value.value
				}
			}
		}
	}

	ingress {
		external_enabled = true
		target_port      = 3001
		transport        = "auto"

		traffic_weight {
			latest_revision = true
			percentage      = 100
		}
	}
}

resource "azurerm_container_app" "frontend" {
	name                         = "frontend"
	container_app_environment_id = azurerm_container_app_environment.this.id
	resource_group_name          = azurerm_resource_group.this.name
	revision_mode                = "Single"

	registry {
		server               = azurerm_container_registry.this.login_server
		username             = azurerm_container_registry.this.admin_username
		password_secret_name = "acr-password"
	}

	secret {
		name  = "acr-password"
		value = azurerm_container_registry.this.admin_password
	}

	template {
		min_replicas = 0
		max_replicas = 2

		container {
			name   = "frontend"
			image  = var.frontend_image
			cpu    = 0.25
			memory = "0.5Gi"

			dynamic "env" {
				for_each = local.frontend_env_list
				content {
					name  = env.value.name
					value = env.value.value
				}
			}
		}
	}

	ingress {
		external_enabled = true
		target_port      = 80
		transport        = "auto"

		traffic_weight {
			latest_revision = true
			percentage      = 100
		}
	}
}

output "resource_group_name" {
	value = azurerm_resource_group.this.name
}

output "container_registry_login_server" {
	value = azurerm_container_registry.this.login_server
}

output "backend_fqdn" {
	value = azurerm_container_app.backend.latest_revision_fqdn
}

output "frontend_fqdn" {
	value = azurerm_container_app.frontend.latest_revision_fqdn
}
