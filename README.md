# Anonymous Chat API

NestJS backend for an anonymous real-time group chat service. Users log in with a username only, create or join rooms, read persisted message history, and receive live messages through Socket.io.

## Stack

- NestJS 11
- PostgreSQL
- Drizzle ORM
- Redis
- Socket.io
- TypeScript

## Requirements

Install these locally before running the app:

- Node.js 22+
- pnpm
- PostgreSQL
- Redis

Docker is not required.

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` if your PostgreSQL or Redis credentials are different:

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/anonymous_chat
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=*
```

Create the PostgreSQL database manually:

```bash
createdb anonymous_chat
```

Push the Drizzle schema:

```bash
pnpm run db:push
```

You can also apply the checked-in SQL manually from `drizzle/migrations/0000_initial_schema.sql` if your deployment flow uses `psql`.

## Run

```bash
pnpm run start:dev
```

Production build:

```bash
pnpm run build
pnpm run start:prod
```

The REST API is served under:

```text
http://localhost:3000/api/v1
```

The Socket.io namespace is:

```text
ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

## Useful Scripts

```bash
pnpm run build
pnpm run test
pnpm run lint
pnpm run db:push
pnpm run db:generate
```

## API Notes

All REST responses use this envelope:

```json
{
  "success": true,
  "data": {}
}
```

Errors use:

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

Set `DATABASE_URL`, `REDIS_URL`, `PORT`, and `CORS_ORIGIN` on the host. Run `pnpm run build`, apply the database schema with `pnpm run db:push` or the SQL migration, then start with `pnpm run start:prod`.

Deployed URL: add the final hosted URL after manual deployment.
