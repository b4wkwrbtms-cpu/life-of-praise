CREATE TABLE `notice_receipts` (
	`notice_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer,
	PRIMARY KEY(`notice_id`, `user_id`),
	FOREIGN KEY (`notice_id`) REFERENCES `worship_notices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `receipt_user_idx` ON `notice_receipts` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `push_channels` (
	`subscription_id` text NOT NULL,
	`church_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`subscription_id`, `church_id`),
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_channel_church_idx` ON `push_channels` (`church_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `push_deliveries` (
	`notice_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`user_id` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer NOT NULL,
	`lease` text,
	`last_status` integer,
	PRIMARY KEY(`notice_id`, `subscription_id`),
	FOREIGN KEY (`notice_id`) REFERENCES `worship_notices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_delivery_due_idx` ON `push_deliveries` (`state`,`next_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`test_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `worship_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`church_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notice_service_idx` ON `worship_notices` (`service_id`);--> statement-breakpoint
CREATE INDEX `notice_church_created_idx` ON `worship_notices` (`church_id`,`created`);