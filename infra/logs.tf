resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/keel"
  retention_in_days = 7
}
