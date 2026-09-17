# VPC with two public subnets across two AZs (the ALB requires >= 2 AZs).
# No NAT gateway: the Fargate task runs in a public subnet with a public IP
# and reaches ECR/etc. through the internet gateway (ADR-006).
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "keel" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "keel" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "keel-public-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "keel-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# STEP 1 is HTTP-only via the ALB: CloudFront (the intended HTTPS front) is
# blocked on this account until AWS verifies it, so the ALB is opened to the
# internet on :80. When the account is verified, restore CloudFront and lock
# this ingress back to the CloudFront origin-facing prefix list.
resource "aws_security_group" "alb" {
  name = "keel-alb"
  # NOTE: the resource-level description is immutable — changing it forces SG
  # replacement, which fails with a DependencyViolation while the ALB is
  # attached. Kept as-is so STEP 1 opens ingress IN PLACE. Revisit when
  # CloudFront/HTTPS is restored.
  description = "ALB ingress from CloudFront only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from the internet (STEP 1: no CloudFront yet)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "keel-alb" }
}

resource "aws_security_group" "task" {
  name        = "keel-task"
  description = "Fargate task: ingress from ALB only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "app port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "keel-task" }
}
