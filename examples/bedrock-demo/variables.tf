variable "aws_region" {
  description = "AWS region for the Bedrock demo."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix used in demo resources."
  type        = string
  default     = "governix"
}

variable "environment" {
  description = "Environment label used in demo resources."
  type        = string
  default     = "demo"
}

variable "embedding_model_id" {
  description = "Bedrock embedding model ID used by the knowledge base."
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "allow_opensearch_public_access" {
  description = "Whether to expose the OpenSearch Serverless endpoint publicly for this demo."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to demo resources."
  type        = map(string)
  default     = {}
}
