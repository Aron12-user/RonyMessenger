CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "display_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'offline',
  "last_seen" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" SERIAL PRIMARY KEY,
  "creator_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "participant_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_message_time" TIMESTAMP,
  "last_message" TEXT,
  "unread_count" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" SERIAL PRIMARY KEY,
  "conversation_id" INTEGER NOT NULL REFERENCES "conversations" ("id") ON DELETE CASCADE,
  "sender_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "content" TEXT NOT NULL,
  "file_url" TEXT,
  "file_name" TEXT,
  "file_type" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "is_read" BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS "files" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "uploader_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "contact_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "is_favorite" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster contact lookup
CREATE INDEX IF NOT EXISTS "idx_contacts_user_id" ON "contacts" ("user_id");

-- Index for messages by conversation
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_id" ON "messages" ("conversation_id");

-- Index for conversations by participants
CREATE INDEX IF NOT EXISTS "idx_conversations_participants" ON "conversations" ("creator_id", "participant_id");

-- Index for user status
CREATE INDEX IF NOT EXISTS "idx_users_status" ON "users" ("status");

-- Index for file uploads by user
CREATE INDEX IF NOT EXISTS "idx_files_uploader" ON "files" ("uploader_id");