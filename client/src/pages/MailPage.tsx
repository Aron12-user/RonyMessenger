import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  Mail, 
  Search, 
  Filter, 
  Archive, 
  Star, 
  MoreHorizontal, 
  ArrowLeft,
  Reply,
  Forward,
  Download,
  Eye,
  Folder,
  FolderOpen,
  Paperclip,
  AlertCircle,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { cn } from "@/lib/utils";

// Types pour le système de courrier
interface EmailItem {
  id: number;
  sender: string;
  senderEmail: string;
  subject: string;
  content: string;
  preview: string;
  date: string;
  time: string;
  hasAttachment: boolean;
  priority: 'low' | 'medium' | 'high';
  category: 'files' | 'folders' | 'documents' | 'media';
  attachment?: SharedFile;
  folder?: SharedFolder;
}

interface SharedFile {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
  sharedBy: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface SharedFolder {
  id: number;
  name: string;
  fileCount: number;
  totalSize: number;
  uploaderId: number;
  uploadedAt: string;
  sharedBy: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface EmailState {
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isDeleted: boolean;
}

export default function MailPage() {
  const [persistentEmails, setPersistentEmails] = useState<EmailItem[]>([]);
  const [realtimeEmails, setRealtimeEmails] = useState<EmailItem[]>([]);
  const [emailStates, setEmailStates] = useState<Map<number, EmailState>>(new Map());
  const [viewMode, setViewMode] = useState<'list' | 'reading'>('list');
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'files' | 'folders' | 'documents' | 'media'>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  // États pour les actions
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwardRecipient, setForwardRecipient] = useState('');
  
  // États pour l'exploration des dossiers
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<SharedFolder | null>(null);
  const [folderFiles, setFolderFiles] = useState<SharedFile[]>([]);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Requête pour les fichiers et dossiers partagés
  const { data: sharedData, isLoading, refetch } = useQuery({
    queryKey: ['/api/files/shared'],
    queryFn: async () => {
      const response = await fetch('/api/files/shared');
      if (!response.ok) throw new Error('Erreur lors du chargement');
      return response.json();
    },
  });

  const sharedFiles: SharedFile[] = sharedData?.files || [];
  const sharedFolders: SharedFolder[] = sharedData?.folders || [];

  // Fonction pour obtenir l'état actuel d'un email
  const getCurrentEmail = (email: EmailItem): EmailItem & EmailState => {
    const state = emailStates.get(email.id) || {
      isRead: false,
      isStarred: false,
      isArchived: false,
      isDeleted: false
    };
    return { ...email, ...state };
  };

  // Convertir les fichiers/dossiers partagés en emails et charger depuis localStorage
  useEffect(() => {
    if (!user) return;
    
    // Charger les emails persistants depuis localStorage
    try {
      const savedEmails = localStorage.getItem(`courrier_${user.id}`);
      if (savedEmails) {
        const parsed = JSON.parse(savedEmails);
        setPersistentEmails(parsed);
        console.log(`✓ Chargé ${parsed.length} emails depuis localStorage`);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des emails:', error);
    }

    // Convertir les nouveaux fichiers/dossiers partagés en emails
    if (sharedFiles.length > 0 || sharedFolders.length > 0) {
      const emailsFromFiles = sharedFiles.map(file => ({
        id: file.id + 10000,
        sender: file.sharedBy.displayName || file.sharedBy.username,
        senderEmail: `${file.sharedBy.username}@rony.com`,
        subject: `Fichier partagé: ${file.name}`,
        content: `${file.sharedBy.displayName || file.sharedBy.username} a partagé le fichier "${file.name}" avec vous.`,
        preview: `Fichier: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        date: new Date(file.uploadedAt).toLocaleDateString(),
        time: new Date(file.uploadedAt).toLocaleTimeString(),
        hasAttachment: true,
        priority: 'medium' as const,
        category: file.type.startsWith('image/') ? 'media' as const : 'files' as const,
        attachment: file
      }));

      const emailsFromFolders = sharedFolders.map(folder => ({
        id: folder.id + 20000,
        sender: folder.sharedBy.displayName || folder.sharedBy.username,
        senderEmail: `${folder.sharedBy.username}@rony.com`,
        subject: `Dossier partagé: ${folder.name}`,
        content: `${folder.sharedBy.displayName || folder.sharedBy.username} a partagé le dossier "${folder.name}" avec vous.`,
        preview: `Dossier: ${folder.name} (${folder.fileCount} fichiers)`,
        date: new Date(folder.uploadedAt).toLocaleDateString(),
        time: new Date(folder.uploadedAt).toLocaleTimeString(),
        hasAttachment: true,
        priority: 'medium' as const,
        category: 'folders' as const,
        folder: folder
      }));

      const allNewEmails = [...emailsFromFiles, ...emailsFromFolders];
      setRealtimeEmails(allNewEmails);
      
      // Sauvegarder dans localStorage pour la persistance
      const updatedEmails = [...persistentEmails, ...allNewEmails];
      localStorage.setItem(`courrier_${user.id}`, JSON.stringify(updatedEmails));
      setPersistentEmails(updatedEmails);
    }
  }, [user, sharedFiles, sharedFolders]);

  // WebSocket pour les mises à jour en temps réel
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✓ Connexion WebSocket courrier établie');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'courrier_message') {
          const newEmail = data.data;
          console.log('📧 Nouveau message courrier reçu:', newEmail);
          
          // Ajouter le nouveau message aux emails persistants
          setPersistentEmails(prev => {
            const updated = [newEmail, ...prev];
            localStorage.setItem(`courrier_${user.id}`, JSON.stringify(updated));
            return updated;
          });

          // Notifier l'utilisateur
          toast({
            title: "Nouveau courrier reçu",
            description: `De ${newEmail.sender}: ${newEmail.subject}`,
          });
        }
      } catch (error) {
        console.error('Erreur traitement message WebSocket:', error);
      }
    };

    socket.onclose = () => {
      console.log('⚠️ Connexion WebSocket courrier fermée');
    };

    return () => {
      socket.close();
    };
  }, [user, toast]);

  // Mutations pour les actions sur les emails
  const markAsReadMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const currentState = emailStates.get(emailId) || { isRead: false, isStarred: false, isArchived: false, isDeleted: false };
      const newState = { ...currentState, isRead: true };
      setEmailStates(prev => new Map(prev.set(emailId, newState)));
      return true;
    }
  });

  const starMutation = useMutation({
    mutationFn: async ({ emailId, isStarred }: { emailId: number, isStarred: boolean }) => {
      const currentState = emailStates.get(emailId) || { isRead: false, isStarred: false, isArchived: false, isDeleted: false };
      const newState = { ...currentState, isStarred };
      setEmailStates(prev => new Map(prev.set(emailId, newState)));
      return true;
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const currentState = emailStates.get(emailId) || { isRead: false, isStarred: false, isArchived: false, isDeleted: false };
      const newState = { ...currentState, isArchived: true };
      setEmailStates(prev => new Map(prev.set(emailId, newState)));
      return true;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (emailId: number) => {
      const currentState = emailStates.get(emailId) || { isRead: false, isStarred: false, isArchived: false, isDeleted: false };
      const newState = { ...currentState, isDeleted: true };
      setEmailStates(prev => new Map(prev.set(emailId, newState)));
      return true;
    }
  });

  // Mutation pour répondre à un email
  const replyMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: { 
      recipientEmail: string, 
      message: string, 
      originalEmail: EmailItem 
    }) => {
      if (!user) throw new Error('Utilisateur non connecté');
      
      const response = await fetch('/api/courrier/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: user.displayName || user.username,
          senderEmail: user.email || `${user.username}@rony.com`
        })
      });
      
      if (!response.ok) throw new Error('Erreur lors de l\'envoi de la réponse');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Réponse envoyée avec succès', description: 'Votre message a été délivré instantanément' });
      setShowReplyDialog(false);
      setReplyMessage('');
    },
    onError: (error) => {
      console.error('Erreur réponse:', error);
      toast({ title: 'Erreur envoi réponse', description: 'Impossible d\'envoyer la réponse. Réessayez.', variant: 'destructive' });
    }
  });

  // Mutation pour transférer un email
  const forwardMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: { 
      recipientEmail: string, 
      message: string, 
      originalEmail: EmailItem 
    }) => {
      if (!user) throw new Error('Utilisateur non connecté');
      
      const response = await fetch('/api/courrier/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          message,
          originalEmail: {
            subject: originalEmail.subject,
            sender: originalEmail.sender,
            senderEmail: originalEmail.senderEmail,
            content: originalEmail.content,
            date: originalEmail.date,
            time: originalEmail.time,
            attachment: originalEmail.attachment,
            folder: originalEmail.folder
          },
          senderName: user.displayName || user.username,
          senderEmail: user.email || `${user.username}@rony.com`
        })
      });
      
      if (!response.ok) throw new Error('Erreur lors du transfert');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Message transféré avec succès', description: 'Le transfert complet a été délivré instantanément' });
      setShowForwardDialog(false);
      setForwardMessage('');
      setForwardRecipient('');
    },
    onError: (error) => {
      console.error('Erreur transfert:', error);
      toast({ title: 'Erreur transfert', description: 'Impossible de transférer le message. Réessayez.', variant: 'destructive' });
    }
  });

  // Mutation pour explorer un dossier
  const exploreFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const response = await fetch(`/api/files/folder/${folderId}/files`);
      if (!response.ok) throw new Error('Erreur lors de l\'exploration du dossier');
      return response.json();
    },
    onSuccess: (data, folderId) => {
      setFolderFiles(data.files || []);
      const folder = sharedFolders.find(f => f.id === folderId);
      setSelectedFolder(folder || null);
      setShowFolderExplorer(true);
    },
    onError: (error) => {
      console.error('Erreur exploration dossier:', error);
      toast({ title: 'Erreur exploration', description: 'Impossible d\'explorer le dossier', variant: 'destructive' });
    }
  });

  // Mutation pour télécharger un dossier
  const downloadFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const response = await fetch(`/api/files/folder/${folderId}/download`);
      if (!response.ok) throw new Error('Erreur lors du téléchargement');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dossier_${folderId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    },
    onSuccess: () => {
      toast({ title: 'Téléchargement démarré', description: 'Le dossier compressé est en cours de téléchargement' });
    },
    onError: (error) => {
      console.error('Erreur téléchargement dossier:', error);
      toast({ title: 'Erreur téléchargement', description: 'Impossible de télécharger le dossier', variant: 'destructive' });
    }
  });

  // Combiner tous les emails (persistants + temps réel)
  const allEmails = [...persistentEmails, ...realtimeEmails];

  // Filtrer les emails selon les critères
  const filteredEmails = allEmails
    .filter(email => {
      const currentEmail = getCurrentEmail(email);
      
      // Filtrer par supprimé/archivé
      if (currentEmail.isDeleted) return false;
      if (showArchived !== currentEmail.isArchived) return false;
      
      // Filtrer par catégorie
      if (filterCategory !== 'all' && email.category !== filterCategory) return false;
      
      // Filtrer par recherche
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          email.sender.toLowerCase().includes(query) ||
          email.subject.toLowerCase().includes(query) ||
          email.content.toLowerCase().includes(query) ||
          email.senderEmail.toLowerCase().includes(query)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      // Trier par date (plus récent en premier)
      const dateA = new Date(`${a.date} ${a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time}`).getTime();
      return dateB - dateA;
    });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Vous devez être connecté pour accéder au courrier</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du courrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">📧 Courrier</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Actualiser</span>
            </Button>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher dans le courrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  {filterCategory === 'all' ? 'Tous' : 
                   filterCategory === 'files' ? 'Fichiers' :
                   filterCategory === 'folders' ? 'Dossiers' :
                   filterCategory === 'documents' ? 'Documents' : 'Médias'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterCategory('all')}>
                  Tous les messages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterCategory('files')}>
                  📄 Fichiers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterCategory('folders')}>
                  📁 Dossiers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterCategory('documents')}>
                  📋 Documents
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterCategory('media')}>
                  🎨 Médias
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? 'Masquer archivés' : 'Voir archivés'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredEmails.length} message{filteredEmails.length !== 1 ? 's' : ''} 
            {searchQuery && ` pour "${searchQuery}"`}
            {filterCategory !== 'all' && ` dans ${filterCategory}`}
          </span>
          <div className="flex space-x-4">
            <span>{filteredEmails.filter(e => !getCurrentEmail(e).isRead).length} non lus</span>
            <span>{filteredEmails.filter(e => getCurrentEmail(e).isStarred).length} favoris</span>
          </div>
        </div>
      </div>

      {/* Liste des emails */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pb-16">
          {filteredEmails.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun message</h3>
                <p className="text-gray-600">
                  {searchQuery ? 'Aucun message trouvé pour cette recherche' : 'Votre boîte de courrier est vide'}
                </p>
              </div>
            </div>
          ) : (
            filteredEmails.map((email) => {
              const currentEmail = getCurrentEmail(email);
              return (
                <div
                  key={email.id}
                  className={cn(
                    "border-b border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition-colors",
                    !currentEmail.isRead && "bg-blue-50 hover:bg-blue-100"
                  )}
                  onClick={() => {
                    setSelectedEmail(currentEmail);
                    setViewMode('reading');
                    if (!currentEmail.isRead) {
                      markAsReadMutation.mutate(email.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        email.category === 'folders' ? "bg-blue-500" : "bg-orange-500"
                      )}>
                        <span className="text-white font-bold text-sm">
                          {email.sender.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                      </div>

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className={cn(
                              "font-medium",
                              !currentEmail.isRead ? "text-gray-900" : "text-gray-700"
                            )}>
                              {email.sender}
                            </span>
                            {currentEmail.isStarred && (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                            {email.hasAttachment && (
                              <Paperclip className="w-4 h-4 text-gray-400" />
                            )}
                            {email.priority === 'high' && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center space-x-3 text-sm text-gray-500">
                            <span>{email.date}</span>
                            <span>{email.time}</span>
                          </div>
                        </div>
                        
                        <h3 className={cn(
                          "text-sm mb-1 truncate",
                          !currentEmail.isRead ? "font-semibold text-gray-900" : "text-gray-700"
                        )}>
                          {email.subject}
                        </h3>
                        
                        <p className="text-sm text-gray-600 truncate">
                          {email.preview}
                        </p>

                        {/* Badges de catégorie */}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge 
                            variant={email.category === 'files' ? 'default' : email.category === 'folders' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {email.category === 'files' && '📄 Fichier'}
                            {email.category === 'folders' && '📁 Dossier'}
                            {email.category === 'documents' && '📋 Document'}
                            {email.category === 'media' && '🎨 Média'}
                          </Badge>
                          {!currentEmail.isRead && (
                            <Badge variant="default" className="text-xs bg-blue-600">
                              Nouveau
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1 ml-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            starMutation.mutate({ emailId: email.id, isStarred: !currentEmail.isStarred });
                          }}>
                            <Star className="w-4 h-4 mr-2" />
                            {currentEmail.isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmail(email);
                            setShowReplyDialog(true);
                          }}>
                            <Reply className="w-4 h-4 mr-2" />
                            Répondre
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmail(email);
                            setShowForwardDialog(true);
                          }}>
                            <Forward className="w-4 h-4 mr-2" />
                            Transférer
                          </DropdownMenuItem>
                          {email.folder && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              exploreFolderMutation.mutate(email.folder!.id);
                            }}>
                              <FolderOpen className="w-4 h-4 mr-2" />
                              Explorer le dossier
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            archiveMutation.mutate(email.id);
                          }}>
                            <Archive className="w-4 h-4 mr-2" />
                            Archiver
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(email.id);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dialog pour répondre */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Répondre à {selectedEmail?.sender}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <strong>Message original:</strong> {selectedEmail?.subject}
            </div>
            <Textarea
              placeholder="Votre réponse..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowReplyDialog(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => {
                  if (selectedEmail) {
                    replyMutation.mutate({
                      recipientEmail: selectedEmail.senderEmail,
                      message: replyMessage,
                      originalEmail: selectedEmail
                    });
                  }
                }}
                disabled={!replyMessage.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? 'Envoi...' : 'Envoyer la réponse'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pour transférer */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transférer le message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <strong>Message à transférer:</strong> {selectedEmail?.subject}
            </div>
            <Input
              placeholder="Email du destinataire (ex: user@rony.com)"
              value={forwardRecipient}
              onChange={(e) => setForwardRecipient(e.target.value)}
            />
            <Textarea
              placeholder="Message d'accompagnement (optionnel)..."
              value={forwardMessage}
              onChange={(e) => setForwardMessage(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowForwardDialog(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => {
                  if (selectedEmail) {
                    forwardMutation.mutate({
                      recipientEmail: forwardRecipient,
                      message: forwardMessage || `Message transféré de ${selectedEmail.sender}`,
                      originalEmail: selectedEmail
                    });
                  }
                }}
                disabled={!forwardRecipient.trim() || forwardMutation.isPending}
              >
                {forwardMutation.isPending ? 'Transfert...' : 'Transférer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pour explorer un dossier */}
      <Dialog open={showFolderExplorer} onOpenChange={setShowFolderExplorer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Folder className="w-5 h-5" />
              <span>Explorer: {selectedFolder?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {folderFiles.length} fichier{folderFiles.length !== 1 ? 's' : ''} dans ce dossier
            </div>
            <div className="max-h-96 overflow-y-auto">
              {folderFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun fichier dans ce dossier
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {folderFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <span className="text-blue-600 text-xs font-bold">
                            {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(file.url, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Voir
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.url;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Télécharger
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setShowFolderExplorer(false)}>
                Fermer
              </Button>
              {selectedFolder && (
                <Button onClick={() => downloadFolderMutation.mutate(selectedFolder.id)}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger tout le dossier
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
