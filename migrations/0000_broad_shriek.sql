CREATE TYPE "public"."user_status" AS ENUM('online', 'offline', 'away', 'busy');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"is_favorite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"participant_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_message_time" timestamp,
	"last_message" text,
	"unread_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "file_sharing" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"shared_with_id" integer NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"uploader_id" integer NOT NULL,
	"folder_id" integer,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_shared" boolean DEFAULT false,
	"shared_with_id" integer,
	"share_link" text,
	"share_link_expiry" timestamp,
	"is_public" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" integer NOT NULL,
	"parent_id" integer,
	"owner_id" integer NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_shared" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text,
	"email" text,
	"phone" text,
	"title" text,
	"status" text DEFAULT 'offline' NOT NULL,
	"last_seen" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_id_users_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_sharing" ADD CONSTRAINT "file_sharing_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_sharing" ADD CONSTRAINT "file_sharing_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_sharing" ADD CONSTRAINT "file_sharing_shared_with_id_users_id_fk" FOREIGN KEY ("shared_with_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_shared_with_id_users_id_fk" FOREIGN KEY ("shared_with_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_user_id_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_id_idx" ON "contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_contact_idx" ON "contacts" USING btree ("user_id","contact_id");--> statement-breakpoint
CREATE INDEX "favorite_idx" ON "contacts" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "creator_id_idx" ON "conversations" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "participant_id_idx" ON "conversations" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "last_message_time_idx" ON "conversations" USING btree ("last_message_time");--> statement-breakpoint
CREATE INDEX "participants_idx" ON "conversations" USING btree ("creator_id","participant_id");--> statement-breakpoint
CREATE INDEX "sharing_file_id_idx" ON "file_sharing" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "sharing_with_id_idx" ON "file_sharing" USING btree ("shared_with_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_user_idx" ON "file_sharing" USING btree ("file_id","shared_with_id");--> statement-breakpoint
CREATE INDEX "uploader_id_idx" ON "files" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "type_idx" ON "files" USING btree ("type");--> statement-breakpoint
CREATE INDEX "uploaded_at_idx" ON "files" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "expires_at_idx" ON "files" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "folder_id_idx" ON "files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "file_is_shared_idx" ON "files" USING btree ("is_shared");--> statement-breakpoint
CREATE INDEX "shared_with_id_idx" ON "files" USING btree ("shared_with_id");--> statement-breakpoint
CREATE INDEX "folder_owner_id_idx" ON "folders" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "parent_id_idx" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "path_idx" ON "folders" USING btree ("path");--> statement-breakpoint
CREATE INDEX "folder_created_at_idx" ON "folders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "folder_is_shared_idx" ON "folders" USING btree ("is_shared");--> statement-breakpoint
CREATE INDEX "conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "sender_id_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "timestamp_idx" ON "messages" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "is_read_idx" ON "messages" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "conv_timestamp_idx" ON "messages" USING btree ("conversation_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "last_seen_idx" ON "users" USING btree ("last_seen");