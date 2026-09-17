variable "region" {
  type    = string
  default = "us-east-1"
}

variable "deploy_role_arn" {
  type    = string
  default = "arn:aws:iam::925513250944:role/keel-deploy-role"
}

variable "apprunner_ecr_role_arn" {
  type    = string
  default = "arn:aws:iam::925513250944:role/keel-apprunner-ecr-access"
}

variable "apprunner_instance_role_arn" {
  type    = string
  default = "arn:aws:iam::925513250944:role/keel-apprunner-instance"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

# STEP 1 placeholders (no database yet). Provided via gitignored terraform.tfvars.
# STEP 2 moves database_url and session_secret into SSM Parameter Store.
variable "database_url" {
  type    = string
  default = "postgres://placeholder:placeholder@localhost:5432/keel"
}

variable "app_base_url" {
  type    = string
  default = "http://localhost:3000"
}

variable "session_secret" {
  type      = string
  sensitive = true
}
