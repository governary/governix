# Local Development

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop or Docker Engine

## Boot sequence

1. Install packages.

```bash
npm install
```

2. Copy the local environment file.

```bash
cp .env.example .env
```

3. Start PostgreSQL.

```bash
docker compose up -d
```

4. Run migrations.

```bash
npm run db:migrate
```

5. Seed the demo data.

```bash
npm run db:seed
```

6. Start the app.

```bash
npm run dev
```

7. Open `http://127.0.0.1:3000/login`.

## Local credentials

- Admin email: `admin@acme.io`
- Admin password: `governix-admin`
- Seed runtime API key: `govx_demo_app_key`

## Database notes

- Governix uses PostgreSQL plus Drizzle ORM.
- Seed data creates three tenants, three applications, policies, quotas, and initial ledger records.
- Rerun `npm run db:seed` whenever you want a clean demo state.

## Running tests

Type checking:

```bash
npm run typecheck
```

Playwright regression suite:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Recommended clean run:

```bash
npm run db:seed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```
