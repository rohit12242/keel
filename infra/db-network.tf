# Private subnets for RDS: no route to the internet gateway, so the database
# is never internet-reachable. The Fargate task reaches it over the VPC's
# local route (no NAT gateway, ADR-006).
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "keel-private-${count.index + 1}" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  # local route only; no 0.0.0.0/0.
  tags = { Name = "keel-private" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_db_subnet_group" "main" {
  name       = "keel"
  subnet_ids = aws_subnet.private[*].id
}

# RDS accepts connections only from the Fargate task security group.
resource "aws_security_group" "rds" {
  name        = "keel-rds"
  description = "RDS ingress from the ECS task only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from the task"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.task.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "keel-rds" }
}
