import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  textKey: text('text_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  check('tasks_text_nonempty', sql`length(trim(${table.text})) > 0`),
  uniqueIndex('tasks_text_key_unique').on(table.textKey),
])

export const sharedCards = sqliteTable('shared_cards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  gridSize: integer('grid_size').notNull(),
  freeCenter: integer('free_center', { mode: 'boolean' }).notNull().default(false),
  snapshotJson: text('snapshot_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  check('shared_cards_grid_size_valid', sql`${table.gridSize} BETWEEN 3 AND 7`),
  check('shared_cards_free_center_odd', sql`${table.freeCenter} = 0 OR ${table.gridSize} IN (3, 5, 7)`),
  check('shared_cards_title_nonempty', sql`length(trim(${table.title})) > 0`),
])

export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [check('admin_sessions_expiry_positive', sql`${table.expiresAt} > 0`)])

export const adminRateLimits = sqliteTable('admin_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: integer('reset_at').notNull(),
}, (table) => [
  check('admin_rate_limits_count_positive', sql`${table.count} > 0`),
  check('admin_rate_limits_reset_positive', sql`${table.resetAt} > 0`),
])
