# Architecture

## Architecture Overview

I kept the system simple and explicit so it is easy to test against the contract and easy to reason about during review.

```text
Client / test runner
   |
   | REST (/api/v1)
   v
NestJS controllers -> services -> Drizzle ORM -> PostgreSQL
   |
   | publish domain events
   v
Redis pub/sub (chat:events)
   |
   v
Socket.io gateways (/chat namespace) -> connected room clients
```

Redis is used as shared runtime state, not just as a cache. It stores:

- sessions
- active users per room
- socket-to-user/room mapping
- pub/sub events for cross-instance fan-out

The key modules are:

- `auth` for login and session lifecycle
- `rooms` for room CRUD + message APIs
- `chat` for Socket.io connection/presence/events
- `core/database` for Drizzle/PostgreSQL access
- `core/redis` for Redis clients and adapter connections

## Session Strategy

`POST /api/v1/login` validates the username, finds or creates the user, and issues a new opaque session token (`crypto.randomBytes`).

Session data is stored in Redis for 24 hours:

```text
session:<token> -> {"id","username","createdAt"}
TTL: 86400 seconds
```

I intentionally keep Redis as the source of truth for token validity. If the key expires or is removed, the token is invalid immediately.

REST auth flow:

- read `Authorization: Bearer <token>`
- look up `session:<token>` in Redis
- attach user to request context

Socket auth flow:

- read `token` and `roomId` from handshake query
- reject connection if token is invalid (`401`) or room does not exist (`404`)
- continue only after both checks pass

## Redis Pub/Sub And Multi-instance WebSocket Fan-out

The message send path is:

1. `POST /rooms/:id/messages` validates and persists the message in PostgreSQL via Drizzle.
2. Service publishes `message:new` to Redis channel `chat:events`.
3. Every running gateway subscribes to `chat:events`.
4. Each instance emits to its own local sockets in that room.

This gives consistent fan-out even when clients are connected to different app instances.

Room deletion uses the same pattern:

- publish `room:deleted`
- then delete room row (messages cascade by foreign key)

## Presence And Socket State

No in-memory JavaScript maps are used for connection tracking. Redis keys are used instead:

```text
room:<roomId>:active_users               Set<username>
room:<roomId>:user:<username>:sockets    Set<socketId>
socket:<socketId>                        Hash(roomId, username)
```

Behavior:

- on connect, user is added to room state
- on disconnect/`room:leave`, socket is removed
- username is removed only when its last socket leaves

This also handles multi-tab usage correctly.

## Estimated Single-instance Capacity

For a typical interview-grade deployment (1 vCPU / 1 GB), I estimate about **1,000-2,000 concurrent connected users** at moderate message volume.

Reasoning:

- each message path includes one PostgreSQL write and one Redis publish
- fan-out cost depends on room size distribution
- practical limits are usually DB latency, Redis round-trip time, and per-room burst traffic

Idle connection capacity can be higher, but steady chat throughput becomes the real bottleneck.

## Scaling Plan For 10x Load

If load grows by 10x, I would prioritize:

- horizontal scaling with multiple stateless NestJS instances
- managed Redis close to app nodes (session/presence path is hot)
- managed PostgreSQL + connection pooling tuning
- rate limiting for login and message endpoints
- better cursoring (`createdAt,id`) for very high write concurrency
- room-level backpressure controls for hot rooms
- stronger observability (Redis latency, DB latency, publish-to-emit lag, socket counts)

## Known Limitations And Trade-offs

- Identity is intentionally weak (username only) per assignment.
- WebSocket handshake failures are surfaced as Socket.io connect errors, not REST-shaped JSON responses.
- Cursor pagination currently uses message timestamp cutoff; tie-heavy workloads would benefit from a compound cursor.
- Presence keys use TTL as cleanup fallback; production setups should add periodic reconciliation jobs.
