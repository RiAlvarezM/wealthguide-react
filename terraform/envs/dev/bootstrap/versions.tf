terraform {
  required_version = "= 1.9.8"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 5.43.0"
    }
  }

  # Bootstrap crea el bucket de state que usará envs/dev/app — no puede
  # depender de sí mismo, así que su propio state queda en tu máquina.
  # Guarda bootstrap.tfstate en un lugar seguro (o cifrado) — es la única
  # copia de qué recursos de identidad/CI existen para este ambiente.
  backend "local" {
    path = "bootstrap.tfstate"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
