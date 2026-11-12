CREATE TABLE `admin_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL,
	CONSTRAINT "admin_rate_limits_count_positive" CHECK("admin_rate_limits"."count" > 0),
	CONSTRAINT "admin_rate_limits_reset_positive" CHECK("admin_rate_limits"."reset_at" > 0)
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "admin_sessions_expiry_positive" CHECK("admin_sessions"."expires_at" > 0)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `text_key` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `tasks` SET `text_key` = lower(trim(`text`));--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_text_key_unique` ON `tasks` (`text_key`);--> statement-breakpoint
