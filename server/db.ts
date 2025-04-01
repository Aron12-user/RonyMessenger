import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Configuration de la connexion
const connectionString = process.env.DATABASE_URL || '';

// Client pour les migrations
const migrationClient = postgres(connectionString, { max: 1 });

// Client pour les requêtes normales
const queryClient = postgres(connectionString);

// Initialisation de drizzle avec notre schéma
export const db = drizzle(queryClient, { schema });

// Fonction pour exécuter les migrations
export async function runMigrations() {
  try {
    const migrationDB = drizzle(migrationClient);
    
    console.log('Lancement des migrations de la base de données...');
    await migrate(migrationDB, { migrationsFolder: './drizzle' });
    console.log('Migrations terminées avec succès!');
    
    return true;
  } catch (error) {
    console.error('Erreur lors des migrations:', error);
    return false;
  }
}

// Fonction pour initialiser la base de données et ajouter des données de test
export async function seedDatabase() {
  try {
    console.log('Vérification de l\'existence des utilisateurs...');
    
    // Vérifier si des utilisateurs existent déjà
    const users = await db.select().from(schema.users);
    
    if (users.length === 0) {
      console.log('Aucun utilisateur trouvé, création de données initiales...');
      
      // Créer des utilisateurs test
      const usersData = [
        {
          username: 'currentuser',
          password: 'password123',
          displayName: 'Current User',
          email: 'user@example.com',
          phone: '+33123456789',
          title: 'Développeur',
          status: 'online'
        },
        {
          username: 'alice',
          password: 'password123',
          displayName: 'Alice Dupont',
          email: 'alice@example.com',
          phone: '+33987654321',
          title: 'Designer',
          status: 'online'
        },
        {
          username: 'bob',
          password: 'password123',
          displayName: 'Bob Martin',
          email: 'bob@example.com',
          phone: '+33678912345',
          title: 'Chef de Projet',
          status: 'away'
        },
        {
          username: 'claire',
          password: 'password123',
          displayName: 'Claire Dubois',
          email: 'claire@example.com',
          phone: '+33567891234',
          title: 'Marketeur',
          status: 'busy'
        }
      ];
      
      for (const userData of usersData) {
        await db.insert(schema.users).values(userData);
      }
      
      console.log('Utilisateurs créés avec succès!');
      
      // Récupérer les IDs des utilisateurs créés
      const createdUsers = await db.select().from(schema.users);
      const currentUser = createdUsers.find(u => u.username === 'currentuser');
      const alice = createdUsers.find(u => u.username === 'alice');
      const bob = createdUsers.find(u => u.username === 'bob');
      
      if (currentUser && alice && bob) {
        // Créer des contacts
        await db.insert(schema.contacts).values([
          { userId: currentUser.id, contactId: alice.id, isFavorite: true },
          { userId: currentUser.id, contactId: bob.id, isFavorite: false }
        ]);
        
        console.log('Contacts créés avec succès!');
        
        // Créer des conversations
        const conv1 = await db.insert(schema.conversations)
          .values({
            creatorId: currentUser.id,
            participantId: alice.id,
            lastMessage: 'Bonjour, comment vas-tu?',
            lastMessageTime: new Date(),
            unreadCount: 0
          })
          .returning();
          
        const conv2 = await db.insert(schema.conversations)
          .values({
            creatorId: currentUser.id,
            participantId: bob.id,
            lastMessage: 'Pouvez-vous m\'envoyer le document?',
            lastMessageTime: new Date(Date.now() - 30 * 60 * 1000),
            unreadCount: 1
          })
          .returning();
          
        console.log('Conversations créées avec succès!');
        
        if (conv1.length > 0 && conv2.length > 0) {
          // Créer des messages
          await db.insert(schema.messages).values([
            {
              conversationId: conv1[0].id,
              senderId: alice.id,
              content: 'Bonjour, comment vas-tu?',
              timestamp: new Date(Date.now() - 60 * 60 * 1000),
              isRead: true
            },
            {
              conversationId: conv1[0].id,
              senderId: currentUser.id,
              content: 'Je vais bien, merci! Et toi?',
              timestamp: new Date(Date.now() - 30 * 60 * 1000),
              isRead: true
            },
            {
              conversationId: conv1[0].id,
              senderId: alice.id,
              content: 'Très bien aussi! Je travaille sur le nouveau design.',
              timestamp: new Date(),
              isRead: true
            },
            {
              conversationId: conv2[0].id,
              senderId: bob.id,
              content: 'Pouvez-vous m\'envoyer le document?',
              timestamp: new Date(Date.now() - 30 * 60 * 1000),
              isRead: false
            }
          ]);
          
          console.log('Messages créés avec succès!');
        }
      }
    } else {
      console.log(`Base de données déjà initialisée avec ${users.length} utilisateurs.`);
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    return false;
  }
}