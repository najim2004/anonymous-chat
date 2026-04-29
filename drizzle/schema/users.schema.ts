import { pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { rooms } from './rooms.schema';
import { messages } from './messages.schema';

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    username: varchar('username', { length: 24 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex('users_username_unique').on(table.username)],
);

export const usersRelations = relations(users, ({ many }) => ({
  rooms: many(rooms),
  messages: many(messages),
}));
