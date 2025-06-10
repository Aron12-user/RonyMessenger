
-- Add missing is_read column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Update existing messages to mark them as unread
UPDATE messages SET is_read = false WHERE is_read IS NULL;
