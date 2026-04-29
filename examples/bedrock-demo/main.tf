locals {
  name_prefix   = "${var.project_name}-${var.environment}"
  document_dir  = "${path.module}/documents"
  document_keys = fileset(local.document_dir, "**")
  tags = merge({
    Project   = "Governix"
    Example   = "bedrock-demo"
    ManagedBy = "Terraform"
  }, var.tags)
}

resource "aws_s3_bucket" "documents" {
  bucket_prefix = "${local.name_prefix}-bedrock-docs-"
  force_destroy = true
  tags          = local.tags
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_object" "documents" {
  for_each = local.document_keys

  bucket = aws_s3_bucket.documents.id
  key    = "documents/${each.value}"
  source = "${local.document_dir}/${each.value}"
  etag   = filemd5("${local.document_dir}/${each.value}")
}

module "bedrock" {
  source  = "aws-ia/bedrock/aws"
  version = "0.0.33"

  create_agent                      = false
  create_default_kb                 = true
  create_s3_data_source             = true
  allow_opensearch_public_access    = var.allow_opensearch_public_access
  name_prefix                       = "${local.name_prefix}-"
  kb_name                           = "${local.name_prefix}-kb"
  kb_description                    = "Governix Bedrock RAG demo knowledge base"
  kb_embedding_model_arn            = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.embedding_model_id}"
  s3_data_source_bucket_name        = aws_s3_bucket.documents.bucket
  s3_inclusion_prefixes             = ["documents/"]
  data_source_description           = "Governix sample documents for Bedrock Knowledge Bases"
  create_kb_log_group               = true
  kb_log_group_retention_in_days    = 7
  kb_tags                           = local.tags

  depends_on = [aws_s3_object.documents]
}
