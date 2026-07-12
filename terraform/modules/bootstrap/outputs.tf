output "state_bucket" {
  description = "Bucket de Cloud Storage para el state del módulo firebase-app de este ambiente."
  value       = google_storage_bucket.tfstate.name
}

output "workload_identity_provider" {
  description = "Valor para el input `workload_identity_provider` de google-github-actions/auth."
  value       = "projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.github.workload_identity_pool_provider_id}"
}

output "service_account_email" {
  description = "Valor para el input `service_account` de google-github-actions/auth."
  value       = google_service_account.github_actions.email
}
