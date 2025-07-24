import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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

export default function MailPage() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'files' | 'folders' | 'documents' | 'media'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [showEmailReader, setShowEmailReader] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'sender' | 'subject'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPreview, setShowPreview] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [pinnedEmails, setPinnedEmails] = useState<Set<number>>(new Set());
  const [readEmails, setReadEmails] = useState<Set<number>>(new Set());
  
  // États pour les dialogs
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwardRecipient, setForwardRecipient] = useState('');

  const queryClient = useQueryClient();

  // Récupérer l'utilisateur connecté
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 5 * 60 * 1000,
  });

  // Récupérer les fichiers et dossiers partagés
  const { data: sharedData, refetch } = useQuery({
    queryKey: ['/api/files/shared'],
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const sharedFiles = (sharedData as any)?.files || [];
  const sharedFolders = (sharedData as any)?.folders || [];

  // Convertir les fichiers/dossiers partagés en emails
  useEffect(() => {
    if (!user) return;

    const emailsFromFiles = sharedFiles.map((file: any) => ({
      id: file.id + 10000,
      sender: file.sharedBy.displayName || file.sharedBy.username,
      senderEmail: file.sharedBy.username.replace('@rony.com', '') + '@rony.com',
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

    const emailsFromFolders = sharedFolders.map((folder: any) => ({
      id: folder.id + 20000,
      sender: folder.sharedBy.displayName || folder.sharedBy.username,
      senderEmail: folder.sharedBy.username.replace('@rony.com', '') + '@rony.com',
      subject: `Dossier partagé: ${folder.name}`,
      content: `${folder.sharedBy.displayName || folder.sharedBy.username} a partagé le dossier "${folder.name}" avec vous.`,
      preview: `Dossier: ${folder.name} (${folder.fileCount || 0} fichiers)`,
      date: new Date(folder.uploadedAt).toLocaleDateString(),
      time: new Date(folder.uploadedAt).toLocaleTimeString(),
      hasAttachment: true,
      priority: 'medium' as const,
      category: 'folders' as const,
      folder: folder
    }));

    const allEmails = [...emailsFromFiles, ...emailsFromFolders];
    setEmails(allEmails);
  }, [user, sharedFiles, sharedFolders]);

  // Mutations pour les actions sur les emails
  const replyMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: any) => {
      const response = await fetch('/api/courrier/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail: recipientEmail.includes('@') ? recipientEmail.split('@')[0] : recipientEmail,
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: (user as any)?.displayName || (user as any)?.username,
          senderEmail: (user as any)?.username
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la réponse');
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

  const forwardMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: any) => {
      const response = await fetch('/api/courrier/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail: recipientEmail.includes('@') ? recipientEmail.split('@')[0] : recipientEmail,
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: (user as any)?.displayName || (user as any)?.username,
          senderEmail: (user as any)?.username
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du transfert');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Message transféré', description: 'Le message a été transféré avec succès' });
      setShowForwardDialog(false);
      setForwardMessage('');
      setForwardRecipient('');
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  });

  const exploreFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const response = await fetch(`/api/files/folder/${folderId}/files`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'exploration du dossier');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setFolderFiles(data.files || []);
      setShowFolderExplorer(true);
    },
    onError: (error: any) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  });

  const downloadFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const response = await fetch(`/api/folders/${folderId}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `folder-${folderId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    },
    onSuccess: () => {
      toast({ title: 'Téléchargement démarré', description: 'Le dossier est en cours de téléchargement' });
    },
    onError: () => {
      toast({ title: 'Erreur téléchargement', description: 'Impossible de télécharger le dossier', variant: 'destructive' });
    }
  });

  // Mutation pour archiver des emails
  const archiveEmailsMutation = useMutation({
    mutationFn: async (emailIds: number[]) => {
      // Simuler l'archivage en local pour l'instant
      return new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      toast({ title: 'Messages archivés', description: 'Les messages ont été archivés avec succès' });
      setSelectedEmails(new Set());
    },
    onError: () => {
      toast({ title: 'Erreur archivage', description: 'Impossible d\'archiver les messages', variant: 'destructive' });
    }
  });

  // Mutation pour supprimer des emails
  const deleteEmailsMutation = useMutation({
    mutationFn: async (emailIds: number[]) => {
      // Simuler la suppression en local pour l'instant
      return new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: (_, emailIds) => {
      // Retirer les emails supprimés de la liste
      setEmails(prev => prev.filter(email => !emailIds.includes(email.id)));
      setSelectedEmails(new Set());
      toast({ title: 'Messages supprimés', description: 'Les messages ont été supprimés avec succès' });
    },
    onError: () => {
      toast({ title: 'Erreur suppression', description: 'Impossible de supprimer les messages', variant: 'destructive' });
    }
  });

  // Fonctions utilitaires
  const markAsRead = (emailId: number) => {
    setReadEmails(prev => new Set([...prev, emailId]));
  };

  const togglePin = (emailId: number) => {
    setPinnedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const toggleEmailSelection = (emailId: number) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const selectAllEmails = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map(email => email.id)));
    }
  };

  // Filtrer et trier les emails
  const filteredEmails = emails
    .filter(email => {
      const matchesSearch = !searchQuery || 
        email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || email.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'sender':
          comparison = a.sender.localeCompare(b.sender);
          break;
        case 'subject':
          comparison = a.subject.localeCompare(b.subject);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    })
    .sort((a, b) => {
      // Les épinglés en premier
      const aPinned = pinnedEmails.has(a.id);
      const bPinned = pinnedEmails.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connexion requise</h3>
          <p className="text-gray-600">Veuillez vous connecter pour accéder à votre courrier</p>
        </div>
      </div>
    );
  }

  // Vue de lecture d'email - interface étroite comme Gmail
  if (showEmailReader && selectedEmail) {
    return (
      <div className="h-screen flex bg-gray-50">
        <div className="flex-1 flex justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm border">
            {/* Header de lecture */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between mb-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowEmailReader(false)}
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Retour</span>
                </Button>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowReplyDialog(true);
                      setShowEmailReader(false);
                    }}
                  >
                    <Reply className="w-4 h-4 mr-1" />
                    Répondre
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowForwardDialog(true);
                      setShowEmailReader(false);
                    }}
                  >
                    <Forward className="w-4 h-4 mr-1" />
                    Transférer
                  </Button>
                </div>
              </div>
              
              <h1 className="text-xl font-semibold mb-2">{selectedEmail.subject}</h1>
              
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">
                      {selectedEmail.sender.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{selectedEmail.sender}</div>
                    <div className="text-xs text-gray-500">{selectedEmail.senderEmail}</div>
                  </div>
                </div>
                <div className="ml-auto">
                  <div>{selectedEmail.date} à {selectedEmail.time}</div>
                </div>
              </div>
            </div>

            {/* Contenu du message */}
            <div className="p-6">
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed">
                  {selectedEmail.content}
                </p>
              </div>

              {/* Pièces jointes */}
              {(selectedEmail.attachment || selectedEmail.folder) && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <Paperclip className="w-4 h-4 mr-2" />
                    Pièces jointes
                  </h3>
                  
                  {selectedEmail.attachment && (
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                          <span className="text-blue-600 text-xs font-bold">
                            {selectedEmail.attachment.name.split('.').pop()?.toUpperCase() || 'FILE'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-sm">{selectedEmail.attachment.name}</div>
                          <div className="text-xs text-gray-500">
                            {(selectedEmail.attachment.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(selectedEmail.attachment.url, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Voir
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedEmail.attachment.url;
                            link.download = selectedEmail.attachment.name;
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
                  )}

                  {selectedEmail.folder && (
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                          <Folder className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{selectedEmail.folder.name}</div>
                          <div className="text-xs text-gray-500">
                            {selectedEmail.folder.fileCount || 0} fichiers
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedFolder(selectedEmail.folder);
                            exploreFolderMutation.mutate(selectedEmail.folder.id);
                          }}
                        >
                          <FolderOpen className="w-4 h-4 mr-1" />
                          Explorer
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => downloadFolderMutation.mutate(selectedEmail.folder.id)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Télécharger
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header amélioré */}
      <div className="bg-gradient-to-r from-blue-100 to-blue-200 border-b shadow-sm">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-white/40 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-blue-800">Courrier</h1>
                  <p className="text-blue-600 text-xs">Messages et partages</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="text-blue-700 hover:bg-white/30 border-blue/20 text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Actualiser
                </Button>
                
                <Badge variant="secondary" className="bg-white/40 text-blue-700 border-blue/20 text-xs">
                  {filteredEmails.length} messages
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Barre de recherche améliorée */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher messages, expéditeurs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80 bg-white/80 border-blue/20 focus:bg-white text-sm"
                />
              </div>
              
              {/* Boutons de contrôle */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-blue-700 hover:bg-white/30 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  {showPreview ? 'Masquer' : 'Aperçu'}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-white/30 text-xs">
                      <Settings className="w-3 h-3 mr-1" />
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
                      {viewMode === 'list' ? '🔲 Vue grille' : '📋 Vue liste'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSortBy('date')}>
                      <Clock className="w-4 h-4 mr-2" />
                      Trier par date
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('sender')}>
                      <User className="w-4 h-4 mr-2" />
                      Trier par expéditeur
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('subject')}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Trier par sujet
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                      {sortOrder === 'asc' ? '⬇️ Décroissant' : '⬆️ Croissant'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        
        {/* Barre de filtres */}
        <div className="px-4 py-2 bg-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-white/30 text-xs">
                    <Filter className="w-4 h-4 mr-2" />
                    {filterCategory === 'all' ? 'Tous les types' : 
                     filterCategory === 'files' ? 'Fichiers' :
                     filterCategory === 'folders' ? 'Dossiers' :
                     filterCategory === 'documents' ? 'Documents' : 'Médias'}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilterCategory('all')}>
                    <Mail className="w-4 h-4 mr-2" />
                    Tous les messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterCategory('files')}>
                    <Paperclip className="w-4 h-4 mr-2" />
                    Fichiers partagés
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterCategory('folders')}>
                    <Folder className="w-4 h-4 mr-2" />
                    Dossiers partagés
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterCategory('documents')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Documents
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterCategory('media')}>
                    <Eye className="w-4 h-4 mr-2" />
                    Médias
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className={cn(
                  "text-blue-700 hover:bg-white/30 text-xs",
                  showArchived && "bg-white/30"
                )}
              >
                <Archive className="w-4 h-4 mr-2" />
                {showArchived ? 'Masquer archivés' : 'Archivés'}
              </Button>
            </div>

            {/* Actions en lot */}
            {selectedEmails.size > 0 && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-white/30 text-blue-700 text-xs">
                  {selectedEmails.size} sélectionné{selectedEmails.size > 1 ? 's' : ''}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-700 hover:bg-white/30 text-xs"
                  onClick={() => archiveEmailsMutation.mutate(Array.from(selectedEmails))}
                  disabled={archiveEmailsMutation.isPending}
                >
                  <Archive className="w-3 h-3 mr-1" />
                  {archiveEmailsMutation.isPending ? 'Archivage...' : 'Archiver'}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-700 hover:bg-white/30 text-xs"
                  onClick={() => deleteEmailsMutation.mutate(Array.from(selectedEmails))}
                  disabled={deleteEmailsMutation.isPending}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  {deleteEmailsMutation.isPending ? 'Suppression...' : 'Supprimer'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre d'outils et statistiques */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
                  onChange={selectAllEmails}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">
                  {selectedEmails.size > 0 
                    ? `${selectedEmails.size} sélectionné${selectedEmails.size > 1 ? 's' : ''}` 
                    : `${filteredEmails.length} message${filteredEmails.length !== 1 ? 's' : ''}`
                  }
                  {searchQuery && ` pour "${searchQuery}"`}
                  {filterCategory !== 'all' && ` • ${filterCategory}`}
                </span>
              </div>

              {/* Statistiques détaillées */}
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                  {emails.filter(e => !readEmails.has(e.id)).length} non lus
                </span>
                <span className="flex items-center">
                  <Star className="w-3 h-3 text-yellow-500 mr-1" />
                  {pinnedEmails.size} épinglés
                </span>
                <span className="flex items-center">
                  <Paperclip className="w-3 h-3 text-gray-400 mr-1" />
                  {emails.filter(e => e.hasAttachment).length} avec pièces jointes
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEmails(new Set())}
                disabled={selectedEmails.size === 0}
              >
                <X className="w-4 h-4 mr-1" />
                Désélectionner
              </Button>
              
              <div className="text-xs text-gray-500">
                Dernière mise à jour: {new Date().toLocaleTimeString()}
              </div>
            </div>
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
            filteredEmails.map((email) => (
              <div
                key={email.id}
                className={cn(
                  "border-b border-gray-100 transition-all duration-200 group relative",
                  "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50",
                  !readEmails.has(email.id) && "bg-blue-50/30 border-l-4 border-l-blue-500",
                  pinnedEmails.has(email.id) && "bg-yellow-50/50 border-l-4 border-l-yellow-500",
                  selectedEmails.has(email.id) && "bg-blue-100 ring-2 ring-blue-500",
                  "cursor-pointer"
                )}
                onClick={() => {
                  markAsRead(email.id);
                  setSelectedEmail(email);
                  setShowEmailReader(true);
                }}
              >
                <div className="p-2">
                  <div className="flex items-start space-x-2">
                    {/* Checkbox de sélection */}
                    <div className="flex items-center space-x-2 pt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(email.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleEmailSelection(email.id);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      
                      {/* Bouton épingler */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(email.id);
                        }}
                        className={cn(
                          "p-1 rounded transition-colors opacity-0 group-hover:opacity-100",
                          pinnedEmails.has(email.id) 
                            ? "text-yellow-500 opacity-100" 
                            : "text-gray-400 hover:text-yellow-500"
                        )}
                      >
                        <Star className={cn("w-4 h-4", pinnedEmails.has(email.id) && "fill-current")} />
                      </button>
                    </div>

                    {/* Avatar amélioré */}
                    <div className="relative">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm",
                        email.category === 'folders' 
                          ? "bg-gradient-to-br from-blue-500 to-blue-600" 
                          : email.category === 'files'
                          ? "bg-gradient-to-br from-green-500 to-green-600"
                          : email.category === 'media'
                          ? "bg-gradient-to-br from-purple-500 to-purple-600"
                          : "bg-gradient-to-br from-orange-500 to-orange-600"
                      )}>
                        <span>
                          {email.sender.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                      </div>
                      
                      {/* Indicateur de priorité */}
                      {email.priority === 'high' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <AlertCircle className="w-2 h-2 text-white" />
                        </div>
                      )}
                      
                      {/* Indicateur non lu */}
                      {!readEmails.has(email.id) && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                      )}
                    </div>

                    {/* Contenu principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "text-gray-900 truncate max-w-xs",
                            !readEmails.has(email.id) ? "font-bold" : "font-medium"
                          )}>
                            {email.sender}
                          </span>
                          
                          {email.hasAttachment && (
                            <Paperclip className="w-4 h-4 text-gray-400" />
                          )}
                          
                          {/* Badge de catégorie */}
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs px-2 py-0.5",
                              email.category === 'files' && "bg-green-50 text-green-700 border-green-200",
                              email.category === 'folders' && "bg-blue-50 text-blue-700 border-blue-200",
                              email.category === 'media' && "bg-purple-50 text-purple-700 border-purple-200",
                              email.category === 'documents' && "bg-orange-50 text-orange-700 border-orange-200"
                            )}
                          >
                            {email.category === 'files' && <Paperclip className="w-3 h-3 mr-1" />}
                            {email.category === 'folders' && <Folder className="w-3 h-3 mr-1" />}
                            {email.category === 'media' && <Eye className="w-3 h-3 mr-1" />}
                            {email.category === 'documents' && <MessageSquare className="w-3 h-3 mr-1" />}
                            {email.category === 'files' ? 'Fichier' :
                             email.category === 'folders' ? 'Dossier' :
                             email.category === 'media' ? 'Média' : 'Document'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{email.time}</span>
                          <span>{email.date}</span>
                        </div>
                      </div>
                      
                      <h3 className={cn(
                        "text-sm mb-2 truncate",
                        !readEmails.has(email.id) ? "font-bold text-gray-900" : "font-medium text-gray-800"
                      )}>
                        {email.subject}
                      </h3>
                      
                      {showPreview && (
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {email.content}
                        </p>
                      )}

                      {/* Badges et statuts */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2">
                          {!readEmails.has(email.id) && (
                            <Badge variant="default" className="text-xs bg-blue-600 text-white">
                              Nouveau
                            </Badge>
                          )}
                          
                          {pinnedEmails.has(email.id) && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                              <Star className="w-3 h-3 mr-1 fill-current" />
                              Épinglé
                            </Badge>
                          )}
                        </div>

                        {/* Actions rapides */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmail(email);
                              setShowReplyDialog(true);
                            }}
                          >
                            <Reply className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmail(email);
                              setShowForwardDialog(true);
                            }}
                          >
                            <Forward className="w-4 h-4" />
                          </Button>
                          
                          {email.folder && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFolder(email.folder);
                                exploreFolderMutation.mutate(email.folder.id);
                              }}
                            >
                              <FolderOpen className="w-4 h-4" />
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(email.id);
                              }}>
                                <Check className="w-4 h-4 mr-2" />
                                Marquer comme lu
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                togglePin(email.id);
                              }}>
                                <Star className="w-4 h-4 mr-2" />
                                {pinnedEmails.has(email.id) ? 'Désépingler' : 'Épingler'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                archiveEmailsMutation.mutate([email.id]);
                              }}>
                                <Archive className="w-4 h-4 mr-2" />
                                Archiver
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteEmailsMutation.mutate([email.id]);
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
                  </div>
                </div>
              </div>
            ))
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