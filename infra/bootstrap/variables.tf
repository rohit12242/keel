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
  description = "owner/repo (path form) — kept for documentation/reference."
}

variable "github_oidc_sub_prefix" {
  type = string
  # This account emits the immutable subject form (owner/repo numeric IDs). The
  # trailing :* covers any ref/environment. If GitHub is ever switched back to
  # the path-form subject claim, set this to "repo:${var.github_repo}:*".
  default     = "repo:rohit12242@21074263/keel@1370088699:*"
  description = "StringLike pattern the GitHub OIDC token 'sub' must match to assume the deploy role."
}

variable "local_deployer_user" {
  type        = string
  default     = "keel-deploy"
  description = "The IAM user allowed to assume the deploy role for local Terraform runs."
}
