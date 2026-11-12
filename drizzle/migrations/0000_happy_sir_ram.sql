CREATE TABLE `shared_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`grid_size` integer NOT NULL,
	`free_center` integer DEFAULT false NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "shared_cards_grid_size_valid" CHECK("shared_cards"."grid_size" BETWEEN 3 AND 7),
	CONSTRAINT "shared_cards_title_nonempty" CHECK(length(trim("shared_cards"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "tasks_text_nonempty" CHECK(length(trim("tasks"."text")) > 0)
);
--> statement-breakpoint
CREATE TRIGGER `shared_cards_snapshot_immutable`
BEFORE UPDATE ON `shared_cards`
BEGIN
	SELECT RAISE(ABORT, 'shared card snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `shared_cards_snapshot_no_delete`
BEFORE DELETE ON `shared_cards`
BEGIN
	SELECT RAISE(ABORT, 'shared card snapshots are immutable');
END;
