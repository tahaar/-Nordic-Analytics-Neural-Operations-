terraform {
  backend "azurerm" {
    resource_group_name  = "YOUR_RG"
    storage_account_name = "YOUR_STORAGE"
    container_name       = "tfstate"
    key                  = "infra.tfstate"
  }
}
