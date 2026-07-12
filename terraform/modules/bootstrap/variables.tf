variable "project_id" {
  description = "ID del proyecto GCP/Firebase de este ambiente (ya debe existir)."
  type        = string
}

variable "region" {
  description = "Región por defecto para recursos regionales (el bucket de state)."
  type        = string
  default     = "us-central1"
}

variable "env_name" {
  description = "Nombre corto del ambiente, ej. \"dev\" o \"prod\" — solo para display names."
  type        = string
}

variable "github_owner" {
  description = "Usuario u organización de GitHub."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repositorio en GitHub."
  type        = string
}

variable "branch_ref" {
  description = "Ref de la rama que puede desplegar a este ambiente, ej. \"refs/heads/main\" o \"refs/heads/develop\". Restringe qué rama puede impersonar la service account de este ambiente."
  type        = string
}
