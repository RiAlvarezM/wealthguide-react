variable "project_id" {
  description = "ID del proyecto GCP/Firebase de este ambiente."
  type        = string
}

variable "region" {
  description = "Región para Firestore/Hosting (elige la más cercana a los usuarios reales)."
  type        = string
  default     = "us-central1"
}

variable "app_display_name" {
  description = "Nombre visible de la app web dentro de Firebase."
  type        = string
}

variable "firestore_rules_file" {
  description = "Ruta al archivo .rules de Firestore a publicar (una sola fuente de verdad, compartida por todos los ambientes que usen este módulo)."
  type        = string
}
