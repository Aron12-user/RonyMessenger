import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import UserAvatar from "@/components/UserAvatar";
import StatusIndicator, { UserStatus } from "@/components/StatusIndicator";
import { API_ENDPOINTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [username, setUsername] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Fetch contacts
  const { data: contacts = [] as User[] } = useQuery<User[]>({
    queryKey: [API_ENDPOINTS.CONTACTS],
  });

  // Fetch all users for searching - ensure proper typing with Typescript interface for paginated response
  type PaginatedUsers = {
    data: User[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
  
  const { data: usersResponse } = useQuery<PaginatedUsers>({
    queryKey: [API_ENDPOINTS.USERS],
  });
  
  // Extract users array from the paginated response safely
  const allUsers = (usersResponse?.data || []) as User[];

  // Add contact mutation - crée automatiquement une conversation
  const addContactMutation = useMutation({
    mutationFn: async (contactUsername: string) => {
      // Première étape : ajouter le contact
      const contactRes = await apiRequest("POST", API_ENDPOINTS.CONTACTS, { username: contactUsername });
      if (!contactRes.ok) {
        const errorData = await contactRes.json();
        throw new Error(errorData.message || "Erreur lors de l'ajout du contact");
      }
      const contactData = await contactRes.json();
      
      // Deuxième étape : créer automatiquement une conversation avec ce contact
      const conversationRes = await apiRequest("POST", API_ENDPOINTS.CONVERSATIONS, { 
        participantId: contactData.id 
      });
      if (!conversationRes.ok) {
        // Si la conversation existe déjà, récupérer l'ID existant
        const errorData = await conversationRes.json();
        if (errorData.message?.includes("existe déjà")) {
          // Récupérer toutes les conversations pour trouver celle avec ce contact
          const convRes = await fetch(API_ENDPOINTS.CONVERSATIONS);
          if (convRes.ok) {
            const conversations = await convRes.json();
            const existingConv = conversations.find((conv: any) => 
              conv.participantId === contactData.id || conv.creatorId === contactData.id
            );
            if (existingConv) {
              return { contact: contactData, conversation: existingConv };
            }
          }
        }
        throw new Error("Impossible de créer la conversation");
      }
      const conversationData = await conversationRes.json();
      
      return { contact: contactData, conversation: conversationData };
    },
    onSuccess: (data) => {
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONTACTS] });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.USERS] });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
      
      setShowAddModal(false);
      setUsername("");
      
      toast({
        title: "Contact ajouté",
        description: "Le contact a été ajouté et une conversation a été créée automatiquement"
      });
      
      // Rediriger vers Messages avec la conversation active
      setLocation(`/messages?conversation=${data.conversation.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'ajout",
        description: error.message || "Impossible d'ajouter ce contact",
        variant: "destructive"
      });
    }
  });

  const handleAddContact = () => {
    setShowAddModal(true);
  };
  
  const submitAddContact = () => {
    if (!username.trim()) {
      toast({
        title: "Nom d'utilisateur requis",
        description: "Veuillez saisir un nom d'utilisateur",
        variant: "destructive"
      });
      return;
    }
    addContactMutation.mutate(username);
  };

  // Mutation pour créer une nouvelle conversation ou récupérer existante
  const createConversationMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await apiRequest("POST", API_ENDPOINTS.CONVERSATIONS, { participantId });
      if (!res.ok) {
        const errorData = await res.json();
        // Si la conversation existe déjà, récupérer l'ID existant
        if (errorData.message?.includes("existe déjà")) {
          const convRes = await fetch(API_ENDPOINTS.CONVERSATIONS);
          if (convRes.ok) {
            const conversations = await convRes.json();
            const existingConv = conversations.find((conv: any) => 
              conv.participantId === participantId || conv.creatorId === participantId
            );
            if (existingConv) {
              return existingConv;
            }
          }
        }
        throw new Error(errorData.message || "Impossible de créer une conversation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Rafraîchir les conversations
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
      
      // Rediriger vers Messages avec la conversation active en utilisant la navigation React
      setLocation(`/messages?conversation=${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer une conversation",
        variant: "destructive"
      });
    }
  });

  const handleMessage = (contact: User) => {
    createConversationMutation.mutate(contact.id);
  };

  const handleCall = (contact: User) => {
    toast({
      title: "Call",
      description: `Calling ${contact.displayName || contact.username} would be implemented here`,
    });
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact: User) => {
    const searchString = `${contact.displayName} ${contact.username} ${contact.email || ''}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Contacts</h2>
            <div className="flex space-x-3">
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher des contacts..." 
                  className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  <span className="material-icons text-sm">search</span>
                </span>
              </div>
              <Button 
                onClick={handleAddContact}
                className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2"
              >
                <span className="material-icons">person_add</span>
                <span>Ajouter</span>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact: User) => (
                <div key={contact.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-3">
                    <div className="relative">
                      <UserAvatar 
                        initials={`${contact.username.charAt(0)}${contact.username.charAt(Math.min(1, contact.username.length - 1))}`.toUpperCase()} 
                        color={getColorForUser(contact.id)}
                        size="lg"
                      />
                      <StatusIndicator status={contact.status as UserStatus} />
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-lg">{contact.displayName || contact.username}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{contact.title || 'Utilisateur'}</p>
                    </div>
                    <button className="ml-auto p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                      <span className="material-icons">more_vert</span>
                    </button>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {contact.email && (
                      <div className="flex items-center">
                        <span className="material-icons text-gray-400 mr-2 text-sm">email</span>
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center">
                        <span className="material-icons text-gray-400 mr-2 text-sm">call</span>
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <Button 
                      onClick={() => handleMessage(contact)}
                      variant="outline" 
                      className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary py-2 rounded flex items-center justify-center"
                    >
                      <span className="material-icons text-sm mr-1">chat</span>
                      <span>Message</span>
                    </Button>
                    <Button 
                      onClick={() => handleCall(contact)}
                      variant="outline" 
                      className="flex-1 bg-secondary/10 hover:bg-secondary/20 text-secondary py-2 rounded flex items-center justify-center"
                    >
                      <span className="material-icons text-sm mr-1">videocam</span>
                      <span>Appel</span>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">
                {searchQuery ? (
                  <p>Aucun contact ne correspond à votre recherche. Essayez d'autres mots-clés.</p>
                ) : (
                  <div>
                    <span className="material-icons text-4xl mb-2">people</span>
                    <p className="text-lg mb-2">Votre liste de contacts est vide</p>
                    <p>Ajoutez des contacts pour commencer à échanger des messages</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal d'ajout de contact */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un contact</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Entrez le nom d'utilisateur de la personne que vous souhaitez ajouter à vos contacts.
            </p>
            <Input
              type="text"
              placeholder="Nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full"
            />
            
            {username.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Utilisateurs correspondants :</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {allUsers.filter((user: User) => 
                    user.username.toLowerCase().includes(username.toLowerCase()) ||
                    (user.displayName && user.displayName.toLowerCase().includes(username.toLowerCase()))
                  ).map((user: User) => (
                    <div 
                      key={user.id}
                      onClick={() => setUsername(user.username)}
                      className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <UserAvatar 
                        initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()} 
                        color={getColorForUser(user.id)}
                        size="sm"
                      />
                      <div className="ml-3">
                        <p className="font-medium">{user.displayName || user.username}</p>
                        {user.displayName && <p className="text-xs text-gray-500">@{user.username}</p>}
                      </div>
                      <StatusIndicator status={user.status as UserStatus} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={submitAddContact}
              disabled={addContactMutation.isPending}
              className="bg-primary text-white"
            >
              {addContactMutation.isPending ? "Ajout en cours..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// Helper function
function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}