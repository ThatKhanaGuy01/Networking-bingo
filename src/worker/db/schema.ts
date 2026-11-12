import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [check('tasks_text_nonempty', sql`length(trim(${table.text})) > 0`)])

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
