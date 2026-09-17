terraform {
  backend "s3" {
    bucket         = "keel-tfstate-925513250944"
    key            = "bootstrap/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "keel-tflock"
    encrypt        = true
  }
}
