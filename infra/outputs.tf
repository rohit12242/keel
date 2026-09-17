output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

# STEP 1 public URL (HTTP-only until CloudFront/HTTPS is unblocked).
output "app_url" {
  value = "http://${aws_lb.main.dns_name}"
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
  value = [aws_ssm_parameter.database_url.name, aws_ssm_parameter.session_secret.name]
}
