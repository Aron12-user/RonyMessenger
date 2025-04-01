import { db } from './db';
import { sql } from 'drizzle-orm';

// Fonction pour créer les tables manquantes
export async function createTables() {
  try {
    console.log('Création des tables manquantes...');

    // Vérifier si la table folders existe, sinon la créer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "folders" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "user_id" INTEGER NOT NULL,
        "parent_id" INTEGER,
        "path" TEXT NOT NULL DEFAULT '',
        "owner_id" INTEGER NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "is_shared" BOOLEAN DEFAULT FALSE,
        CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE,
        CONSTRAINT "folders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table folders créée ou existante');

    // Vérifier si la table files existe, sinon la créer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "files" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "size" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "user_id" INTEGER NOT NULL,
        "folder_id" INTEGER,
        "uploader_id" INTEGER NOT NULL,
        "is_shared" BOOLEAN DEFAULT FALSE,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL,
        CONSTRAINT "files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table files créée ou existante');

    // Vérifier si la table file_sharing existe, sinon la créer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "file_sharing" (
        "id" SERIAL PRIMARY KEY,
        "file_id" INTEGER NOT NULL,
        "owner_id" INTEGER NOT NULL,
        "shared_with_id" INTEGER NOT NULL,
        "permission" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "file_sharing_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_unique_idx" UNIQUE ("file_id", "shared_with_id")
      );
    `);
    console.log('Table file_sharing créée ou existante');

    // Vérifier si la table contacts existe, sinon la créer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "contact_id" INTEGER NOT NULL,
        "is_favorite" BOOLEAN DEFAULT false,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table contacts créée ou existante');

    return true;
  } catch (error) {
    console.error('Erreur lors de la création des tables:', error);
    return false;
  }
}