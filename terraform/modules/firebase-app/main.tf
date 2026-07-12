data "google_project" "this" {
  project_id = var.project_id
}

# Habilita Firebase sobre el proyecto GCP existente.
resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id
}

# Registra la app web (equivalente a "Project Settings > Your apps > Web").
resource "google_firebase_web_app" "default" {
  provider     = google-beta
  project      = var.project_id
  display_name = var.app_display_name

  depends_on = [google_firebase_project.default]
}

# Config pública del SDK (apiKey, authDomain, etc.).
data "google_firebase_web_app_config" "default" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.default.app_id
}

# Firestore, modo nativo. "(default)" es la única base de datos permitida
# por proyecto en el modo nativo clásico. La crea Terraform — nunca la
# consola — para que nunca haya dos fuentes de verdad para las reglas.
resource "google_firestore_database" "default" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_firebase_project.default]
}

# Reglas de seguridad — una sola fuente de verdad compartida entre todos
# los ambientes que usen este módulo (ver var.firestore_rules_file).
resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file(var.firestore_rules_file)
    }
  }

  depends_on = [google_firestore_database.default]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = "projects/${var.project_id}/rulesets/${google_firebaserules_ruleset.firestore.name}"

  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.firestore]
  }
}

# Sitio de Hosting. El *contenido* (dist/) no se sube por Terraform — lo
# hace `firebase deploy` en el workflow de deploy de cada ambiente.
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.project_id

  depends_on = [google_firebase_project.default]
}
