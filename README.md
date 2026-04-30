# Anonymous Chat API

This is a NestJS backend for an anonymous real-time group chat service. Users log in with a username only, join a room, and exchange messages instantly.

The implementation follows the interview contract:

- REST API under `/api/v1`
- PostgreSQL persistence through Drizzle ORM
- Redis-backed session and room presence state
- Redis pub/sub fan-out for multi-instance WebSocket delivery
- Socket.io namespace at `/chat`

## Tech Stack

- NestJS 11
- PostgreSQL
- Drizzle ORM
- Redis
- Socket.io
- TypeScript

## Prerequisites

Install these locally:

- Node.js 22+
- pnpm
- PostgreSQL
- Redis

## Local Setup

```bash
pnpm install
cp .env.example .env
```

Default `.env` values:

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/anonymous_chat
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=*
```

Create the database:

```bash
createdb anonymous_chat
```

Apply schema:

```bash
pnpm run db:push
```

If your deployment flow prefers SQL, use `drizzle/migrations/0000_initial_schema.sql`.

## Run The App

Development:

```bash
pnpm run start:dev
```

Production:

```bash
pnpm run build
pnpm run start:prod
```

Base REST URL:

```text
http://localhost:3000/api/v1
```

Socket.io URL:

```text
ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

## Useful Commands

```bash
pnpm run build
pnpm run lint
pnpm run db:push
pnpm run db:generate
```

## API Contract Notes

Every success response:

```json
{
  "success": true,
  "data": {}
}
```

Every error response:

```json
{
  "success": false,
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

All routes except `POST /api/v1/login` require:

```text
Authorization: Bearer <sessionToken>
```

## Deployment

Set `DATABASE_URL`, `REDIS_URL`, `PORT`, and `CORS_ORIGIN` on your host, build with `pnpm run build`, migrate with `pnpm run db:push`, then start with `pnpm run start:prod`.

Deployed URL: replace this line with your public deployment URL before submission.
