variable "region" {
  type    = string
  default = "us-east-1"
}

variable "deploy_role_arn" {
  type    = string
  default = "arn:aws:iam::925513250944:role/keel-deploy-role"
}

variable "ecs_execution_role_arn" {
  type    = string
  default = "arn:aws:iam::925513250944:role/keel-ecs-execution"
}

variable "ecs_task_role_arn" {
  type    = string
  default = "arn:aws:iam::925513250944:role/keel-ecs-task"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "migrate_image_tag" {
  type    = string
  default = "migrate"
}

# Used by the Today page's internal fetch to /day; localhost works inside the
# container. Public URL is the ALB.
variable "app_base_url" {
  type    = string
  default = "http://localhost:3000"
}
