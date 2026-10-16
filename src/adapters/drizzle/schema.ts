/**
 * Drizzle ORM Schema for JSONB Dynamic Fields and Metamodel
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const fieldGroups = pgTable('custom_field_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  visibilityScope: varchar('visibility_scope', { length: 100 })
    .notNull()
    .default('GLOBAL'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const fieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeId: varchar('scope_id', { length: 255 }),
    groupId: uuid('group_id').references(() => fieldGroups.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    key: varchar('key', { length: 100 }).notNull(),
    fieldType: varchar('field_type', { length: 50 }).notNull(),
    options: jsonb('options').$type<string[]>().default([]),
    isRequired: boolean('is_required').notNull().default(false),
    position: integer('position').notNull().default(0),
    renderLocation: varchar('render_location', { length: 50 }).default(
      'MAIN_TAB'
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_field_definitions_key').on(table.key),
    index('idx_field_definitions_scope').on(table.scopeId),
  ]
);

export const fieldGroupsRelations = relations(fieldGroups, ({ many }) => ({
  fields: many(fieldDefinitions),
}));

export const fieldDefinitionsRelations = relations(
  fieldDefinitions,
  ({ one }) => ({
    group: one(fieldGroups, {
      fields: [fieldDefinitions.groupId],
      references: [fieldGroups.id],
    }),
  })
);
