# Sign-in (ADR-002): a Cognito user pool, its hosted login pages and one app
# client for the authorization code flow with PKCE. Keel never sees a
# password; it exchanges the code server-side and issues its own session.

data "aws_caller_identity" "current" {}

resource "aws_cognito_user_pool" "main" {
  name = "keel"

  # Sign in with an email address, which Cognito verifies before the account
  # can be used. Anyone may sign up: an account holds only its own record.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = false
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Deleting the pool deletes every account in it, and with them the only
  # way back into each Keel record.
  deletion_protection = "ACTIVE"
}

# The hosted login pages, on Cognito's own domain. The prefix must be unique
# across AWS, so it carries the account id.
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "keel-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "keel-app"
  user_pool_id = aws_cognito_user_pool.main.id

  # Confidential client: the code is exchanged by the server, never the
  # browser, so it can hold a secret. PKCE is added on top by the app.
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO"]
  # The deployed service's HTTPS address, and localhost for development.
  callback_urls = concat(
    ["https://${aws_cloudfront_distribution.app.domain_name}/v1/session/callback"],
    var.cognito_callback_urls,
  )
  logout_urls = concat(
    ["https://${aws_cloudfront_distribution.app.domain_name}/"],
    var.cognito_logout_urls,
  )

  # No username/password API flow: sign-in happens only on the hosted pages.
  explicit_auth_flows           = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
}
