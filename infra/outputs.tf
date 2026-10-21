output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

# The public URL: HTTPS through CloudFront (ADR-006 R4).
output "app_url" {
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "service_name" {
  value = aws_ecs_service.app.name
}

output "rds_endpoint" {
  value = "${aws_db_instance.main.address}:${aws_db_instance.main.port}"
}

output "migrate_task_family" {
  value = aws_ecs_task_definition.migrate.family
}

output "ssm_parameters" {
  value = [
    aws_ssm_parameter.database_url.name,
    aws_ssm_parameter.session_secret.name,
    aws_ssm_parameter.cognito_domain.name,
    aws_ssm_parameter.cognito_pool_id.name,
    aws_ssm_parameter.cognito_client_id.name,
    aws_ssm_parameter.cognito_client_secret.name,
  ]
}

# The public client Keel's own screens use (I-04). Not secret: the browser
# needs it. Locally, COGNITO_CLIENT_ID takes this value.
output "cognito_web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

# Built from the domain, not read back from SSM: a parameter's value is
# marked sensitive, which an output may not show.
output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.region}.amazoncognito.com"
}
