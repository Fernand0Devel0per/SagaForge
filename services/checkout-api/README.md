# Checkout API (SagaForge) — Documentation

This API is the **checkout-api** service inside the **SagaForge** lab.

What we implemented so far focuses on **validate the input payload for `POST /checkout`** to avoid “garbage in the pipeline” and reduce failures in downstream services.

---

## Table of contents

- [Overview](#overview)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [Endpoints](#endpoints)
- [Checkout validation (CHK-003)](#checkout-validation-chk-003)
- [Standard error format (CHK-005)](#standard-error-format-chk-005)
- [Request examples](#request-examples)
- [Tests](#tests)
- [Design decisions](#design-decisions)

---

## Overview

The service exposes:

- Health endpoints (`/health/live` and `/health/ready`)
- Current main endpoint:
  - `POST /checkout` — accepts an order, validates input, and returns `202` when the payload is valid

Validation is implemented with **Zod**, using **strict** mode. Validation errors are returned using a standardized envelope with a `details[]` entry per invalid field.

---

## Run locally

Go to the service directory:

```bash
cd services/checkout-api
```

Install dependencies:

```bash
pnpm install
```

Start in dev mode:

```bash
pnpm dev
```

Or build + start:

```bash
pnpm build
pnpm start
```

By default the service runs at `http://localhost:3000`.

---

## Environment variables

The service uses `dotenv` via `import 'dotenv/config'`, so a `.env` file in the service directory is loaded automatically.

Create `services/checkout-api/.env`:

```env
ENV=local
SERVICE_NAME=checkout-api
PORT=3000

CHECKOUT_MAX_ITEMS=50
CHECKOUT_MAX_TOTAL_AMOUNT=1000000
CHECKOUT_TOTAL_AMOUNT_TOLERANCE=0.01
```

### Meaning

- `ENV`: environment name (e.g., `local`, `test`, `stg`, `prd`)
- `SERVICE_NAME`: service name
- `PORT`: HTTP port
- `CHECKOUT_MAX_ITEMS`: max number of checkout items (anti-abuse)
- `CHECKOUT_MAX_TOTAL_AMOUNT`: max allowed total amount (anti-abuse)
- `CHECKOUT_TOTAL_AMOUNT_TOLERANCE`: tolerance when comparing `totalAmount` to the computed sum (e.g. `0.01` = 1 cent)

> Note: all variables have code defaults, but `.env` makes them explicit and easy to tune.

---

## Endpoints

### `GET /health/live`

Simple process liveness.

**200 response**

```json
{ "status": "ok" }
```

### `GET /health/ready`

Readiness plus service info.

**200 response**

```json
{
  "status": "ok",
  "service": "checkout-api",
  "env": "local"
}
```

### `POST /checkout`

Validates the input payload and, if valid, returns `202` with an `orderId` and `correlationId`.

**202 response (valid payload)**

```json
{
  "orderId": "<uuid>",
  "status": "PENDING",
  "correlationId": "<uuid>"
}
```

---

## Checkout validation

Goal: ensure `POST /checkout` accepts **only well-formed orders** with minimum consistency rules.

### Structural rules

- `customerId`: required (non-empty string)
- `currency`: required (enum)
  - currently supported: `BRL`, `USD`
- `items`: required
  - min `1`
  - max `CHECKOUT_MAX_ITEMS` (default `50`)
- For each item:
  - `sellerId`: required
  - `productId`: required
  - `quantity`: integer `>= 1`
  - `unitPrice`: `> 0`
- `payment.method`: required (`CARD` or `PIX`)
- If `payment.method = CARD`:
  - `payment.card.token` is required

### Consistency rules

- `computedTotal = sum(unitPrice * quantity)`
- If `totalAmount` is provided:
  - it must match `computedTotal` within `CHECKOUT_TOTAL_AMOUNT_TOLERANCE` (e.g. `0.01`)
- Anti-abuse limits:
  - `computedTotal` must not exceed `CHECKOUT_MAX_TOTAL_AMOUNT`
  - if `totalAmount` is provided, it must also not exceed `CHECKOUT_MAX_TOTAL_AMOUNT`

### Strict mode

Objects are validated with `.strict()`. Unknown fields are rejected.

---

## Standard error format

When the payload is invalid, the service returns **HTTP 400** using the following envelope:

**400 response**

```json
{
  "error": {
    "code": "CHECKOUT_VALIDATION_FAILED",
    "message": "Invalid payload.",
    "details": [
      { "field": "items[0].quantity", "reason": "must be >= 1" }
    ],
    "traceId": null,
    "correlationId": "<uuid>"
  }
}
```

### No sensitive data leakage

- We do not echo payload values in `details`.
- We do not log the full request body.
- Card token must **never** appear in errors/logs.

---

## Request examples

### Valid example (PIX)

```http
POST /checkout
Content-Type: application/json
X-Correlation-Id: 7b6d4b7d-2b2e-4f9a-9c6d-6b2c0d2c8c9a

{
  "customerId": "cust_1",
  "currency": "BRL",
  "items": [
    { "sellerId": "seller_1", "productId": "prod_1", "quantity": 2, "unitPrice": 49.90 }
  ],
  "payment": { "method": "PIX" }
}
```

### Invalid example (missing items)

```json
{
  "customerId": "cust_1",
  "currency": "BRL",
  "payment": { "method": "PIX" }
}
```

Expected: `400 CHECKOUT_VALIDATION_FAILED` with `details` pointing to `items`.

### Invalid example (quantity = 0)

```json
{
  "customerId": "cust_1",
  "currency": "BRL",
  "items": [
    { "sellerId": "seller_1", "productId": "prod_1", "quantity": 0, "unitPrice": 10 }
  ],
  "payment": { "method": "PIX" }
}
```

### Invalid example (CARD without token)

```json
{
  "customerId": "cust_1",
  "currency": "BRL",
  "items": [
    { "sellerId": "seller_1", "productId": "prod_1", "quantity": 1, "unitPrice": 10 }
  ],
  "payment": { "method": "CARD" }
}
```

---

## Tests

Tests cover the validation checklist:

- payload missing items → 400
- quantity=0 → 400
- unitPrice<=0 → 400
- items > 50 → 400
- valid payload → passes

Run tests:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

---

## Design decisions

- **Zod + strict**: validate contract and reject unknown fields to prevent “garbage in the pipeline”.
- **`correlationId`**: if `X-Correlation-Id` is missing, the service generates a UUID and returns it in both header and error body.
- **No sensitive data**: errors explain **what** is wrong (field/reason) without echoing the payload.

