import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Reply, 
  Forward, 
  ChevronDown, 
  Paperclip, 
  Search,
  Filter,
  Archive,
  Trash2,
  Star,
  MoreHorizontal,
  Download,
  Eye,
  FolderOpen,
  FileText,
  Image,
  Video,
  Music,
  Package,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SharedFile {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploaderId: number;
  uploadedAt: string;
  sharedBy?: {
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
  sharedBy?: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface EmailItem {
  id: number;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  date: string;
  hasAttachment: boolean;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  priority: 'high' | 'medium' | 'low';
  category: 'files' | 'folders' | 'documents' | 'media';
  attachment?: SharedFile;
  folder?: SharedFolder;
}

export default function MailPage() {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'files' | 'folders' | 'documents' | 'media'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sharedData, isLoading } = useQuery<{files: SharedFile[], folders: SharedFolder[]}>({
    queryKey: ['/api/files/shared'],
  });

  const sharedFiles = sharedData?.files || [];
  const sharedFolders = sharedData?.folders || [];

  // Fonction pour déterminer la catégorie d'un fichier
  function getFileCategory(type: string): 'files' | 'folders' | 'documents' | 'media' {
    if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
      return 'media';
    }
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) {
      return 'documents';
    }
    return 'files';
  }

  // Transformer les fichiers et dossiers partagés en emails
  const fileEmails: EmailItem[] = sharedFiles?.map((file, index) => {
    const senderName = file.sharedBy?.displayName || 'Utilisateur inconnu';
    const senderEmail = file.sharedBy?.username || 'user@rony.com';
    
    return {
      id: file.id,
      sender: senderName,
      senderEmail: senderEmail,
      subject: `Partage de fichier: ${file.name}`,
      preview: `${senderName} a partagé un fichier avec vous`,
      date: new Date(file.uploadedAt).toLocaleDateString('fr-FR'),
      hasAttachment: true,
      isRead: index > 0,
      isStarred: Math.random() > 0.7,
      isArchived: false,
      priority: index === 0 ? 'high' : 'medium',
      category: getFileCategory(file.type),
      attachment: file
    };
  }) || [];

  const folderEmails: EmailItem[] = sharedFolders.map((folder, index) => {
    const senderName = folder.sharedBy?.displayName || 'Utilisateur inconnu';
    const senderEmail = folder.sharedBy?.username || 'user@rony.com';
    
    return {
      id: folder.id + 1000,
      sender: senderName,
      senderEmail: senderEmail,
      subject: `Partage de dossier: ${folder.name}`,
      preview: `${senderName} a partagé un dossier contenant ${folder.fileCount} fichiers`,
      date: new Date(folder.uploadedAt).toLocaleDateString('fr-FR'),
      hasAttachment: true,
      isRead: index > 0,
      isStarred: Math.random() > 0.8,
      isArchived: false,
      priority: 'high',
      category: 'folders',
      folder: folder
    };
  });

  const allEmails = [...fileEmails, ...folderEmails].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filtrer les emails
  const filteredEmails = allEmails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.sender.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || email.category === filterCategory;
    const matchesArchived = showArchived ? email.isArchived : !email.isArchived;
    return matchesSearch && matchesCategory && matchesArchived;
  });

  // Mutations pour les actions
  const starMutation = useMutation({
    mutationFn: async (emailId: number) => {
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: 'Email marqué comme favori' });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (emailId: number) => {
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: 'Email archivé' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (emailId: number) => {
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: 'Email supprimé' });
    }
  });

  // Actions
  const handleStarEmail = (emailId: number) => {
    starMutation.mutate(emailId);
  };

  const handleArchiveEmail = (emailId: number) => {
    archiveMutation.mutate(emailId);
  };

  const handleDeleteEmail = (emailId: number) => {
    deleteMutation.mutate(emailId);
  };

  const handleDownload = (item: SharedFile | SharedFolder) => {
    if ('url' in item) {
      window.open(item.url, '_blank');
      toast({ title: `Téléchargement de ${item.name}` });
    } else {
      toast({ title: `Téléchargement du dossier ${item.name} en cours...` });
    }
  };

  const handlePreview = (item: SharedFile | SharedFolder) => {
    if ('url' in item && (item.type.startsWith('image/') || item.type === 'application/pdf')) {
      window.open(item.url, '_blank');
    } else {
      toast({ title: 'Aperçu non disponible pour ce type de contenu' });
    }
  };

  // Fonction pour obtenir l'icône selon le type
  const getItemIcon = (item: SharedFile | SharedFolder) => {
    if ('fileCount' in item) {
      return <FolderOpen className="w-5 h-5 text-blue-500" />;
    }
    
    const type = item.type;
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-purple-500" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (type.includes('zip') || type.includes('rar')) return <Package className="w-5 h-5 text-orange-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'Ko', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white">
        <div className="animate-pulse p-4">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Barre d'outils moderne */}
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
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
                  Filtrer
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterCategory('all')}>
                  Tous les éléments
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
                  Médias
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {filteredEmails.length} éléments
            </Badge>
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

        {/* Onglets de catégories */}
        <Tabs value={filterCategory} onValueChange={(value) => setFilterCategory(value as any)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="files">Fichiers</TabsTrigger>
            <TabsTrigger value="folders">Dossiers</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="media">Médias</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Header avec colonnes */}
      <div className="border-b px-4 py-2 bg-gray-50">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <div className="w-48 flex-shrink-0">De</div>
          <div className="flex-1">Objet</div>
          <div className="w-32 flex items-center justify-end">
            <span>Reçu</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>

      {/* Liste des emails */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className={cn(
                  "px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-4 transition-all duration-200",
                  !email.isRead ? "bg-blue-50 border-l-blue-500 font-medium" : "border-l-transparent",
                  selectedEmail?.id === email.id && "bg-blue-100 shadow-sm",
                  email.priority === 'high' && "border-r-2 border-r-red-400"
                )}
                onClick={() => setSelectedEmail(email)}
              >
                <div className="flex items-center">
                  {/* Avatar et expéditeur */}
                  <div className="w-48 flex-shrink-0 flex items-center space-x-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      email.category === 'folders' ? "bg-blue-200" : "bg-orange-200"
                    )}>
                      <span className={cn(
                        "text-sm font-medium",
                        email.category === 'folders' ? "text-blue-800" : "text-orange-800"
                      )}>
                        {email.sender.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 truncate block">
                        {email.sender}
                      </span>
                      {email.isStarred && (
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      )}
                    </div>
                  </div>

                  {/* Objet et aperçu avec pièce jointe */}
                  <div className="flex-1 min-w-0 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-900 truncate flex-1">
                        {email.subject}
                      </span>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {email.priority === 'high' && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        {email.hasAttachment && (
                          <Paperclip className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 truncate mt-1">
                      {email.preview}
                    </div>
                    {(email.attachment || email.folder) && (
                      <div className="mt-2 flex items-center space-x-2">
                        {email.attachment && (
                          <div className="flex items-center space-x-1">
                            {getItemIcon(email.attachment)}
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              {email.attachment.name}
                            </span>
                          </div>
                        )}
                        {email.folder && (
                          <div className="flex items-center space-x-1">
                            <FolderOpen className="w-4 h-4 text-blue-500" />
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {email.folder.name} ({email.folder.fileCount} fichiers)
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Date et actions */}
                  <div className="w-32 flex items-center justify-between flex-shrink-0">
                    <div className="text-sm text-gray-500">
                      {email.date}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleStarEmail(email.id)}>
                          <Star className="w-4 h-4 mr-2" />
                          {email.isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchiveEmail(email.id)}>
                          <Archive className="w-4 h-4 mr-2" />
                          Archiver
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteEmail(email.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau de lecture d'email sélectionné amélioré */}
        {selectedEmail && (
          <div className="border-t bg-white shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    selectedEmail.category === 'folders' ? "bg-blue-500" : "bg-orange-500"
                  )}>
                    <span className="text-white font-medium">
                      {selectedEmail.sender.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedEmail.sender}
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedEmail.senderEmail}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center space-x-2 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>Ven {selectedEmail.date} 11:06</span>
                      {selectedEmail.priority === 'high' && (
                        <Badge variant="destructive" className="text-xs">
                          Priorité élevée
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedEmail.isStarred && (
                    <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  )}
                </div>
              </div>

              {/* Contenu de l'email */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {selectedEmail.subject}
                </h3>
                <p className="text-gray-700">
                  Bonne réception
                </p>
              </div>

              {/* Pièce jointe ou dossier */}
              {(selectedEmail.attachment || selectedEmail.folder) && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    {selectedEmail.folder ? 'Dossier partagé' : 'Pièce jointe'}
                  </h4>
                  <div className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    {selectedEmail.attachment && (
                      <>
                        {getItemIcon(selectedEmail.attachment)}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {selectedEmail.attachment.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatFileSize(selectedEmail.attachment.size)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePreview(selectedEmail.attachment!)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Aperçu
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleDownload(selectedEmail.attachment!)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Télécharger
                          </Button>
                        </div>
                      </>
                    )}
                    {selectedEmail.folder && (
                      <>
                        <FolderOpen className="w-8 h-8 text-blue-500" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {selectedEmail.folder.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {selectedEmail.folder.fileCount} fichiers • {formatFileSize(selectedEmail.folder.totalSize)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePreview(selectedEmail.folder!)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Explorer
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleDownload(selectedEmail.folder!)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Télécharger
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-3 pt-4 border-t">
                <Button variant="outline">
                  <Reply className="w-4 h-4 mr-2" />
                  Répondre
                </Button>
                <Button variant="outline">
                  <Forward className="w-4 h-4 mr-2" />
                  Transférer
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleArchiveEmail(selectedEmail.id)}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archiver
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleStarEmail(selectedEmail.id)}
                >
                  <Star className="w-4 h-4 mr-2" />
                  {selectedEmail.isStarred ? 'Retirer des favoris' : 'Marquer comme favori'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}