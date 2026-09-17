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
# App Runner roles (created here so the deploy role never needs iam:CreateRole
# — it only PassRoles these two specific ARNs).
# ---------------------------------------------------------------------------

# Access role: lets App Runner pull the image from ECR.
data "aws_iam_policy_document" "apprunner_ecr_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_ecr" {
  name               = "keel-apprunner-ecr-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_ecr_assume.json
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Instance role: the running app's identity — reads its config from SSM.
data "aws_iam_policy_document" "apprunner_instance_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_instance" {
  name               = "keel-apprunner-instance"
  assume_role_policy = data.aws_iam_policy_document.apprunner_instance_assume.json
}

data "aws_iam_policy_document" "apprunner_instance" {
  statement {
    sid       = "ReadKeelParameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/keel/*"]
  }
}

resource "aws_iam_role_policy" "apprunner_instance" {
  name   = "keel-instance-ssm-read"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.apprunner_instance.json
}

# ---------------------------------------------------------------------------
# The scoped deploy role — assumable by the local keel-deploy user and by
# GitHub Actions via OIDC. Scoped to the ADR-006 services, NOT admin.
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
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "keel-deploy-role"
  assume_role_policy   = data.aws_iam_policy_document.deploy_assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "deploy" {
  # The ADR-006 services.
  statement {
    sid    = "CoreServices"
    effect = "Allow"
    actions = [
      "apprunner:*",
      "ecr:*",
      "rds:*",
      "logs:*",
      "cloudwatch:*",
    ]
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

  # EC2 read + security-group/tag management for the VPC connector and RDS
  # networking. No NAT gateway is ever created (ADR-006).
  statement {
    sid    = "Ec2Networking"
    effect = "Allow"
    actions = [
      "ec2:Describe*",
      "ec2:CreateSecurityGroup",
      "ec2:DeleteSecurityGroup",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupEgress",
      "ec2:CreateTags",
      "ec2:DeleteTags",
    ]
    resources = ["*"]
  }

  # Pass ONLY the two App Runner roles created above.
  statement {
    sid       = "PassAppRunnerRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.apprunner_ecr.arn, aws_iam_role.apprunner_instance.arn]
  }

  # Service-linked roles App Runner / RDS create on first use.
  statement {
    sid       = "ServiceLinkedRoles"
    effect    = "Allow"
    actions   = ["iam:CreateServiceLinkedRole"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values   = ["apprunner.amazonaws.com", "rds.amazonaws.com"]
    }
  }

  # Read the App Runner roles (Terraform refresh of data sources / references).
  statement {
    sid       = "ReadAppRunnerRoles"
    effect    = "Allow"
    actions   = ["iam:GetRole", "iam:ListRolePolicies", "iam:GetRolePolicy", "iam:ListAttachedRolePolicies"]
    resources = [aws_iam_role.apprunner_ecr.arn, aws_iam_role.apprunner_instance.arn]
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
