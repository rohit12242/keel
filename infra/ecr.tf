resource "aws_ecr_repository" "app" {
  name                 = "keel"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # so `terraform destroy` can remove it with images

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep only the few most recent images to bound storage cost.
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}
