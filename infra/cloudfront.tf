# CloudFront terminates TLS on a free *.cloudfront.net domain (AWS-managed
# cert), so no custom domain or ACM is needed. Origin is the ALB over HTTP.
# The app is dynamic (SSR), so caching is disabled and all viewer data is
# forwarded to the origin.
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "main" {
  enabled     = true
  comment     = "keel"
  price_class = "PriceClass_100"

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "keel-alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "keel-alb"
    viewer_protocol_policy    = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
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
