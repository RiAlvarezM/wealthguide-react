variable "project_id" {
  description = "ID del proyecto Firebase/GCP de producción."
  type        = string
  default     = "networth-algam"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "github_owner" {
  description = "Usuario u organización de GitHub."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repositorio en GitHub."
  type        = string
}
