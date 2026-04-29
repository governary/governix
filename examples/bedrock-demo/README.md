# Bedrock Demo

This example provisions a small Amazon Bedrock RAG stack for Governix demos with Terraform.

It creates:

- an S3 bucket for source documents
- sample Governix documents uploaded under `documents/`
- an Amazon Bedrock Knowledge Base
- an S3 data source attached to that knowledge base
- an OpenSearch Serverless vector store managed by the official `aws-ia/bedrock/aws` Terraform module

This example follows the Governix MVP boundary:

- Governix remains the control plane
- your application still calls Bedrock directly
- your application still calls Governix before and after the Bedrock request

## Prerequisites

- Terraform `>= 1.6`
- AWS CLI v2
- AWS credentials with permission to create S3, Bedrock, IAM, CloudWatch Logs, and OpenSearch Serverless resources
- Amazon Bedrock enabled in the AWS region you choose

## Files

- `main.tf`: demo infrastructure
- `variables.tf`: inputs you may override
- `outputs.tf`: useful IDs and follow-up commands
- `terraform.tfvars.example`: starter variable values
- `documents/`: sample content uploaded into the Bedrock source bucket

## Configure

From the repository root:

```bash
cd examples/bedrock-demo
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` if you want a different AWS region, project prefix, or tags.

Important:

- choose a region where your embedding model and generation model are available
- this example defaults to `amazon.titan-embed-text-v2:0` for embeddings
- the example uses a public OpenSearch Serverless endpoint because it is meant for quick demos

## Deploy With Terraform

Initialize providers and modules:

```bash
terraform init
```

Review the plan:

```bash
terraform plan
```

Create the demo stack:

```bash
terraform apply
```

## Start The First Ingestion Job

Terraform creates the knowledge base and data source, but Bedrock still needs an ingestion job to index the uploaded documents.

You can copy the exact command from Terraform output:

```bash
terraform output -raw start_ingestion_job_command
```

Then run that command, or run it inline:

```bash
aws bedrock-agent start-ingestion-job \
  --region "$(terraform output -raw aws_region)" \
  --knowledge-base-id "$(terraform output -raw knowledge_base_id)" \
  --data-source-id "$(terraform output -raw data_source_id)"
```

## Test RetrieveAndGenerate

After the ingestion job completes, test the knowledge base with AWS CLI. Replace `REPLACE_WITH_YOUR_GENERATION_MODEL` with a generation model ARN available in your region.

Example:

```bash
aws bedrock-agent-runtime retrieve-and-generate \
  --region "$(terraform output -raw aws_region)" \
  --input '{"text":"What is Governix?"}' \
  --retrieve-and-generate-configuration "{
    \"type\":\"KNOWLEDGE_BASE\",
    \"knowledgeBaseConfiguration\":{
      \"knowledgeBaseId\":\"$(terraform output -raw knowledge_base_id)\",
      \"modelArn\":\"arn:aws:bedrock:$(terraform output -raw aws_region)::foundation-model/REPLACE_WITH_YOUR_GENERATION_MODEL\"
    }
  }"
```

Typical generation model examples are region-dependent. Common patterns include Anthropic Claude and Amazon Nova model ARNs. Use a model ARN that your AWS account can invoke in the selected region.

## Useful Terraform Outputs

```bash
terraform output documents_bucket_name
terraform output knowledge_base_id
terraform output data_source_id
terraform output retrieve_and_generate_example
```

## Destroy When Finished

Destroy the demo stack:

```bash
terraform destroy
```

Notes:

- the S3 bucket is created with `force_destroy = true`, so Terraform can remove uploaded demo files automatically
- if an ingestion job is still running, wait for it to finish before destroying the stack
