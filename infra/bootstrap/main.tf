# Bootstrap: the resources that must exist before any billable infrastructure —
# a budget, a scoped deploy role, GitHub OIDC, and the Terraform state backend.
# Run ONCE as the root `keel` profile (only identity able to create IAM roles).
# Everything after this runs as the scoped deploy role, never root.

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project    = "keel"
      managed_by = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
