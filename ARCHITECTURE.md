# Architecture

## Overview

The app is a single NestJS service with REST controllers for login, rooms, and messages, plus a Socket.io gateway for live room presence and events.

```text
Frontend / tests
   | REST /api/v1
   v
NestJS controllers -> services -> Drizzle ORM -> PostgreSQL
   |
   | publish chat events
   v
Redis pub/sub
   |
   v
Socket.io gateway instances -> connected clients in /chat rooms

Redis also stores sessions, active users, and socket connection state.
```

Modules live under `src/modules`:

- `auth`: username login and Redis-backed sessions
- `rooms`: room CRUD and message history/posting
- `database`: Drizzle PostgreSQL client and schema
- `redis`: shared Redis clients
- `chat`: Socket.io gateway and Redis adapter

## Session Strategy

`POST /api/v1/login` validates the username, creates the user if needed, and returns a fresh opaque token generated with `crypto.randomBytes`.

Sessions are stored in Redis:

```text
session:<token> -> JSON user payload
TTL: 24 hours
```

The REST auth guard reads `Authorization: Bearer <token>` and resolves the user from Redis. Socket connections pass the same token as the `token` query parameter and are disconnected immediately when the token is missing or expired.

## Redis Pub/Sub Fan-out

Messages are never emitted directly from the REST controller. `POST /rooms/:id/messages` first saves the message through Drizzle, then publishes a `message:new` payload to the `chat:events` Redis channel.

Every running NestJS instance has a gateway subscriber on that channel. When an instance receives the event, it emits to its local Socket.io clients in the target room. The Socket.io Redis adapter is also enabled, so room membership and Socket.io broadcasts work across multiple server instances.

Room deletion follows the same pattern: the service publishes `room:deleted` before deleting the database row.

## Presence and Socket State

Redis is the source of truth for live room state:

```text
room:<roomId>:active_users              Set of usernames
room:<roomId>:user:<username>:sockets   Set of socket IDs for that user in that room
socket:<socketId>                       Hash with roomId and username
```

This avoids in-memory connection maps. If the same username opens two tabs in the same room, the username remains active until the last socket leaves.

## Single-instance Capacity Estimate

A modest single Node.js instance should handle roughly 5,000 to 10,000 idle WebSocket connections if the host has enough file descriptors and memory. Real chat throughput is lower because each posted message requires a PostgreSQL insert, a Redis publish, and Socket.io fan-out to all room members.

For a practical interview deployment on a small 1 vCPU / 1 GB instance, I would expect a safer operating range of about 1,000 to 2,000 concurrent connected users with moderate message volume. The exact number depends heavily on room size distribution, message rate, database latency, and Redis location.

## Scaling to 10x

To scale this design to 10x load, I would:

- Run multiple stateless NestJS instances behind a load balancer.
- Keep Redis managed and close to the app instances because session and presence checks are on the hot path.
- Use a managed PostgreSQL instance with proper connection limits and pooling.
- Add a queue for heavy side effects if message posting grows beyond simple persistence and fan-out.
- Add rate limits for login and message posting.
- Partition very large rooms or introduce per-room backpressure if a single room receives high write volume.
- Add observability: message publish latency, WebSocket connection count, Redis command latency, and PostgreSQL query timing.

## Known Limitations

- There is no password or identity proof by design; a username is the only identity.
- Socket.io connection failures emit an `error` payload and disconnect, but Socket.io does not expose REST-style HTTP error responses after the transport is established.
- The message cursor uses the cursor message `createdAt`. If many messages are created in the exact same database timestamp, a stricter `(createdAt, id)` cursor would be more precise.
- Presence keys have a 24-hour expiry as a cleanup backstop, but a production system should add periodic reconciliation for crashed instances.
- The checked-in SQL migration is simple and human-readable; `drizzle-kit push` is the recommended local setup path for this task.
