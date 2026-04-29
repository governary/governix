terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }

    awscc = {
      source  = "hashicorp/awscc"
      version = ">= 1.0.0"
    }

    opensearch = {
      source  = "opensearch-project/opensearch"
      version = ">= 2.2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "awscc" {
  region = var.aws_region
}

provider "opensearch" {
  url         = module.bedrock.default_collection.collection_endpoint
  healthcheck = false
}
