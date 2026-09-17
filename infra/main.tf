# App-layer infrastructure (ADR-006). Runs as the scoped deploy role, never
# root. STEP 1: ECR + App Runner, no database.
provider "aws" {
  region = var.region
  assume_role {
    role_arn = var.deploy_role_arn
  }
  default_tags {
    tags = {
      project    = "keel"
      managed_by = "terraform"
    }
  }
}
