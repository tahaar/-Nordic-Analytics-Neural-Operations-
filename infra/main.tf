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
