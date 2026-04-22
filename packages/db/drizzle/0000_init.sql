CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  external_key text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  api_key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS applications_tenant_name_environment_idx
  ON applications (tenant_id, name, environment);

CREATE TABLE IF NOT EXISTS tenant_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  allowed_kb_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_model_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  require_citation boolean NOT NULL DEFAULT false,
  fallback_model_id text,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id),
  request_limit_monthly integer,
  token_limit_monthly bigint,
  cost_limit_monthly numeric(14,4),
  soft_threshold_percent integer NOT NULL DEFAULT 80,
  hard_threshold_percent integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid NOT NULL REFERENCES applications(id),
  user_id text,
  session_id text,
  request_type text NOT NULL,
  raw_query_summary text,
  selected_model_id text,
  selected_kb_id text,
  policy_result_json jsonb NOT NULL,
  retrieval_filter_json jsonb,
  retrieved_chunks_json jsonb,
  generation_summary_text text,
  citations_present boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  embedding_count integer NOT NULL DEFAULT 0,
  estimated_cost numeric(14,6),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_ledger_tenant_created_at_idx
  ON request_ledger (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS request_ledger_application_created_at_idx
  ON request_ledger (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS request_ledger_status_created_at_idx
  ON request_ledger (status, created_at DESC);
CREATE INDEX IF NOT EXISTS request_ledger_model_created_at_idx
  ON request_ledger (selected_model_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid REFERENCES applications(id),
  usage_date date NOT NULL,
  rag_request_count integer NOT NULL DEFAULT 0,
  retrieve_count integer NOT NULL DEFAULT 0,
  generate_count integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  embedding_count bigint NOT NULL DEFAULT 0,
  estimated_cost numeric(14,6) NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  throttled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_daily_tenant_application_date_idx
  ON usage_daily (tenant_id, application_id, usage_date);

CREATE TABLE IF NOT EXISTS policy_evaluation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  matched_policy_ids_json jsonb NOT NULL,
  final_action text NOT NULL,
  final_model_id text,
  final_kb_id text,
  reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES users(id),
  export_type text NOT NULL,
  tenant_scope_json jsonb NOT NULL,
  date_from timestamptz NOT NULL,
  date_to timestamptz NOT NULL,
  format text NOT NULL,
  status text NOT NULL,
  file_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

