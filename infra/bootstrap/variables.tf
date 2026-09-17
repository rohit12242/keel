variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for Keel."
}

variable "alert_email" {
  type        = string
  description = "Email address for budget alerts. Set in terraform.tfvars (gitignored) so it is not committed to the public repo."
}

variable "github_repo" {
  type        = string
  default     = "rohit12242/keel"
  description = "owner/repo allowed to assume the deploy role via GitHub OIDC."
}

variable "local_deployer_user" {
  type        = string
  default     = "keel-deploy"
  description = "The IAM user allowed to assume the deploy role for local Terraform runs."
}
