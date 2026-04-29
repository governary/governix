# Governix

Governix is the open-source, tenant-aware control, metering, and audit layer for Bedrock-powered AI.

It is a sidecar control plane for multi-tenant AI applications. Governix does not proxy Bedrock traffic. The integrating application calls Governix before a Bedrock request for policy/quota guidance, calls Bedrock directly, then emits runtime metadata back to Governix for usage, showback, and audit.

## MVP scope

- Tenant CRUD
- Application CRUD and runtime API key rotation
- Tenant-scoped policy CRUD and policy test flows
- Tenant quota management
- Runtime policy evaluation API
- Runtime event ingestion API
- Usage aggregation and showback export
- Request ledger UI and async CSV export
- Platform dashboard and alert-state visibility

Out of scope in MVP:

- Inline Bedrock proxy/gateway
- Multi-cloud routing
- Billing, invoices, or payment collection
- Application-scoped policy
- Prompt playgrounds or evaluation platforms

## Repository layout

- `apps/web`: Next.js admin console and all route handlers
- `packages/db`: Drizzle schema, migrations, seed data, repository helpers
- `packages/shared`: shared Zod schemas, types, constants
- `packages/policy-engine`: fixed-priority policy evaluation logic
- `packages/costing`: static model pricing and estimated-cost helpers
- `packages/runtime-sdk-ts`: TypeScript runtime SDK for integrators
- `docs`: PRD, technical spec, UI template, and operator docs
- `examples/runtime-sdk-ts`: minimal integration examples
- `examples/bedrock-demo`: Terraform-based Bedrock Knowledge Base RAG demo

## Quick start

1. Install dependencies.

```bash
npm install
```

2. Copy local environment variables.

```bash
cp .env.example .env
```

3. Start PostgreSQL.

```bash
docker compose up -d
```

4. Run migrations and seed the demo data.

```bash
npm run db:migrate
npm run db:seed
```

5. Start the app.

```bash
npm run dev
```

6. Open `http://127.0.0.1:3000/login`.

Seed admin credentials:

- Email: `admin@acme.io`
- Password: `governix-admin`

Seed runtime API key for the seeded active applications:

- API key: `govx_demo_app_key`

## Bedrock demo

This repo includes a Bedrock infrastructure example at [examples/bedrock-demo/README.md](examples/bedrock-demo/README.md).

It provisions a small Terraform-based RAG demo with:

- an S3 source bucket with sample documents
- a Bedrock Knowledge Base
- an S3 data source
- an OpenSearch Serverless vector store

Typical flow:

1. `cd examples/bedrock-demo`
2. `cp terraform.tfvars.example terraform.tfvars`
3. `terraform init`
4. `terraform apply`
5. start a Bedrock ingestion job
6. test with `aws bedrock-agent-runtime retrieve-and-generate`

See the full walkthrough in [examples/bedrock-demo/README.md](examples/bedrock-demo/README.md).

## Environment variables

Required variables are defined in `.env.example`.

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: JWT/session signing secret
- `APP_BASE_URL`: public base URL for the web app
- `OBJECT_STORAGE_BUCKET`: export bucket/container name
- `OBJECT_STORAGE_REGION`: object storage region
- `OBJECT_STORAGE_ACCESS_KEY`: object storage access key
- `OBJECT_STORAGE_SECRET_KEY`: object storage secret key
- `OBJECT_STORAGE_ENDPOINT`: S3-compatible endpoint
- `EXPORT_FILE_TTL_HOURS`: how long exported ledger files remain valid

## Common commands

```bash
npm run dev
npm run typecheck
npm run db:migrate
npm run db:seed
npm run test:e2e
```

## Runtime integration model

Governix is a control plane, not a gateway.

1. The application calls `POST /api/runtime/policy/evaluate`.
2. Governix returns `allow`, `deny`, `force_filter`, `downgrade_model`, or `quota_block`.
3. The application enforces that decision and calls Bedrock directly.
4. After the Bedrock call, the application sends `POST /api/runtime/events`.

Important boundary:

- `quota_block` and `downgrade_model` are advisory decisions from Governix. The integrating application must execute them.

See:

- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [examples/runtime-sdk-ts/minimal.ts](examples/runtime-sdk-ts/minimal.ts)
- [examples/runtime-sdk-ts/retrieve-and-generate.ts](examples/runtime-sdk-ts/retrieve-and-generate.ts)
- [examples/bedrock-demo/README.md](examples/bedrock-demo/README.md)

## Testing

Playwright is the default regression tool for MVP flows.

Covered paths include:

- Login and auth guard
- Tenant, application, policy, and quota admin flows
- Runtime policy evaluate and runtime event ingestion
- Usage aggregation and showback
- Ledger list/detail/export
- Dashboard KPI and alert-state visibility

To reset local state before running the suite:

```bash
npm run db:seed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

## Additional docs

- [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/RUNTIME_INTEGRATION.md](docs/RUNTIME_INTEGRATION.md)
- [examples/bedrock-demo/README.md](examples/bedrock-demo/README.md)
