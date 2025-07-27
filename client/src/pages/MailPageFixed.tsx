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
  ArrowLeft,
  FileText
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Par défaut : plus récents en premier
  const [showPreview, setShowPreview] = useState(true);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [pinnedEmails, setPinnedEmails] = useState<Set<number>>(new Set());
  const [favoriteEmails, setFavoriteEmails] = useState<Set<number>>(new Set());
  const [readEmails, setReadEmails] = useState<Set<number>>(new Set());
  const [forceRefreshTrigger, setForceRefreshTrigger] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  
  // États pour les dialogues
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwardRecipient, setForwardRecipient] = useState('');
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  
  // États pour l'explorateur de dossiers
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [selectedFolderForExplorer, setSelectedFolderForExplorer] = useState<any>(null);
  const [folderContents, setFolderContents] = useState<any[]>([]);

  const queryClient = useQueryClient();
  const webSocket = useWebSocket();

  // Récupérer l'utilisateur connecté
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 5 * 60 * 1000,
  });

  // ✅ SOLUTION DÉFINITIVE: Récupérer les courriers avec l'API unifiée /api/mail - RÉCEPTION ILLIMITÉE
  const { data: emailsData, refetch, isLoading: isLoadingEmails, error: emailsError } = useQuery({
    queryKey: ['/api/mail', forceRefreshTrigger], // API unifiée
    enabled: !!user,
    staleTime: 0,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchInterval: 3 * 1000, // Vérification plus fréquente pour réception instantanée
    refetchIntervalInBackground: true,
    gcTime: 0, // Pas de cache pour garantir les données les plus récentes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
      const savedPinned = localStorage.getItem(`pinnedEmails_${(user as any).id}`);
      const savedFavorite = localStorage.getItem(`favoriteEmails_${(user as any).id}`);
      
      if (savedRead) setReadEmails(new Set(JSON.parse(savedRead)));
      if (savedDeleted) setDeletedEmails(new Set(JSON.parse(savedDeleted)));
      if (savedArchived) setArchivedEmails(new Set(JSON.parse(savedArchived)));
      if (savedPinned) setPinnedEmails(new Set(JSON.parse(savedPinned)));
      if (savedFavorite) setFavoriteEmails(new Set(JSON.parse(savedFavorite)));
      
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

  // Mutation pour transfert de courrier
  const forwardMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: any) => {
      console.log('Envoi transfert courrier:', { recipientEmail, message, originalEmail });
      
      const response = await fetch('/api/courrier/forward', {
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
        console.error('Erreur transfert courrier:', errorText);
        throw new Error('Erreur lors du transfert du courrier');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Courrier transféré', description: 'Le courrier a été transféré avec succès' });
      setShowForwardDialog(false);
      setForwardMessage('');
      setForwardRecipient('');
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  });

  // Mutation pour composition de nouveau courrier
  const composeMutation = useMutation({
    mutationFn: async ({ recipientEmail, subject, message }: any) => {
      console.log('Envoi nouveau courrier:', { recipientEmail, subject, message });
      
      const response = await fetch('/api/courrier/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail: recipientEmail.includes('@') ? recipientEmail.replace('@rony.com', '') : recipientEmail,
          subject,
          message,
          senderName: (user as any)?.displayName || (user as any)?.username,
          senderEmail: (user as any)?.username
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur composition courrier:', errorText);
        throw new Error('Erreur lors de l\'envoi du courrier');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Courrier envoyé', description: 'Le courrier a été envoyé avec succès' });
      setShowCompose(false);
      setComposeRecipient('');
      setComposeSubject('');
      setComposeMessage('');
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

  // Fonction universelle pour télécharger TOUS types de fichiers
  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      console.log(`[DOWNLOAD] Téléchargement de: ${fileName} depuis ${fileUrl}`);
      
      // Méthode principale avec authentification
      const response = await fetch(fileUrl, { 
        credentials: 'include',
        headers: {
          'Accept': '*/*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ 
        title: 'Téléchargement réussi', 
        description: `"${fileName}" a été téléchargé avec succès` 
      });
      
      console.log(`[DOWNLOAD] Succès: ${fileName}`);
    } catch (error) {
      console.error('[DOWNLOAD] Erreur téléchargement:', error);
      
      // Méthode de fallback: ouverture dans nouvel onglet
      try {
        window.open(fileUrl, '_blank');
        toast({ 
          title: 'Ouverture du fichier', 
          description: `"${fileName}" s'ouvre dans un nouvel onglet.`
        });
      } catch (fallbackError) {
        console.error('[DOWNLOAD] Erreur fallback:', fallbackError);
        toast({ 
          title: 'Erreur de téléchargement', 
          description: `Impossible de télécharger "${fileName}". Vérifiez votre connexion.`,
          variant: 'destructive'
        });
      }
    }
  };

  // Fonction pour explorer un dossier partagé - NOUVELLE FONCTIONNALITÉ
  const exploreFolderContents = async (folderId: number, folderName: string) => {
    try {
      console.log(`[FOLDER-EXPLORER] Exploration du dossier ID: ${folderId}, Nom: ${folderName}`);
      
      setSelectedFolderForExplorer({ id: folderId, name: folderName });
      
      // Récupérer le contenu du dossier
      const response = await fetch(`/api/folders/${folderId}/files`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FOLDER-EXPLORER] Erreur ${response.status}:`, errorText);
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
      }
      
      const contents = await response.json();
      console.log(`[FOLDER-EXPLORER] Contenu récupéré:`, contents);
      
      setFolderContents(contents.files || []);
      setShowFolderExplorer(true);
      
      toast({
        title: 'Dossier ouvert',
        description: `Exploration du dossier "${folderName}" avec ${contents.files?.length || 0} fichiers.`
      });
      
    } catch (error: any) {
      console.error('[FOLDER-EXPLORER] Erreur exploration:', error);
      toast({
        title: 'Erreur d\'exploration',
        description: `Impossible d'ouvrir le dossier "${folderName}". Erreur: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  // Fonction pour télécharger un dossier complet - VERSION AMÉLIORÉE
  const downloadFolder = async (folderId: number, folderName: string) => {
    try {
      console.log(`[FOLDER-DOWNLOAD] Téléchargement dossier ID: ${folderId}, Nom: ${folderName}`);
      
      toast({
        title: 'Téléchargement en cours...',
        description: `Préparation du téléchargement du dossier "${folderName}"`
      });
      
      // Utiliser fetch avec credentials pour l'authentification
      const response = await fetch(`/api/folders/${folderId}/download`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/zip'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
      }
      
      // Vérifier le type de contenu
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/zip')) {
        throw new Error('Le serveur n\'a pas renvoyé un fichier ZIP valide');
      }
      
      // Télécharger le blob
      const blob = await response.blob();
      
      // Créer l'URL de téléchargement
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Nettoyer
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
      
      toast({
        title: 'Téléchargement réussi',
        description: `Le dossier "${folderName}" a été téléchargé avec succès.`
      });
      
    } catch (error: any) {
      console.error('[FOLDER-DOWNLOAD] Erreur téléchargement:', error);
      toast({
        title: 'Erreur de téléchargement',
        description: `Impossible de télécharger le dossier "${folderName}". ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  // Fonctions pour gérer les actions sur les emails
  const toggleEmailSelection = (emailId: number) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const selectAllEmails = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const toggleFavorite = (emailId: number) => {
    const newFavorites = new Set(favoriteEmails);
    if (newFavorites.has(emailId)) {
      newFavorites.delete(emailId);
    } else {
      newFavorites.add(emailId);
    }
    setFavoriteEmails(newFavorites);
    try {
      localStorage.setItem(`favoriteEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newFavorites)));
    } catch (error) {
      console.error('Erreur sauvegarde favoris:', error);
    }
  };

  const togglePin = (emailId: number) => {
    const newPinned = new Set(pinnedEmails);
    if (newPinned.has(emailId)) {
      newPinned.delete(emailId);
    } else {
      newPinned.add(emailId);
    }
    setPinnedEmails(newPinned);
    try {
      localStorage.setItem(`pinnedEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newPinned)));
    } catch (error) {
      console.error('Erreur sauvegarde épinglés:', error);
    }
  };

  const archiveBulkEmails = () => {
    const newArchived = new Set(archivedEmails);
    selectedEmails.forEach(id => newArchived.add(id));
    setArchivedEmails(newArchived);
    setSelectedEmails(new Set());
    try {
      localStorage.setItem(`archivedEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newArchived)));
    } catch (error) {
      console.error('Erreur archivage bulk:', error);
    }
    toast({ title: `${selectedEmails.size} courriers archivés` });
  };

  const deleteBulkEmails = () => {
    const newDeleted = new Set(deletedEmails);
    selectedEmails.forEach(id => newDeleted.add(id));
    setDeletedEmails(newDeleted);
    setSelectedEmails(new Set());
    try {
      localStorage.setItem(`deletedEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newDeleted)));
    } catch (error) {
      console.error('Erreur suppression bulk:', error);
    }
    toast({ title: `${selectedEmails.size} courriers supprimés` });
  };

  // Filtrer et trier les emails - ORDRE CHRONOLOGIQUE STRICT
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
    // 1. Priorité aux épinglés
    if (pinnedEmails.has(a.id) && !pinnedEmails.has(b.id)) return -1;
    if (!pinnedEmails.has(a.id) && pinnedEmails.has(b.id)) return 1;
    
    // 2. FORCE TRI CHRONOLOGIQUE - Plus récents en premier OBLIGATOIRE
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
      default: // FORCER LE TRI CHRONOLOGIQUE PAR DÉFAUT
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        comparison = dateB.getTime() - dateA.getTime(); // Ordre anti-chronologique strict
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
    
    // ✅ FORCE TRI DATE : Toujours plus récents en premier
    if (sortBy === 'date' || sortBy === undefined) {
      return comparison; // dateB - dateA = anti-chronologique OBLIGATOIRE
    } else {
      return sortOrder === 'asc' ? comparison : -comparison;
    }
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
              onClick={() => setSelectMode(!selectMode)}
              variant={selectMode ? "default" : "outline"}
              size="sm"
            >
              <Check className="h-4 w-4 mr-2" />
              Sélectionner
            </Button>

            {selectMode && selectedEmails.size > 0 && (
              <DropdownMenu open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions ({selectedEmails.size})
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={archiveBulkEmails}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archiver tout
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={deleteBulkEmails}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer tout
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={selectAllEmails}>
                    <Check className="h-4 w-4 mr-2" />
                    {selectedEmails.size === filteredEmails.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
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

        {/* ✅ STATISTIQUES CORRIGÉES - Calculs précis selon données réelles */}
        <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <span>Total: {emails.filter(e => !deletedEmails.has(e.id)).length}</span>
          <span>Non lus: {emails.filter(e => !deletedEmails.has(e.id) && !readEmails.has(e.id)).length}</span>
          <span>Favoris: {emails.filter(e => favoriteEmails.has(e.id) && !deletedEmails.has(e.id)).length}</span>
          <span>Épinglés: {emails.filter(e => pinnedEmails.has(e.id) && !deletedEmails.has(e.id)).length}</span>
          <span>Archivés: {emails.filter(e => archivedEmails.has(e.id) && !deletedEmails.has(e.id)).length}</span>
          {selectMode && <span className="text-blue-600">Sélectionnés: {selectedEmails.size}</span>}
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
              // Vue compacte style Outlook avec défilement vertical
              <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
                  {filteredEmails.map((email) => (
                    <div key={email.id} className="group">
                      {/* Ligne compacte */}
                      <div
                        className={cn(
                          "flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors relative",
                          !readEmails.has(email.id) && "bg-blue-100 dark:bg-blue-900/30 border-l-4 border-l-blue-600 font-medium",
                          expandedEmail === email.id && "bg-blue-50 dark:bg-blue-900/20",
                          selectedEmails.has(email.id) && "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-800",
                          pinnedEmails.has(email.id) && "border-t-2 border-t-yellow-400"
                        )}
                        onClick={(e) => {
                          if (selectMode) {
                            e.preventDefault();
                            toggleEmailSelection(email.id);
                          } else {
                            // Marquer comme lu et ouvrir/fermer
                            markAsRead(email.id);
                            setExpandedEmail(expandedEmail === email.id ? null : email.id);
                            
                            // Si c'est un fichier, proposer le téléchargement direct
                            if (email.category === 'files' && email.attachment && expandedEmail !== email.id) {
                              // Optionnel: téléchargement automatique
                              // window.open(email.attachment.url, '_blank');
                            }
                          }
                        }}
                      >
                        {/* Checkbox de sélection ou Avatar */}
                        <div className="flex-shrink-0">
                          {selectMode ? (
                            <div className="w-8 h-8 flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedEmails.has(email.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleEmailSelection(email.id);
                                }}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {email.sender.charAt(0).toUpperCase()}
                              </div>
                              {favoriteEmails.has(email.id) && (
                                <Heart className="absolute -top-1 -right-1 w-3 h-3 text-red-500 fill-current" />
                              )}
                              {pinnedEmails.has(email.id) && (
                                <div className="absolute -top-1 -left-1 w-3 h-3 bg-yellow-400 rounded-full"></div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expéditeur avec indicateur non lu */}
                        <div className="w-32 flex-shrink-0">
                          <div className={cn(
                            "text-sm truncate flex items-center gap-2",
                            !readEmails.has(email.id) ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {email.sender}
                            {!readEmails.has(email.id) && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Non lu"></div>
                            )}
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

                        {/* Indicateurs et actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {email.hasAttachment && (
                            <Paperclip className="h-4 w-4 text-gray-400" />
                          )}
                          {favoriteEmails.has(email.id) && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                          <div className="text-xs text-gray-500 w-20 text-right">
                            <div>{email.time.substring(0, 5)}</div>
                            <div className="text-xs text-gray-400">{email.date}</div>
                          </div>
                          
                          {/* Menu trois points */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(email.id);
                                }}
                              >
                                <Heart className={cn(
                                  "h-4 w-4 mr-2",
                                  favoriteEmails.has(email.id) ? "text-red-500 fill-current" : "text-gray-400"
                                )} />
                                {favoriteEmails.has(email.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(email.id);
                                }}
                              >
                                <div className={cn(
                                  "w-4 h-4 mr-2 rounded-full",
                                  pinnedEmails.has(email.id) ? "bg-yellow-400" : "bg-gray-400"
                                )}></div>
                                {pinnedEmails.has(email.id) ? 'Désépingler' : 'Épingler'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmail(email);
                                  setShowReplyDialog(true);
                                }}
                              >
                                <Reply className="h-4 w-4 mr-2" />
                                Répondre
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmail(email);
                                  setShowForwardDialog(true);
                                }}
                              >
                                <Forward className="h-4 w-4 mr-2" />
                                Transférer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newArchived = new Set(archivedEmails);
                                  newArchived.add(email.id);
                                  setArchivedEmails(newArchived);
                                  localStorage.setItem(`archivedEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newArchived)));
                                  toast({ title: 'Courrier archivé' });
                                }}
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archiver
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newDeleted = new Set(deletedEmails);
                                  newDeleted.add(email.id);
                                  setDeletedEmails(newDeleted);
                                  localStorage.setItem(`deletedEmails_${(user as any)?.id}`, JSON.stringify(Array.from(newDeleted)));
                                  toast({ title: 'Courrier supprimé' });
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          {!selectMode && (
                            <ChevronDown className={cn(
                              "h-4 w-4 text-gray-400 transition-transform",
                              expandedEmail === email.id && "rotate-180"
                            )} />
                          )}
                        </div>
                      </div>

                      {/* Vue détaillée expandable */}
                      {expandedEmail === email.id && !selectMode && (
                        <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 border-t p-6">
                          <div className="space-y-6">
                            {/* En-tête détaillé avec style amélioré */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-medium">
                                    {email.sender.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                                      {email.subject}
                                    </h4>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      <span className="font-medium text-blue-600">{email.sender}</span> &lt;{email.senderEmail}&gt;
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                      <Clock className="w-3 h-3" />
                                      {email.date} à {email.time}
                                      {pinnedEmails.has(email.id) && (
                                        <Badge variant="outline" className="text-xs">
                                          <div className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></div>
                                          Épinglé
                                        </Badge>
                                      )}
                                      {favoriteEmails.has(email.id) && (
                                        <Badge variant="outline" className="text-xs">
                                          <Heart className="w-2 h-2 text-red-500 fill-current mr-1" />
                                          Favori
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
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

                            {/* Contenu du message avec style amélioré */}
                            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm border">
                              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {email.content}
                              </div>
                            </div>

                            {/* Pièces jointes avec design amélioré */}
                            {email.attachment && (
                              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm border">
                                <h5 className="font-medium text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                  <Paperclip className="h-4 w-4" />
                                  Pièce jointe
                                </h5>
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                                      <Paperclip className="h-6 w-6 text-white" />
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
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Prévisualiser le fichier
                                        window.open(email.attachment.url, '_blank');
                                      }}
                                      variant="outline"
                                      className="border-gray-300 hover:border-blue-500"
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Prévisualiser
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadFile(email.attachment.url, email.attachment.name);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Télécharger
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Dossiers partagés avec design amélioré */}
                            {email.folder && (
                              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm border">
                                <h5 className="font-medium text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                  <Folder className="h-4 w-4" />
                                  Dossier partagé
                                </h5>
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                      <Folder className="h-6 w-6 text-white" />
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
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Ouvrir l'explorateur de dossier
                                        exploreFolderContents(email.folder.id, email.folder.name);
                                      }}
                                      className="bg-indigo-600 hover:bg-indigo-700"
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Explorer
                                    </Button>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Télécharger le dossier complet
                                        downloadFolder(email.folder.id, email.folder.name);
                                      }}
                                      variant="outline"
                                      className="border-indigo-300 hover:border-indigo-500"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Télécharger
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Séparateur de fermeture */}
                            <div className="flex justify-center pt-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedEmail(null);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Fermer
                              </Button>
                            </div>
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

      {/* Dialog pour l'explorateur de dossiers */}
      <Dialog open={showFolderExplorer} onOpenChange={setShowFolderExplorer}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-indigo-600" />
              Explorateur de dossier: {selectedFolderForExplorer?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {folderContents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Folder className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Dossier vide</p>
                <p className="text-sm">Ce dossier ne contient aucun fichier.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">
                    {folderContents.length} fichier{folderContents.length > 1 ? 's' : ''} dans ce dossier
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFolderExplorer(false)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Fermer
                  </Button>
                </div>
                
                {/* Liste des fichiers avec défilement */}
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                  {folderContents.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {Math.round(file.size / 1024)} KB • {file.type?.split('/')[1]?.toUpperCase() || 'FICHIER'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(file.url || `/api/files/${file.id}/download`, file.name)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.url || `/api/files/${file.id}/download`, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ouvrir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Dialog pour transférer */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transférer le courrier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Email du destinataire"
              value={forwardRecipient}
              onChange={(e) => setForwardRecipient(e.target.value)}
            />
            <Textarea
              placeholder="Message d'accompagnement..."
              value={forwardMessage}
              onChange={(e) => setForwardMessage(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowForwardDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (selectedEmail && forwardRecipient.trim()) {
                    forwardMutation.mutate({
                      recipientEmail: forwardRecipient,
                      message: forwardMessage,
                      originalEmail: selectedEmail
                    });
                  }
                }}
                disabled={!forwardRecipient.trim() || forwardMutation.isPending}
              >
                {forwardMutation.isPending ? 'Envoi...' : 'Transférer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pour composer */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Destinataire"
              value={composeRecipient}
              onChange={(e) => setComposeRecipient(e.target.value)}
            />
            <Input
              placeholder="Sujet"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
            />
            <Textarea
              placeholder="Message"
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCompose(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (composeRecipient.trim() && composeSubject.trim() && composeMessage.trim()) {
                    composeMutation.mutate({
                      recipientEmail: composeRecipient,
                      subject: composeSubject,
                      message: composeMessage
                    });
                  }
                }}
                disabled={!composeRecipient.trim() || !composeSubject.trim() || !composeMessage.trim() || composeMutation.isPending}
              >
                {composeMutation.isPending ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}