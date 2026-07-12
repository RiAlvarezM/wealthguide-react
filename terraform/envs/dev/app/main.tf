module "app" {
  source = "../../../modules/firebase-app"

  project_id           = var.project_id
  region               = var.region
  app_display_name     = var.app_display_name
  firestore_rules_file = "${path.module}/../../../firestore.rules"
}

output "firebase_web_app_config" {
  value     = module.app.firebase_web_app_config
  sensitive = true
}

output "hosting_site_id" {
  value = module.app.hosting_site_id
}
