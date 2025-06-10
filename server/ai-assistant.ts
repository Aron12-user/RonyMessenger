import OpenAI from "openai";
import { storage } from "./storage";
import { Request, Response } from "express";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AIFunction {
  name: string;
  description: string;
  parameters: any;
  handler: (args: any, userId: number) => Promise<any>;
}

const AI_FUNCTIONS: AIFunction[] = [
  {
    name: "add_contact",
    description: "Ajouter un nouveau contact à la liste de contacts de l'utilisateur",
    parameters: {
      type: "object",
      properties: {
        username: { type: "string", description: "Nom d'utilisateur du contact à ajouter" },
        displayName: { type: "string", description: "Nom d'affichage du contact" }
      },
      required: ["username"]
    },
    handler: async (args, userId) => {
      try {
        const contact = await storage.getUserByUsername(args.username);
        if (!contact) {
          return { error: "Utilisateur non trouvé" };
        }
        
        await storage.addContact({
          userId: userId,
          contactId: contact.id,
          createdAt: new Date(),
          isFavorite: false
        });
        
        return { success: true, contact: contact.displayName || contact.username };
      } catch (error) {
        return { error: "Erreur lors de l'ajout du contact" };
      }
    }
  },
  {
    name: "search_contacts",
    description: "Rechercher dans les contacts de l'utilisateur",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Terme de recherche pour filtrer les contacts" }
      },
      required: ["query"]
    },
    handler: async (args, userId) => {
      try {
        const contacts = await storage.getContactsForUser(userId);
        const filtered = contacts.filter(contact => 
          contact.username.toLowerCase().includes(args.query.toLowerCase()) ||
          (contact.displayName && contact.displayName.toLowerCase().includes(args.query.toLowerCase()))
        );
        
        return { contacts: filtered.map(c => ({ username: c.username, displayName: c.displayName })) };
      } catch (error) {
        return { error: "Erreur lors de la recherche de contacts" };
      }
    }
  },
  {
    name: "create_folder",
    description: "Créer un nouveau dossier dans l'espace de fichiers de l'utilisateur",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du dossier à créer" },
        parentId: { type: "number", description: "ID du dossier parent (optionnel)" }
      },
      required: ["name"]
    },
    handler: async (args, userId) => {
      try {
        const folder = await storage.createFolder({
          name: args.name,
          userId: userId,
          ownerId: userId,
          path: `/${args.name}`,
          parentId: args.parentId || null,
          createdAt: new Date(),
          isShared: false
        });
        
        return { success: true, folder: folder.name };
      } catch (error) {
        return { error: "Erreur lors de la création du dossier" };
      }
    }
  },
  {
    name: "update_user_profile",
    description: "Mettre à jour les informations du profil utilisateur",
    parameters: {
      type: "object",
      properties: {
        displayName: { type: "string", description: "Nouveau nom d'affichage" },
        email: { type: "string", description: "Nouvel email" },
        phone: { type: "string", description: "Nouveau numéro de téléphone" },
        title: { type: "string", description: "Nouveau titre/poste" }
      }
    },
    handler: async (args, userId) => {
      try {
        await storage.updateUserProfile(userId, args);
        return { success: true, updated: Object.keys(args) };
      } catch (error) {
        return { error: "Erreur lors de la mise à jour du profil" };
      }
    }
  },
  {
    name: "change_theme",
    description: "Changer le thème de l'interface utilisateur",
    parameters: {
      type: "object",
      properties: {
        theme: { 
          type: "string", 
          description: "Nom du thème à appliquer",
          enum: ["ocean", "teal", "purple", "sunset", "emerald", "rose", "indigo", "amber", "cyan", "dark"]
        }
      },
      required: ["theme"]
    },
    handler: async (args, userId) => {
      try {
        await storage.updateUserProfile(userId, { theme: args.theme });
        return { success: true, theme: args.theme };
      } catch (error) {
        return { error: "Erreur lors du changement de thème" };
      }
    }
  },
  {
    name: "web_search",
    description: "Effectuer une recherche d'informations sur internet",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Requête de recherche" }
      },
      required: ["query"]
    },
    handler: async (args, userId) => {
      // Simulation d'une recherche web - dans un vrai cas, utiliser une API de recherche
      return { 
        results: `Voici les informations trouvées pour "${args.query}": Cette fonctionnalité nécessite une intégration avec une API de recherche web comme Google Search API ou Bing Search API.`,
        query: args.query 
      };
    }
  }
];

export async function handleAIChat(req: Request, res: Response) {
  try {
    const { message, userId, context } = req.body;
    
    if (!message || !userId) {
      return res.status(400).json({ error: "Message et userId requis" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Préparer les fonctions disponibles pour OpenAI
    const functions = AI_FUNCTIONS.map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }));

    const systemPrompt = `Tu es l'assistant IA personnel de ${context.userName || user.username} dans l'application Rony. 
Tu peux aider à automatiser les tâches, gérer les contacts, organiser les fichiers, planifier des réunions, et répondre aux questions.

Capacités disponibles:
- Gestion des contacts (ajouter, rechercher)
- Organisation des fichiers (créer des dossiers)
- Modification du profil utilisateur
- Changement de thème
- Recherche web (limitée)

Tu dois être utile, professionnel et efficace. Quand tu utilises une fonction, explique ce que tu fais.
Réponds toujours en français et sois conversationnel comme un humain.`;

    // Appel à OpenAI avec function calling
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      tools: functions.map(func => ({
        type: "function" as const,
        function: func
      })),
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message;
    let functionResult = null;

    // Si OpenAI veut appeler une fonction
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      const aiFunction = AI_FUNCTIONS.find(f => f.name === functionName);
      if (aiFunction) {
        functionResult = await aiFunction.handler(functionArgs, userId);
      }

      // Faire un deuxième appel pour obtenir la réponse finale
      const finalCompletion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
          { role: "assistant", content: response.content, tool_calls: response.tool_calls },
          { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(functionResult) }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return res.json({
        response: finalCompletion.choices[0].message.content,
        functionCall: {
          name: functionName,
          args: functionArgs,
          result: functionResult
        }
      });
    }

    // Réponse simple sans appel de fonction
    res.json({
      response: response.content
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      error: "Erreur de l'assistant IA", 
      response: "Désolé, je rencontre un problème technique. Veuillez réessayer." 
    });
  }
}