# The budget exists before anything billable does (ADR-006). Actual-spend
# alerts at $20 and $50 to the alert email.
resource "aws_budgets_budget" "monthly" {
  name         = "keel-monthly"
  budget_type  = "COST"
  limit_amount = "50"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 20
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Early warning: forecast to exceed $50 this month.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
