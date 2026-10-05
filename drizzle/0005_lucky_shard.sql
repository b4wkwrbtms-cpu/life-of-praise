CREATE TABLE `app_guides` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`version` integer NOT NULL,
	`completed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `role`)
);
--> statement-breakpoint
CREATE TABLE `app_installations` (
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`installed_at` integer,
	`launched_at` integer,
	PRIMARY KEY(`user_id`, `platform`)
);
