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
        "userId" INTEGER NOT NULL,
        "parentId" INTEGER,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folders"("id") ON DELETE CASCADE
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
        "userId" INTEGER NOT NULL,
        "folderId" INTEGER,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL
      );
    `);
    console.log('Table files créée ou existante');

    // Vérifier si la table file_sharing existe, sinon la créer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "file_sharing" (
        "id" SERIAL PRIMARY KEY,
        "fileId" INTEGER NOT NULL,
        "ownerId" INTEGER NOT NULL,
        "sharedWithId" INTEGER NOT NULL,
        "permission" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "file_sharing_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "file_sharing_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table file_sharing créée ou existante');

    // Vérifier si la table contacts existe, sinon la créer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "contactId" INTEGER NOT NULL,
        "isFavorite" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    console.log('Table contacts créée ou existante');

    return true;
  } catch (error) {
    console.error('Erreur lors de la création des tables:', error);
    return false;
  }
}