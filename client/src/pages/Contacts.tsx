import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import UserAvatar from "@/components/UserAvatar";
import StatusIndicator, { UserStatus } from "@/components/StatusIndicator";
import { API_ENDPOINTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { ChevronLeft, ChevronRight, MoreVertical, Trash2, MessageCircle, Phone } from "lucide-react";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [username, setUsername] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [sortBy, setSortBy] = useState("displayName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Type for paginated contacts response
  type PaginatedContacts = {
    data: User[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };

  // Fetch paginated contacts
  const { data: contactsResponse } = useQuery<PaginatedContacts>({
    queryKey: [API_ENDPOINTS.CONTACTS, currentPage, pageSize, sortBy, sortOrder],
    queryFn: async () => {
      const response = await fetch(`${API_ENDPOINTS.CONTACTS}?page=${currentPage}&pageSize=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
  });

  const contacts = contactsResponse?.data || [];

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
      
      // Rediriger vers la page d'accueil avec la conversation active
      setLocation(`/?conversation=${data.conversation.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'ajout",
        description: error.message || "Impossible d'ajouter ce contact",
        variant: "destructive"
      });
    }
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const res = await apiRequest("DELETE", `${API_ENDPOINTS.CONTACTS}/${contactId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erreur lors de la suppression du contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONTACTS] });
      setShowDeleteModal(false);
      setContactToDelete(null);
      toast({
        title: "Contact supprimé",
        description: "Le contact a été supprimé de votre liste"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de suppression",
        description: error.message || "Impossible de supprimer ce contact",
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
        title: "Adresse Rony requise",
        description: "Veuillez saisir une adresse Rony",
        variant: "destructive"
      });
      return;
    }
    
    // Vérifier que l'adresse Rony se termine par @rony.com
    if (!username.endsWith('@rony.com')) {
      toast({
        title: "Format invalide",
        description: "L'adresse Rony doit se terminer par @rony.com",
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
      
      // Rediriger vers la page d'accueil avec la conversation active en utilisant la navigation React
      setLocation(`/?conversation=${data.id}`);
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
    setLocation(`/calls?contact=${contact.id}`);
  };

  const handleDeleteContact = (contact: User) => {
    setContactToDelete(contact);
    setShowDeleteModal(true);
  };

  const confirmDeleteContact = () => {
    if (contactToDelete) {
      deleteContactMutation.mutate(contactToDelete.id);
    }
  };

  // Filter contacts based on search query - applying to paginated results
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    return contacts.filter((contact: User) => {
      const displayName = contact.displayName?.toLowerCase() || '';
      const username = contact.username.toLowerCase();
      const email = contact.email?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      
      return displayName.includes(query) || 
             username.includes(query) || 
             email.includes(query);
    });
  }, [contacts, searchQuery]);

  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (contactsResponse?.hasMore) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMessage(contact)}>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCall(contact)}>
                          <Phone className="mr-2 h-4 w-4" />
                          Appel
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteContact(contact)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          
          {/* Pagination Controls */}
          {contactsResponse && contactsResponse.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Affichage de {((currentPage - 1) * pageSize) + 1} à {Math.min(currentPage * pageSize, contactsResponse.total)} sur {contactsResponse.total} contacts
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, contactsResponse.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!contactsResponse.hasMore}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
              Entrez l'adresse Rony de la personne que vous souhaitez ajouter à vos contacts.
            </p>
            <Input
              type="email"
              placeholder="exemple@rony.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full"
            />
            
            {username.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Adresses Rony correspondantes :</p>
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
                        {user.displayName && <p className="text-xs text-gray-500">{user.username}</p>}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le contact</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {contactToDelete?.displayName || contactToDelete?.username} de vos contacts ?
              Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteContact}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              disabled={deleteContactMutation.isPending}
            >
              {deleteContactMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// Helper function
function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}