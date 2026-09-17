output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "lock_table" {
  value = aws_dynamodb_table.lock.name
}

output "deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}

output "github_oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}

output "apprunner_ecr_role_arn" {
  value = aws_iam_role.apprunner_ecr.arn
}

output "apprunner_instance_role_arn" {
  value = aws_iam_role.apprunner_instance.arn
}

output "budget_name" {
  value = aws_budgets_budget.monthly.name
}
