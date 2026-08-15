# Blockchain Microservice — API Overview

> Status: **Draft — for reference**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
>
> - `docs/ai/blockchain-microservice/api-contract.md` — the full HTTP contract (this doc links to it)
> - `docs/ai/blockchain-integration.md` — broader internal integration spec (state machine, data model, payload hash)
> - `src/lib/server/db/schema.ts` (`signatures`, `documents`)

## Purpose

Pirma is a thin client over an external **blockchain microservice**. Pirma never runs a node or
writes to a chain directly. It:

1. Computes a deterministic `payloadHash` per document.
2. Submits it to the microservice for anchoring.
3. Learns the outcome via the **forward flow** (poll) and/or the **reverse flow** (webhook).
4. Stores the proof locally and flips `signatures.status` `signed → anchored`.
5. Exposes public verification.

On-chain data is **hashes only** — never document content, signature images, or PII.

## Architecture

```mermaid
flowchart LR
    subgraph Pirma[Pirma Application]
        P1[finalize action]
        P2[anchor client]
        P3[poll job]
        P4[webhook route]
        P5[verification UI]
        DB[(Postgres: signature_anchors / signatures / documents)]
    end

    subgraph Svc[Blockchain Microservice]
        S1[Anchor API]
        S2[Chain / node / batching]
    end

    P1 -->|"forward: POST /v1/anchor"| S1
    P2 -->|"forward: GET /v1/anchor/:id"| S1
    P2 -->|"forward: GET /v1/verify"| S1
    P3 -->|"forward (poll)"| S1
    S1 -->|"reverse: POST /api/blockchain/webhook"| P4
    P4 --> DB
    P2 --> DB
    P5 --> DB
```

## The two flows

### Forward flow — Pirma → microservice

Pirma drives anchoring and queries proof status:

| Direction | Method / Path                  | Purpose                                 |
| --------- | ------------------------------ | --------------------------------------- |
| →         | `POST /v1/anchor`              | Submit a `payloadHash` for anchoring    |
| →         | `POST /v1/anchor/batch`        | Batch-submit multiple hashes (optional) |
| →         | `GET /v1/anchor/:anchorId`     | Poll status of one anchor               |
| →         | `GET /v1/verify?payloadHash=…` | Public proof check (cross-check)        |
| →         | `GET /v1/health`               | Liveness/readiness probe                |

### Reverse flow — microservice → Pirma

The microservice pushes state changes back to Pirma via a webhook Pirma exposes:

| Direction | Method / Path                  | Purpose                                                                     |
| --------- | ------------------------------ | --------------------------------------------------------------------------- |
| ←         | `POST /api/blockchain/webhook` | Pirma's endpoint that receives anchor events                                |
| ←         | `GET /api/blockchain/health`   | (optional) lets the service check Pirma is alive before calling the webhook |

The reverse flow is **at-least-once, best-effort delivery**. Pirma treats it as an
optimization/notification layer; the **source of truth is always the forward `GET
/v1/anchor/:anchorId` poll**. Pirma's confirmation job reconciles either way, so missed or
duplicated webhooks are harmless.

```mermaid
sequenceDiagram
    participant App as Pirma
    participant Svc as Blockchain Microservice

    Note over App,Svc: Forward flow (submit + poll)
    App->>Svc: POST /v1/anchor { payloadHash }
    Svc-->>App: 200 { anchorId, status: "submitted" }
    loop until confirmed/failed
        App->>Svc: GET /v1/anchor/:anchorId
        Svc-->>App: 200 { status, txHash?, blockNumber? }
    end

    Note over App,Svc: Reverse flow (webhook)
    Svc->>App: POST /api/blockchain/webhook { type: "anchor.confirmed", ... }
    App-->>Svc: 200 { received: true }
    Svc->>App: POST /api/blockchain/webhook { type: "anchor.failed", ... }
    App-->>Svc: 200 { received: true }
```

## Conventions used by both sides

- **Base URL** for Pirma → service calls: `BLOCKCHAIN_API_URL` (env).
- **Versioning**: all service endpoints prefixed with `/v1`.
- **Auth (Pirma → service)**: `Authorization: Bearer <BLOCKCHAIN_API_KEY>`.
- **Auth (service → Pirma)**: HMAC-SHA256 signature header on the webhook (see
  `api-contract.md` §Reverse flow).
- **Status enum** (shared): `submitted | pending | confirmed | failed`.
- **Anchor key**: `payloadHash` is the idempotency key; re-submitting the same hash returns the
  same `anchorId`.
- **JSON everywhere**; ISO-8601 UTC timestamps; `null` for unknown optional fields.

## Configuration (Pirma side)

```
BLOCKCHAIN_API_URL=
BLOCKCHAIN_API_KEY=
BLOCKCHAIN_CHAIN=
BLOCKCHAIN_CONFIRMATIONS=
BLOCKCHAIN_TIMEOUT_MS=
BLOCKCHAIN_MAX_RETRIES=
BLOCKCHAIN_WEBHOOK_SECRET=
BLOCKCHAIN_ANCHOR_ON_FINALIZE=true
```

## Full contract

See **[`api-contract.md`](./api-contract.md)** for request/response schemas, examples, error
codes, idempotency, and security details for every endpoint in both flows.

## Open decisions (see also `docs/ai/blockchain-integration.md` §12)

1. Anchor granularity — per document (recommended) vs. per signature.
2. Auto-anchor after last signer vs. manual owner trigger.
3. Confirmation mechanism — poll, webhook, or both (both recommended).
4. Chain & cost — affects batching strategy (`POST /v1/anchor/batch`).
5. Proof retention — always store `proofJson` for offline verification.
6. Service idempotency — confirm re-submit returns the existing `anchorId`.
