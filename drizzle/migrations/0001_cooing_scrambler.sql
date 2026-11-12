PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_shared_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`grid_size` integer NOT NULL,
	`free_center` integer DEFAULT false NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "shared_cards_grid_size_valid" CHECK("__new_shared_cards"."grid_size" BETWEEN 3 AND 7),
	CONSTRAINT "shared_cards_free_center_odd" CHECK("__new_shared_cards"."free_center" = 0 OR "__new_shared_cards"."grid_size" IN (3, 5, 7)),
	CONSTRAINT "shared_cards_title_nonempty" CHECK(length(trim("__new_shared_cards"."title")) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_shared_cards`("id", "title", "grid_size", "free_center", "snapshot_json", "created_at") SELECT "id", "title", "grid_size", "free_center", "snapshot_json", "created_at" FROM `shared_cards`;--> statement-breakpoint
DROP TABLE `shared_cards`;--> statement-breakpoint
ALTER TABLE `__new_shared_cards` RENAME TO `shared_cards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
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
