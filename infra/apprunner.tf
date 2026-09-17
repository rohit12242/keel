resource "aws_apprunner_service" "app" {
  service_name = "keel"

  source_configuration {
    auto_deployments_enabled = false
    authentication_configuration {
      access_role_arn = var.apprunner_ecr_role_arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          DATABASE_URL   = var.database_url
          APP_BASE_URL   = var.app_base_url
          LOG_LEVEL      = "info"
          SEED_DATA      = "false"
          SESSION_SECRET = var.session_secret
        }
      }
    }
  }

  instance_configuration {
    cpu               = "256"  # 0.25 vCPU (smallest)
    memory            = "512"  # 0.5 GB (smallest)
    instance_role_arn = var.apprunner_instance_role_arn
  }

  # STEP 1: no database, so /health returns 503. A TCP check keeps the service
  # healthy on "port is listening". STEP 2 switches this to HTTP /health.
  health_check_configuration {
    protocol            = "TCP"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  network_configuration {
    ingress_configuration {
      is_publicly_accessible = true
    }
  }
}
