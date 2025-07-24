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

  const sharedFiles = sharedData?.files || [];
  const sharedFolders = sharedData?.folders || [];

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
          recipientEmail: recipientEmail.replace('@rony.com', ''),
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: user?.displayName || user?.username,
          senderEmail: user?.username.replace('@rony.com', '') + '@rony.com'
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
          recipientEmail: recipientEmail.replace('@rony.com', ''),
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: user?.displayName || user?.username,
          senderEmail: user?.username.replace('@rony.com', '') + '@rony.com'
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

  // Filtrer les emails selon les critères
  const filteredEmails = emails.filter(email => {
    const matchesSearch = !searchQuery || 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || email.category === filterCategory;
    
    return matchesSearch && matchesCategory;
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
            <span>{filteredEmails.length} total</span>
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
                className="border-b border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-blue-50 hover:bg-blue-100"
                onClick={() => {
                  setSelectedEmail(email);
                  setShowEmailReader(true);
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
                          <span className="font-medium text-gray-900">
                            {email.sender}
                          </span>
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
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
                      
                      <h3 className="text-sm mb-1 truncate font-semibold text-gray-900">
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
                        <Badge variant="default" className="text-xs bg-blue-600">
                          Nouveau
                        </Badge>
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
                            setSelectedFolder(email.folder);
                            exploreFolderMutation.mutate(email.folder.id);
                          }}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Explorer le dossier
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          // Archiver logic ici
                        }}>
                          <Archive className="w-4 h-4 mr-2" />
                          Archiver
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Supprimer logic ici
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