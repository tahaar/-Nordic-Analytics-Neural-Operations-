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

module "container_apps" {
  source = "./modules/container-apps"
}

module "networking" {
  source = "./modules/networking"
}

module "monitoring" {
  source = "./modules/monitoring"
}
