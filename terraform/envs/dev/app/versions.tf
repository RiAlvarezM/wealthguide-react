terraform {
  required_version = "= 1.9.8"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 5.43.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "= 5.43.0"
    }
  }

  # bucket/prefix se pasan en CI vía `terraform init -backend-config=...`
  # (ver .github/workflows/deploy-dev.yml y terraform-plan.yml) usando el
  # output `state_bucket` de envs/dev/bootstrap.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
