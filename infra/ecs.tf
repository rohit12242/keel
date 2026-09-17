resource "aws_ecs_cluster" "main" {
  name = "keel"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "keel"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "keel"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "DATABASE_URL", value = var.database_url },
        { name = "APP_BASE_URL", value = var.app_base_url },
        { name = "LOG_LEVEL", value = "info" },
        { name = "SEED_DATA", value = "false" },
        { name = "SESSION_SECRET", value = var.session_secret },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "keel"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "keel"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "keel"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 60
  wait_for_steady_state             = true

  depends_on = [aws_lb_listener.http]
}
