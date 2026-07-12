module "bootstrap" {
  source = "../../../modules/bootstrap"

  project_id   = var.project_id
  region       = var.region
  env_name     = "dev"
  github_owner = var.github_owner
  github_repo  = var.github_repo
  branch_ref   = "refs/heads/develop"
}

output "state_bucket" {
  value = module.bootstrap.state_bucket
}

output "workload_identity_provider" {
  value = module.bootstrap.workload_identity_provider
}

output "service_account_email" {
  value = module.bootstrap.service_account_email
}
