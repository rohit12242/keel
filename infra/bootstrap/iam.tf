data "aws_iam_user" "local_deployer" {
  user_name = var.local_deployer_user
}

# ---------------------------------------------------------------------------
# GitHub Actions OIDC provider (no long-lived keys — the deploy role is
# assumed via web identity from the repo's workflows).
# ---------------------------------------------------------------------------
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[length(data.tls_certificate.github.certificates) - 1].sha1_fingerprint]
}

# ---------------------------------------------------------------------------
# ECS roles (created here so the deploy role never needs iam:CreateRole — it
# only PassRoles these two ARNs). ECS Fargate needs a task EXECUTION role
# (pull image from ECR, write logs, read SSM secrets at launch) and a TASK
# role (the app's own runtime identity).
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "keel-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Let the execution role read Keel's SSM parameters at task launch (STEP 2
# injects DATABASE_URL / SESSION_SECRET as container `secrets`).
data "aws_iam_policy_document" "ecs_execution_ssm" {
  statement {
    sid       = "ReadKeelParameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/keel/*"]
  }
  statement {
    sid       = "DecryptSecureStrings"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name   = "keel-ecs-execution-ssm"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_ssm.json
}

resource "aws_iam_role" "ecs_task" {
  name               = "keel-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "ecs_task_ssm" {
  statement {
    sid       = "ReadKeelParameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/keel/*"]
  }
}

resource "aws_iam_role_policy" "ecs_task_ssm" {
  name   = "keel-ecs-task-ssm"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task_ssm.json
}

# ---------------------------------------------------------------------------
# The scoped deploy role — assumable by the local keel-deploy user and by
# GitHub Actions via OIDC. Scoped to the ADR-006 (rev 2) services, NOT admin.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "deploy_assume" {
  statement {
    sid     = "LocalDeployer"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_user.local_deployer.arn]
    }
  }
  statement {
    sid     = "GitHubOIDC"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Only the deploy workflow on the main branch may assume this role — not
    # arbitrary branches, PRs, tags, or (being a different repo) any fork.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "keel-deploy-role"
  assume_role_policy   = data.aws_iam_policy_document.deploy_assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "deploy" {
  # The ADR-006 (rev 2) services: ECS Fargate, ALB, CloudFront (TLS), ECR,
  # RDS, CloudWatch. Scoped to these services, not AdministratorAccess.
  statement {
    sid    = "CoreServices"
    effect = "Allow"
    actions = [
      "ecs:*",
      "ecr:*",
      "rds:*",
      "logs:*",
      "cloudwatch:*",
      "elasticloadbalancing:*",
      "cloudfront:*",
      "application-autoscaling:*",
    ]
    resources = ["*"]
  }

  # VPC / networking for the cluster, subnets, ALB and RDS. No NAT gateway is
  # ever created (ADR-006). ec2:* here is the networking service in use.
  statement {
    sid       = "Ec2Networking"
    effect    = "Allow"
    actions   = ["ec2:*"]
    resources = ["*"]
  }

  # SSM Parameter Store, scoped to Keel's namespace (+ account-level describe).
  statement {
    sid    = "SsmParameters"
    effect = "Allow"
    actions = [
      "ssm:PutParameter",
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
      "ssm:DeleteParameter",
      "ssm:DeleteParameters",
      "ssm:AddTagsToResource",
      "ssm:RemoveTagsFromResource",
      "ssm:ListTagsForResource",
      "ssm:LabelParameterVersion",
    ]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/keel/*"]
  }
  statement {
    sid       = "SsmDescribe"
    effect    = "Allow"
    actions   = ["ssm:DescribeParameters"]
    resources = ["*"]
  }

  # Pass ONLY the two ECS roles created above.
  statement {
    sid       = "PassEcsRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
  }

  # Service-linked roles ECS / ELB / RDS create on first use.
  statement {
    sid       = "ServiceLinkedRoles"
    effect    = "Allow"
    actions   = ["iam:CreateServiceLinkedRole"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values = [
        "ecs.amazonaws.com",
        "elasticloadbalancing.amazonaws.com",
        "rds.amazonaws.com",
      ]
    }
  }

  # Read the ECS roles (Terraform refresh / references).
  statement {
    sid       = "ReadEcsRoles"
    effect    = "Allow"
    actions   = ["iam:GetRole", "iam:ListRolePolicies", "iam:GetRolePolicy", "iam:ListAttachedRolePolicies"]
    resources = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
  }

  # Terraform state backend access.
  statement {
    sid       = "StateBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.state.arn]
  }
  statement {
    sid       = "StateObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.state.arn}/*"]
  }
  statement {
    sid       = "StateLock"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.lock.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "keel-deploy-policy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
