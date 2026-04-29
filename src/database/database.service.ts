import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../drizzle/schema';

export type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: AppDatabase;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/anonymous_chat';

    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
