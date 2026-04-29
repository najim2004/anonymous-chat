import { index, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.schema';
import { messages } from './messages.schema';

export const rooms = pgTable(
  'rooms',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    name: varchar('name', { length: 32 }).notNull(),
    createdById: varchar('created_by_id', { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('rooms_name_unique').on(table.name),
    index('rooms_created_by_idx').on(table.createdById),
  ],
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [rooms.createdById],
    references: [users.id],
  }),
  messages: many(messages),
}));
