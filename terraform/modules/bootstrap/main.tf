data "google_project" "this" {
  project_id = var.project_id
}

# --- APIs necesarias (se habilitan una sola vez, con tus credenciales) ---
# Nota: habilitar Storage/IAM/STS a nivel de "Google Cloud" (no Firebase)
# puede pedirte vincular una cuenta de facturación al proyecto, por
# política actual de Google — el USO real de estos recursos (bucket de
# state pequeño, Workload Identity) se queda en $0, pero si la consola te
# pide agregar una tarjeta, confírmalo tú mismo antes de continuar.
resource "google_project_service" "apis" {
  for_each = toset([
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "firebasehosting.googleapis.com",
    "firebaserules.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "storage.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# --- Bucket de state para el módulo firebase-app de este ambiente ---
resource "google_storage_bucket" "tfstate" {
  name                        = "${var.project_id}-tfstate"
  project                     = var.project_id
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 10
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.apis]
}

# --- Identidad para GitHub Actions (sin llaves de larga duración) ---
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions (${var.env_name})"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions OIDC (${var.env_name})"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Restringe el trust a este repo Y a esta rama específica — la identidad
  # de dev no puede impersonarse desde un push a main, y viceversa. Aísla
  # el blast radius entre ambientes aunque compartan el mismo repo.
  attribute_condition = "assertion.repository == '${var.github_owner}/${var.github_repo}' && assertion.ref == '${var.branch_ref}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions-ci"
  display_name = "GitHub Actions CI/CD (${var.env_name})"
}

resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repo}"
}

# --- Permisos mínimos de la service account de CI ---
resource "google_project_iam_member" "ci_firebase_admin" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "ci_datastore_owner" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Acceso de lectura/escritura solo al bucket de state (no project-wide).
resource "google_storage_bucket_iam_member" "ci_state_access" {
  bucket = google_storage_bucket.tfstate.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.github_actions.email}"
}
