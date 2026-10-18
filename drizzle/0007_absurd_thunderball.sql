CREATE TABLE `reader_pairs` (
	`church_id` text NOT NULL,
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`church_id`, `user_id`, `service_id`, `version`),
	FOREIGN KEY (`church_id`) REFERENCES `churches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reader_pairs_service_idx` ON `reader_pairs` (`service_id`);