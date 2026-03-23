terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "YOUR_RG"
    storage_account_name = "YOUR_STORAGE"
    container_name       = "tfstate"
    key                  = "infra.tfstate"
  }
}

provider "azurerm" {
  features {}
}

module "container_apps" {
  source = "./modules/container-apps"
}

module "networking" {
  source = "./modules/networking"
}

module "monitoring" {
  source = "./modules/monitoring"
}
