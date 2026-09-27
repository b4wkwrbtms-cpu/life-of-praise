CREATE TABLE `fixed_songs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`auto_add` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `services` ADD `deleted` integer DEFAULT 0 NOT NULL;