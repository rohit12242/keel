# HTTPS without a domain (ADR-006): CloudFront terminates TLS on its default
# *.cloudfront.net certificate and forwards to the ALB.
#
# The CloudFront -> ALB leg is plain HTTP — the ALB has no certificate, because
# ACM will not issue one for a name we do not control. That leg runs to the
# ALB's public address, is not guaranteed to stay on AWS's network, and carries
# cookies, the Authorization header and entry text unencrypted. See ADR-006.

# Nothing is cached and every viewer header, cookie and query string reaches the
# app — the session cookie, the Authorization header and the OIDC callback
# depend on it. With caching disabled, AllViewer* policies forward Authorization.
# Host is forwarded too, so the app sees the public hostname, and
# CloudFront-Forwarded-Proto tells it the viewer used HTTPS (the ALB's own
# X-Forwarded-Proto will say "http", which is the leg it saw).
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerAndCloudFrontHeaders-2022-06"
}

# The ALB forwards only requests carrying this header; CloudFront adds it.
# The prefix list on the ALB's security group admits any CloudFront
# distribution, anyone's — the header is what makes it ours.
resource "random_password" "origin_verify" {
  length  = 48
  special = false
}

locals {
  origin_verify_header = "X-Origin-Verify"
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = "keel"
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  origin {
    origin_id   = "alb"
    domain_name = aws_lb.main.dns_name

    custom_header {
      name  = local.origin_verify_header
      value = random_password.origin_verify.result
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
