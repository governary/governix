output "aws_region" {
  description = "AWS region used for the demo."
  value       = var.aws_region
}

output "documents_bucket_name" {
  description = "S3 bucket that stores the demo documents."
  value       = aws_s3_bucket.documents.bucket
}

output "uploaded_document_keys" {
  description = "Object keys uploaded to the demo S3 bucket."
  value       = [for object in values(aws_s3_object.documents) : object.key]
}

output "knowledge_base_id" {
  description = "Bedrock Knowledge Base identifier."
  value       = module.bedrock.default_kb_identifier
}

output "data_source_id" {
  description = "Bedrock data source identifier."
  value       = module.bedrock.datasource_identifier
}

output "opensearch_collection_endpoint" {
  description = "OpenSearch Serverless collection endpoint created by the Bedrock module."
  value       = module.bedrock.default_collection.collection_endpoint
}

output "start_ingestion_job_command" {
  description = "AWS CLI command to start the first ingestion job after terraform apply."
  value       = "aws bedrock-agent start-ingestion-job --region ${var.aws_region} --knowledge-base-id ${module.bedrock.default_kb_identifier} --data-source-id ${module.bedrock.datasource_identifier}"
}

output "retrieve_and_generate_example" {
  description = "Example AWS CLI command for testing the provisioned knowledge base after ingestion completes."
  value = <<-EOT
aws bedrock-agent-runtime retrieve-and-generate \
  --region ${var.aws_region} \
  --input '{"text":"What is Governix?"}' \
  --retrieve-and-generate-configuration '{
    "type":"KNOWLEDGE_BASE",
    "knowledgeBaseConfiguration":{
      "knowledgeBaseId":"${module.bedrock.default_kb_identifier}",
      "modelArn":"arn:aws:bedrock:${var.aws_region}::foundation-model/REPLACE_WITH_YOUR_GENERATION_MODEL"
    }
  }'
EOT
}
