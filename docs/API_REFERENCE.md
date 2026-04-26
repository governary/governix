# API Reference

This is the MVP route surface for Governix.

## Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`

## Tenants

- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/tenants/:tenantId`
- `PATCH /api/tenants/:tenantId`

## Applications

- `GET /api/tenants/:tenantId/applications`
- `POST /api/tenants/:tenantId/applications`
- `PATCH /api/applications/:applicationId`
- `POST /api/applications/:applicationId/rotate-key`

## Policies

- `GET /api/tenants/:tenantId/policies`
- `POST /api/tenants/:tenantId/policies`
- `PATCH /api/policies/:policyId`
- `POST /api/policies/:policyId/test`

## Quotas

- `GET /api/tenants/:tenantId/quotas`
- `PATCH /api/tenants/:tenantId/quotas`

## Usage and showback

- `GET /api/usage/summary`
- `GET /api/tenants/:tenantId/usage`
- `GET /api/showback/report`

## Ledger

- `GET /api/ledger`
- `GET /api/ledger/:requestId`
- `POST /api/ledger/export`
- `GET /api/ledger/exports/:exportId`
- `GET /api/ledger/exports/:exportId/download`

## Runtime

Runtime routes are authenticated by application API key, not console session cookies.

- `POST /api/runtime/policy/evaluate`
- `POST /api/runtime/events`

Required header:

```http
x-governix-api-key: govx_...
```

## Error shape

Management and runtime APIs use the same structured error envelope.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload.",
    "issues": {
      "formErrors": [],
      "fieldErrors": {
        "name": ["Tenant name is required."]
      }
    }
  }
}
```

Common codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INTERNAL_ERROR`

## Runtime evaluate response

```json
{
  "data": {
    "matchedPolicyIds": ["policy-id"],
    "finalAction": "allow",
    "finalModelId": "anthropic.claude-3-5-sonnet",
    "finalKbId": "kb-acme",
    "retrievalFilter": null,
    "reasons": ["Tenant policy matched."]
  }
}
```

Possible `finalAction` values:

- `allow`
- `deny`
- `force_filter`
- `downgrade_model`
- `quota_block`

## Runtime event accepted response

```json
{
  "message": "Runtime event accepted.",
  "data": {
    "accepted": true,
    "requestId": "req_123"
  }
}
```
