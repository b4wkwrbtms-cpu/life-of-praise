CREATE TABLE `churches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`invite_hash` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `church_invite_idx` ON `churches` (`invite_hash`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`church_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`position` text DEFAULT '성도' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`leader_requested` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`church_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
ALTER TABLE `files` ADD `church_id` text DEFAULT 'uelin' NOT NULL;--> statement-breakpoint
ALTER TABLE `fixed_songs` ADD `church_id` text DEFAULT 'uelin' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `legacy_church` text DEFAULT 'uelin';--> statement-breakpoint
ALTER TABLE `services` ADD `church_id` text DEFAULT 'uelin' NOT NULL;--> statement-breakpoint
CREATE INDEX `services_church_date_idx` ON `services` (`church_id`,`date`);