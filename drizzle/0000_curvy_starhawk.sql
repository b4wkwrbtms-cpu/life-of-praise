CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`song_id` text DEFAULT '' NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`parent_id` text DEFAULT '' NOT NULL,
	`attachment` text DEFAULT '' NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`version` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_service_created_idx` ON `comments` (`service_id`,`created`);--> statement-breakpoint
CREATE TABLE `confirmations` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`user_id`, `service_id`)
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`kind` text NOT NULL,
	`shared` integer DEFAULT 0 NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`song_id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`user_id`, `service_id`, `song_id`, `version`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`version` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`finalized` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL,
	`changes` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `services_date_idx` ON `services` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`service_id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL,
	`changes` text NOT NULL,
	PRIMARY KEY(`service_id`, `version`)
);
