# Sign-in (ADR-002): a Cognito user pool and one public app client. Keel's own
# screens collect the password and the browser proves it to Cognito with SRP;
# Keel never sees it, and exchanges the ID token for its own session.

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

  # Cognito has one code template, used to confirm a new account and to reset
  # a password, so the one email gives both expiries (I-04). Still sent from
  # Cognito's own address.
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Keel code"
    email_message        = <<-EOT
      Your Keel code is {####}

      Enter it on Keel to confirm your email, within 24 hours, or to reset your password, within an hour.

      If you didn't ask for a code, you can ignore this email.
    EOT
  }

  # Deleting the pool deletes every account in it, and with them the only
  # way back into each Keel record.
  deletion_protection = "ACTIVE"
}

# Keel's own screens (ADR-002, revised in I-04). A public client: the browser
# proves the password with SRP through Amplify Auth and exchanges the ID token
# for Keel's session, so there is no secret to hold and no OAuth redirect.
# Cognito's hosted pages are gone with the domain they lived on (I-04).
resource "aws_cognito_user_pool_client" "web" {
  name         = "keel-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = false
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  # Sign-in and reset never say whether an address has an account.
  prevent_user_existence_errors = "ENABLED"

  # The browser drops every token as soon as the exchange answers and revokes
  # the refresh token, so each lives as briefly as Cognito allows: tokens 5
  # minutes, and the refresh token 60, which must be the longer.
  enable_token_revocation = true
  id_token_validity       = 5
  access_token_validity   = 5
  refresh_token_validity  = 60
  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "minutes"
  }

  # The name is given on Create account and read from the ID token (G30).
  read_attributes  = ["email", "email_verified", "name"]
  write_attributes = ["email", "name"]
}
