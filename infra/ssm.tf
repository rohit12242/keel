# Secrets in Parameter Store (SecureString, default aws/ssm KMS key). The ECS
# execution role reads these at task launch; the app never sees plaintext in
# the task definition.
resource "aws_ssm_parameter" "database_url" {
  name  = "/keel/DATABASE_URL"
  type  = "SecureString"
  # RDS enforces SSL (rds.force_ssl=1). sslmode=no-verify makes the pg client
  # encrypt the connection without CA verification. Traffic is intra-VPC to a
  # private RDS endpoint; verifying against the RDS CA bundle is a hardening
  # follow-up (needs the CA in the image).
  value = "postgres://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?sslmode=no-verify"
}

resource "aws_ssm_parameter" "session_secret" {
  name  = "/keel/SESSION_SECRET"
  type  = "SecureString"
  value = random_password.session.result
}
