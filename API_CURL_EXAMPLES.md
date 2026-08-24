# Backend Curl Examples (base: http://localhost:3000)

Note: for tenant-scoped endpoints include header `X-Tenant-Id: <tenant-uuid>`.

## Health

```bash
curl -i http://localhost:3000/health
```

## Tenants

Create tenant

```bash
curl -i -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","slug":"acme","metadata":{"plan":"pro"}}'
```

List tenants

```bash
curl -i http://localhost:3000/api/tenants
```

Get tenant by id

```bash
curl -i http://localhost:3000/api/tenants/<tenant-id>
```

## Locations (tenant-scoped)

Create location

```bash
curl -i -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"name":"Mumbai Office","code":"BOM","timezone":"Asia/Kolkata","metadata":{"address":"..."}}'
```

List locations

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/api/locations?limit=20&offset=0"
```

Get location by id

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/locations/<location-id>
```

## Concepts (tenant-scoped)

Create concept

```bash
curl -i -X POST http://localhost:3000/api/concepts \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"name":"Premium Cleaning","code":"PC-1","description":"Full office cleaning","metadata":{"category":"cleaning"}}'
```

List concepts (optional location filter)

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/api/concepts?limit=50&offset=0"
```

Get concept by id

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/concepts/<concept-id>
```

Link concept to location

```bash
curl -i -X POST http://localhost:3000/api/concepts/<conceptId>/locations/<locationId> \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Add pricing to concept

```bash
curl -i -X POST http://localhost:3000/api/concepts/<concept-id>/pricing \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"base_price":1500.0,"min_quantity":1,"unit":"hour","location_multiplier":1.2}'
```

## Leads (tenant-scoped)

Create lead

```bash
curl -i -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"location_id":"<location-id>","status":"draft","metadata":{"customer_name":"John Doe"}}'
```

List leads

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/api/leads?limit=50&offset=0"
```

Get lead by id

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/leads/<lead-id>
```

## Quotations (tenant-scoped)

Generate quotation

```bash
curl -i -X POST http://localhost:3000/api/quotations \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"lead_requirement_id":"<lead-req-id>","concept_id":"<concept-id>","quantity":2,"quotation_template_metadata_id":"<template-id>"}'
```

Get quotation by id

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/quotations/<quotation-id>
```

List quotations by lead

```bash
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/quotations/lead/<lead-id>
```

## Pricing (potential endpoints)

Calculate price (if route wired)

```bash
curl -i -X POST http://localhost:3000/api/pricing/calculate \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"concept_id":"<concept-id>","location_id":"<location-id>","quantity":3,"lead_requirement_id":"<lead-req-id>"}'
```

Create pricing rule (if route wired)

```bash
curl -i -X POST http://localhost:3000/api/pricing/rules \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"name":"Weekend surcharge","rule_type":"multiplier","parameters":{"multiplier":1.1},"evaluation_order":10,"is_active":true}'
```

## Quotation Templates (placeholder)

```bash
## Quotation Templates (tenant-scoped)

# Create template
curl -i -X POST http://localhost:3000/api/quotation-templates \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: <tenant-id>" \
  -d '{"name":"Default Template","template_key":"default","structure":{"sections":[]},"is_default":false}'

# List templates
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/quotation-templates

# Get template by id
curl -i -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/api/quotation-templates/<template-id>

# Set default template
curl -i -X POST http://localhost:3000/api/quotation-templates/<template-id>/default \
  -H "X-Tenant-Id: <tenant-id>"
```
