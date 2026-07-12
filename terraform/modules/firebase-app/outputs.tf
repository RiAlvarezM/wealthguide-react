output "firebase_web_app_config" {
  description = "Valores para .env / GitHub Secrets (VITE_FIREBASE_*)."
  value = {
    api_key             = data.google_firebase_web_app_config.default.api_key
    auth_domain         = data.google_firebase_web_app_config.default.auth_domain
    project_id          = var.project_id
    storage_bucket      = data.google_firebase_web_app_config.default.storage_bucket
    messaging_sender_id = data.google_firebase_web_app_config.default.messaging_sender_id
    app_id              = google_firebase_web_app.default.app_id
  }
  sensitive = true
}

output "hosting_site_id" {
  value = google_firebase_hosting_site.default.site_id
}
