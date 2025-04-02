import { db } from './db';
import { sql } from 'drizzle-orm';

export async function createTables() {
  try {
    console.log('Création des tables manquantes...');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "folders" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "userId" INTEGER NOT NULL,
        "parentId" INTEGER,
        "path" TEXT NOT NULL DEFAULT '',
        "ownerId" INTEGER NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "is_shared" BOOLEAN DEFAULT FALSE,
        CONSTRAINT "folders_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "folders_parentId_folders_id_fk" FOREIGN KEY ("parentId") REFERENCES "folders"("id") ON DELETE CASCADE,
        CONSTRAINT "folders_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table folders créée ou existante');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "files" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "size" INTEGER NOT NULL,
        "url" TEXT NOT NULL,
        "uploaderId" INTEGER NOT NULL,
        "folderId" INTEGER,
        "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "is_shared" BOOLEAN DEFAULT FALSE,
        CONSTRAINT "files_uploaderId_users_id_fk" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "files_folderId_folders_id_fk" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL
      );
    `);
    console.log('Table files créée ou existante');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "file_sharing" (
        "id" SERIAL PRIMARY KEY,
        "fileId" INTEGER NOT NULL,
        "ownerId" INTEGER NOT NULL,
        "sharedWithId" INTEGER NOT NULL,
        "permission" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "file_sharing_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_sharedWithId_users_id_fk" FOREIGN KEY ("sharedWithId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table file_sharing créée ou existante');

    return true;
  } catch (error) {
    console.error('Erreur lors de la création des tables:', error);
    return false;
  }
}