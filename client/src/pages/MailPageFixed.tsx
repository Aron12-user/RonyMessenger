import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { 
  Mail, 
  Search, 
  Filter, 
  Archive, 
  Star, 
  MoreHorizontal, 
  Reply,
  Forward,
  Download,
  Eye,
  Folder,
  FolderOpen,
  Paperclip,
  AlertCircle,
  Trash2,
  RotateCcw,
  Clock,
  User,
  Check,
  X,
  RefreshCw,
  Bell,
  Settings,
  Heart,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { cn } from "@/lib/utils";

// Import du nouveau composant
import EmailNotificationBadge from '@/components/EmailNotificationBadge';
import useWebSocket from '@/hooks/useWebSocket';

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
  attachment?: any;
  folder?: any;
}

export default function MailPageFixed() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [deletedEmails, setDeletedEmails] = useState<Set<number>>(new Set());
  const [archivedEmails, setArchivedEmails] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'files' | 'folders' | 'documents' | 'media'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [showEmailReader, setShowEmailReader] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'sender' | 'subject' | 'priority'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPreview, setShowPreview] = useState(true);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [pinnedEmails, setPinnedEmails] = useState<Set<number>>(new Set());
  const [readEmails, setReadEmails] = useState<Set<number>>(new Set());
  const [forceRefreshTrigger, setForceRefreshTrigger] = useState(0);
  
  // États pour les dialogs et fonctionnalités avancées
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwardRecipient, setForwardRecipient] = useState('');
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [emailTemplates, setEmailTemplates] = useState([
    { id: 1, name: 'Remerciement', content: 'Merci beaucoup pour votre partage. J\'apprécie vraiment.' },
    { id: 2, name: 'Demande info', content: 'Pouvez-vous me fournir plus d\'informations sur ce fichier ?' },
    { id: 3, name: 'Confirmation', content: 'Je confirme avoir bien reçu le document. Merci !' }
  ]);

  const queryClient = useQueryClient();
  const webSocket = useWebSocket();

  // Récupérer l'utilisateur connecté
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 5 * 60 * 1000,
  });

  // ✅ SOLUTION DÉFINITIVE: Récupérer les courriers avec l'API unifiée /api/mail
  const { data: emailsData, refetch, isLoading: isLoadingEmails, error: emailsError } = useQuery({
    queryKey: ['/api/mail', forceRefreshTrigger], // API unifiée
    enabled: !!user,
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
    refetchInterval: 5 * 1000,
    refetchIntervalInBackground: true,
  });

  // Configuration WebSocket pour réception instantanée
  useEffect(() => {
    if (!user || !webSocket) return;

    // Identifier l'utilisateur auprès du WebSocket
    webSocket.setUserId((user as any).id);
    console.log("[MailPageFixed] User identified to WebSocket:", (user as any).id);

    // ✅ Handler pour les notifications de courrier - SOLUTION DÉFINITIVE
    const handleCourrierNotification = (data: any) => {
      console.log("[MailPageFixed] Notification courrier reçue:", data);
      
      // Force une mise à jour immédiate avec triple invalidation
      setForceRefreshTrigger(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['/api/mail'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files/shared'] });
      
      // Refetch immédiat
      setTimeout(() => refetch(), 100);
      
      // Afficher une notification toast
      toast({
        title: "Nouveau courrier reçu",
        description: `${data.sender}: ${data.subject}`,
        duration: 5000,
      });
    };

    // Enregistrer les handlers WebSocket
    const removeCourrierHandler = webSocket.addMessageHandler('courrier_shared', handleCourrierNotification);
    const removeMessageHandler = webSocket.addMessageHandler('courrier_message', handleCourrierNotification);

    return () => {
      removeCourrierHandler();
      removeMessageHandler();
    };
  }, [(user as any)?.id, webSocket, queryClient, refetch]);

  // Status WebSocket pour affichage
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    setIsConnected(webSocket.status === 'open');
  }, [webSocket.status]);

  // ✅ SOLUTION DÉFINITIVE: Mise à jour directe depuis l'API unifiée
  useEffect(() => {
    if (!user || !emailsData) return;
    
    console.log('[COURRIER-DÉFINITIF] Mise à jour des emails depuis API unifiée');
    console.log('[COURRIER-DÉFINITIF] emailsData:', emailsData);
    
    // Utiliser directement les données de l'API qui sont déjà au bon format
    const processedEmails = Array.isArray(emailsData) ? emailsData : [];
    
    setEmails(processedEmails);
    console.log(`[COURRIER-DÉFINITIF] Emails mis à jour: ${processedEmails.length} total`);
  }, [emailsData, user, forceRefreshTrigger]);

  // Gestion des états persistants (lectures, archivage, suppression)
  useEffect(() => {
    if (!user) return;
    
    try {
      const savedRead = localStorage.getItem(`readEmails_${(user as any).id}`);
      const savedDeleted = localStorage.getItem(`deletedEmails_${(user as any).id}`);
      const savedArchived = localStorage.getItem(`archivedEmails_${(user as any).id}`);
      
      if (savedRead) setReadEmails(new Set(JSON.parse(savedRead)));
      if (savedDeleted) setDeletedEmails(new Set(JSON.parse(savedDeleted)));
      if (savedArchived) setArchivedEmails(new Set(JSON.parse(savedArchived)));
      
      console.log('[COURRIER-DÉFINITIF] États persistants chargés');
    } catch (error) {
      console.error('Erreur chargement localStorage:', error);
    }
  }, [user]);

  // Mutations pour les actions sur les emails
  const replyMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: any) => {
      console.log('Envoi réponse courrier:', { recipientEmail, message, originalEmail });
      
      const response = await fetch('/api/courrier/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail: recipientEmail.includes('@') ? recipientEmail.replace('@rony.com', '') : recipientEmail,
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: (user as any)?.displayName || (user as any)?.username,
          senderEmail: (user as any)?.username
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur réponse courrier:', errorText);
        throw new Error('Erreur lors de la réponse au courrier');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Réponse envoyée', description: 'Votre réponse a été envoyée avec succès' });
      setShowReplyDialog(false);
      setReplyMessage('');
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  });

  // Fonction pour marquer comme lu
  const markAsRead = (emailId: number) => {
    const newReadEmails = new Set(readEmails);
    newReadEmails.add(emailId);
    setReadEmails(newReadEmails);
    
    try {
      localStorage.setItem(`readEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newReadEmails)));
    } catch (error) {
      console.error('Erreur sauvegarde lecture:', error);
    }
  };

  // Fonction pour télécharger un fichier
  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl, { credentials: 'include' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ 
        title: 'Téléchargement réussi', 
        description: `${fileName} a été téléchargé avec succès` 
      });
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      toast({ 
        title: 'Erreur', 
        description: 'Erreur lors du téléchargement du fichier',
        variant: 'destructive' 
      });
    }
  };

  // Filtrer et trier les emails
  const filteredEmails = emails.filter(email => {
    if (deletedEmails.has(email.id)) return false;
    if (showArchived !== archivedEmails.has(email.id)) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!email.subject.toLowerCase().includes(query) && 
          !email.sender.toLowerCase().includes(query) && 
          !email.content.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    if (filterCategory !== 'all' && email.category !== filterCategory) {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime();
        break;
      case 'sender':
        comparison = a.sender.localeCompare(b.sender);
        break;
      case 'subject':
        comparison = a.subject.localeCompare(b.subject);
        break;
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Indicateur d'état de connexion
  const connectionStatus = isConnected ? (
    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
      Connecté
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
      <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
      Déconnecté
    </Badge>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-black dark:bg-gray-900 dark:text-white">
      {/* Header avec statistiques et contrôles */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-blue-600" />
              Courrier
            </h1>
            {connectionStatus}
            <EmailNotificationBadge unreadCount={filteredEmails.filter(e => !readEmails.has(e.id)).length} />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setViewMode(viewMode === 'compact' ? 'detailed' : 'compact')}
              variant="outline"
              size="sm"
            >
              {viewMode === 'compact' ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Vue détaillée
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Vue compacte
                </>
              )}
            </Button>
            
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              disabled={isLoadingEmails}
            >
              <RefreshCw className={cn("h-4 w-4", isLoadingEmails && "animate-spin")} />
              Actualiser
            </Button>
            
            <Button onClick={() => setShowCompose(true)} size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Nouveau message
            </Button>
          </div>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher dans les courriers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Catégorie: {filterCategory === 'all' ? 'Toutes' : filterCategory}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterCategory('all')}>
                Toutes les catégories
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('files')}>
                Fichiers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('folders')}>
                Dossiers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('documents')}>
                Documents
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterCategory('media')}>
                Média
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived ? 'Actifs' : 'Archivés'}
          </Button>
        </div>

        {/* Statistiques */}
        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <span>Total: {filteredEmails.length}</span>
          <span>Non lus: {filteredEmails.filter(e => !readEmails.has(e.id)).length}</span>
          <span>Archivés: {archivedEmails.size}</span>
          {isLoadingEmails && <span className="text-blue-600">Chargement...</span>}
        </div>
      </div>

      {/* Liste des emails */}
      <div className="flex-1 overflow-auto p-4">
        {isLoadingEmails ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              <span>Chargement des courriers...</span>
            </div>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Mail className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Aucun courrier</p>
            <p className="text-sm">
              {searchQuery ? 'Aucun résultat pour votre recherche' : 'Votre boîte courrier est vide'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {viewMode === 'compact' ? (
              // Vue compacte style Outlook
              <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredEmails.map((email) => (
                    <div key={email.id}>
                      {/* Ligne compacte */}
                      <div
                        className={cn(
                          "flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors",
                          !readEmails.has(email.id) && "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600",
                          expandedEmail === email.id && "bg-blue-50 dark:bg-blue-900/20"
                        )}
                        onClick={() => {
                          markAsRead(email.id);
                          setExpandedEmail(expandedEmail === email.id ? null : email.id);
                        }}
                      >
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {email.sender.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Expéditeur */}
                        <div className="w-32 flex-shrink-0">
                          <div className={cn(
                            "text-sm truncate",
                            !readEmails.has(email.id) ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {email.sender}
                          </div>
                        </div>

                        {/* Sujet et prévisualisation */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm truncate",
                              !readEmails.has(email.id) ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                            )}>
                              {email.subject}
                            </span>
                            <span className="text-xs text-gray-500 truncate flex-shrink-0">
                              - {email.preview || email.content}
                            </span>
                          </div>
                        </div>

                        {/* Indicateurs et date */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {email.hasAttachment && (
                            <Paperclip className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {email.time.substring(0, 5)}
                          </span>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-gray-400 transition-transform",
                            expandedEmail === email.id && "rotate-180"
                          )} />
                        </div>
                      </div>

                      {/* Vue détaillée expandable */}
                      {expandedEmail === email.id && (
                        <div className="bg-gray-50 dark:bg-gray-800 border-t p-4">
                          <div className="space-y-4">
                            {/* En-tête détaillé */}
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                  {email.subject}
                                </h4>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">{email.sender}</span> &lt;{email.senderEmail}&gt;
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {email.date} à {email.time}
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEmail(email);
                                    setShowReplyDialog(true);
                                  }}
                                >
                                  <Reply className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEmail(email);
                                    setShowForwardDialog(true);
                                  }}
                                >
                                  <Forward className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const newArchived = new Set(archivedEmails);
                                        newArchived.add(email.id);
                                        setArchivedEmails(newArchived);
                                        localStorage.setItem(`archivedEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newArchived)));
                                      }}
                                    >
                                      <Archive className="h-4 w-4 mr-2" />
                                      Archiver
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Contenu du message */}
                            <div className="prose prose-sm max-w-none">
                              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 p-3 rounded border">
                                {email.content}
                              </div>
                            </div>

                            {/* Pièces jointes */}
                            {email.attachment && (
                              <div className="border rounded-lg p-3 bg-white dark:bg-gray-700">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                                      <Paperclip className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                                        {email.attachment.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {(email.attachment.size / 1024).toFixed(1)} KB • {email.attachment.type}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadFile(email.attachment.url, email.attachment.name);
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Télécharger
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Dossiers partagés */}
                            {email.folder && (
                              <div className="border rounded-lg p-3 bg-white dark:bg-gray-700">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                      <Folder className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                                        {email.folder.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {email.folder.fileCount || 0} fichiers
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Ouvrir l'explorateur de dossier
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Explorer
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Vue détaillée traditionnelle (garder le code existant comme fallback)
              <div className="space-y-2">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    className={cn(
                      "bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer",
                      !readEmails.has(email.id) && "border-l-4 border-l-blue-600 bg-blue-50 dark:bg-blue-900/20",
                      selectedEmails.has(email.id) && "ring-2 ring-blue-500"
                    )}
                    onClick={() => markAsRead(email.id)}
                  >
                    {/* Contenu détaillé existant... */}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog pour répondre */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Répondre au courrier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Votre réponse..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowReplyDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (selectedEmail && replyMessage.trim()) {
                    replyMutation.mutate({
                      recipientEmail: selectedEmail.senderEmail,
                      message: replyMessage,
                      originalEmail: selectedEmail
                    });
                  }
                }}
                disabled={!replyMessage.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}