import { index, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.schema';
import { rooms } from './rooms.schema';

export const messages = pgTable(
  'messages',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    roomId: varchar('room_id', { length: 32 })
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: varchar('content', { length: 1000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('messages_room_created_at_idx').on(table.roomId, table.createdAt),
    index('messages_user_idx').on(table.userId),
  ],
);

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));
