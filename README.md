# SagaForge

> Hands-on study platform for **sagas** and **event-driven architecture**, using **Kafka** and a set of microservices in **multiple languages**.

SagaForge simulates a real-world **checkout** flow (create order → fraud check → inventory reservation → payment authorization → confirmation) with:
- **Idempotency** (Kafka *at-least-once*)
- **Orchestration via a State Machine**
- **Compensations**
- **Retries / DLQ**
- **Minimum required observability** (logs, metrics, tracing)
- **Governance** (schema versioning, HMAC signing, secrets)

---

## Why does it exist?

Because “saga” and “event-driven” only really click when you:
- see **redelivery**, **duplication**, and **ordering** happening for real
- implement **idempotency** (not just “an if statement”)
- measure **latency per step**, **retries**, **DLQ**, and debug with a **correlationId**
- learn Cassandra/Neo4j in a concrete context (ledger + graph-based fraud)

---

## Architecture overview

### Services (MVP)
- **checkout-api (Node.js/Express)**  
  HTTP: `POST /checkout`, `GET /orders/{orderId}`  
  Responsible for validation, idempotency, and publishing the initial event `CheckoutRequested`.

- **saga-orchestrator (C#)**  
  Consumes `CheckoutRequested`, maintains `SagaState`, emits commands, and applies compensations/timeouts/retries.  
  Publishes `SagaProgressUpdated` and final events (`OrderConfirmed` / `OrderCancelled`).

- **inventory-service (Go)**  
  Reserves/releases inventory idempotently and stays consistent under concurrency.

- **payment-service (Go)**  
  Fake acquirer: authorizes/declines/voids with a realistic risk simulator.  
  Also publishes **normalized** financial events (`FinancialEventRecorded`).

- **fraud-service (Python + Neo4j)**  
  Builds/updates a graph, calculates an explainable rules-based score, and returns a decision via Kafka.  
  Learns from feedback (`finance.events`) and updates negative signals.

- **ledger-writer (Cassandra)**  
  Consumes `finance.events` and writes the **immutable ledger** + query-driven tables (customer statements and seller stats).

- **statement-api / admin-api**  
  Queries statements and provides operational endpoints (full timeline, cancel order, reprocess step).

---

## Main flow (happy path)

1) `checkout-api` receives `POST /checkout`  
   - validates the payload  
   - applies idempotency via `(customerId + X-Idempotency-Key)`  
   - creates the `Order`  
   - publishes `CheckoutRequested`

2) `saga-orchestrator` starts the saga  
   - creates/updates `SagaState`  
   - publishes `FraudCheckRequested`

3) `fraud-service` replies with `FraudCheckPassed` (or Failed/Review)

4) `saga-orchestrator` → `InventoryReserveRequested`

5) `inventory-service` replies `InventoryReserved` (or Failed)

6) `saga-orchestrator` → `PaymentAuthorizeRequested`

7) `payment-service` replies `PaymentAuthorized` (or Failed) + publishes `FinancialEventRecorded`

8) `saga-orchestrator` confirms the order (`OrderConfirmRequested`) and finishes with `OrderConfirmed`

9) `ledger-writer` persists into Cassandra (ledger and views)

---

## Messaging conventions

### Standard envelope (JSON)
```json
{
  "eventId": "uuid",
  "eventType": "CheckoutRequested",
  "schemaVersion": 1,
  "occurredAt": "2026-01-03T21:10:01Z",
  "producer": "checkout-api",
  "correlationId": "uuid",
  "causationId": "uuid",
  "data": {}
}
```

### Key / ordering
- **Kafka key = `orderId`** for everything saga/checkout-related (ensures ordering per partition).

---

## Stack

- **Kafka** (events/commands; ordering by key)
- **MongoDB** (Orders, SagaState, Idempotency, Dedup stores)
- **Neo4j** (fraud graph)
- **Cassandra** (immutable ledger + query-oriented tables)
- **Prometheus** (metrics)
- **OpenTelemetry + Jaeger** (tracing)
- **Docker Compose** (local environment)

---

## Endpoints (MVP)

- `POST /checkout`
- `GET /orders/{orderId}`
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

---

## Observability

- **end-to-end correlationId** (HTTP → Kafka → logs)
- **structured JSON logs** (no sensitive data)
- `/metrics` on every service
- distributed tracing via OpenTelemetry (`traceparent` headers in Kafka)

---

## Security

- **HMAC-SHA256** signing in Kafka headers (integrity)
- per-environment secrets (env vars / local `.env`)
- protected admin endpoints (JWT/roles)

---

## Roadmap

1) Checkout API (validation + errors + idempotency)
2) Orchestrator (state machine + commands)
3) Inventory + Payment + Fraud
4) Cassandra ledger + statement + stats
5) Kafka hardening (retry topics, DLQ, safe replay, schema v2)
6) Observability + security + E2E tests + runbook
7) Admin/support
