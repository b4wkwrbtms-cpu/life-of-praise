CREATE TABLE `church_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`invite_id` text NOT NULL,
	`name` text NOT NULL,
	`church_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`church_id` text,
	`reason` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`reviewed` integer,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_invite_idx` ON `church_applications` (`invite_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_pending_user_idx` ON `church_applications` (`user_id`) WHERE "church_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `application_user_created_idx` ON `church_applications` (`user_id`,`created`);--> statement-breakpoint
CREATE INDEX `application_status_created_idx` ON `church_applications` (`status`,`created`);--> statement-breakpoint
CREATE TABLE `developer_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`developer` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dev_reply_request_created_idx` ON `developer_replies` (`request_id`,`created`);--> statement-breakpoint
CREATE TABLE `developer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`church_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dev_request_church_updated_idx` ON `developer_requests` (`church_id`,`updated`);--> statement-breakpoint
CREATE INDEX `dev_request_status_updated_idx` ON `developer_requests` (`status`,`updated`);--> statement-breakpoint
CREATE TABLE `leader_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL,
	`claimed_by` text,
	`created_by` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leader_invite_hash_idx` ON `leader_invites` (`code_hash`);