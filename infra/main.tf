terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  description = "Azure region for application resources"
  type        = string
  default     = "northeurope"
}

variable "resource_group_name" {
  description = "Resource group for the app platform"
  type        = string
  default     = "rg-nordic-analytics"
}

variable "container_registry_name" {
  description = "Globally unique ACR name"
  type        = string
  default     = "nordicanalyticsacr"
}

variable "container_apps_environment_name" {
  description = "Azure Container Apps environment name"
  type        = string
  default     = "cae-nordic-analytics"
}

variable "backend_image" {
  description = "Backend image reference"
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "frontend_image" {
  description = "Frontend image reference"
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "backend_env" {
  description = "Non-secret backend environment variables"
  type        = map(string)
  default     = {}
}

variable "frontend_env" {
  description = "Non-secret frontend environment variables"
  type        = map(string)
  default     = {}
}

module "container_apps" {
  source = "./modules/container-apps"

  location                        = var.location
  resource_group_name             = var.resource_group_name
  container_registry_name         = var.container_registry_name
  container_apps_environment_name = var.container_apps_environment_name
  backend_image                   = var.backend_image
  frontend_image                  = var.frontend_image
  backend_env                     = var.backend_env
  frontend_env                    = var.frontend_env
}

module "networking" {
  source = "./modules/networking"
}

module "monitoring" {
  source = "./modules/monitoring"
}
