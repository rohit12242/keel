# URL-safe (alphanumeric) so it slots into DATABASE_URL without escaping.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "session" {
  length  = 48
  special = false
}

resource "aws_db_instance" "main" {
  identifier     = "keel"
  engine         = "postgres"
  engine_version = "18.6"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "keel"
  username = "keeladmin"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  # Free Plan caps backup retention below 7 days; 1 keeps automated backups on.
  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true
}
