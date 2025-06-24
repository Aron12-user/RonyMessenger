import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FolderPlus, 
  Search, 
  Grid3X3, 
  List, 
  Trash2,
  Download,
  Share,
  MoreVertical,
  Edit,
  RefreshCw,
  Monitor,
  AlertCircle
} from "lucide-react";

// Import des icônes personnalisées
import folderOrangeIcon from "@assets/icons8-dossier-mac-94_1750386744627.png";
import folderBlueIcon from "@assets/icons8-dossier-mac-64_1750386753922.png";
import folderArchiveIcon from "@assets/icons8-dossier-mac-48_1750386762042.png";
import imageIcon from "@assets/icons8-image-50_1750773959798.png";
import excelIcon from "@assets/icons8-microsoft-excel-2019-50_1750774269876.png";
import powerpointIcon from "@assets/icons8-ms-powerpoint-50_1750774279717.png";
import csvIcon from "@assets/icons8-fichier-csv-50_1750774291865.png";
import audioIcon from "@assets/icons8-fichier-audio-50_1750774307203.png";
import videoIcon from "@assets/icons8-fichier-vidéo-64_1750774317888.png";

// Types
interface Folder {
  id: number;
  name: string;
  path: string;
  ownerId: number;
  parentId: number | null;
  iconType: string | null;
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean;
}

interface File {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploaderId: number;
  updatedAt: Date;
  isShared: boolean;
  folderId: number | null;
  uploadedAt: Date;
}

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileType: string, fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (fileType.startsWith('image/')) {
    return <img src={imageIcon} alt="Image" className="h-8 w-8" />;
  }
  
  switch (extension) {
    case 'xlsx':
    case 'xls':
      return <img src={excelIcon} alt="Excel" className="h-8 w-8" />;
    case 'pptx':
    case 'ppt':
      return <img src={powerpointIcon} alt="PowerPoint" className="h-8 w-8" />;
    case 'csv':
      return <img src={csvIcon} alt="CSV" className="h-8 w-8" />;
    case 'mp3':
    case 'wav':
    case 'aac':
      return <img src={audioIcon} alt="Audio" className="h-8 w-8" />;
    case 'mp4':
    case 'avi':
    case 'mov':
      return <img src={videoIcon} alt="Video" className="h-8 w-8" />;
    default:
      return <img src={imageIcon} alt="File" className="h-8 w-8" />;
  }
};

const getFolderIcon = (iconType: string | null) => {
  switch (iconType) {
    case 'blue':
      return <img src={folderBlueIcon} alt="Folder" className="h-12 w-12" />;
    case 'archive':
      return <img src={folderArchiveIcon} alt="Folder" className="h-12 w-12" />;
    default:
      return <img src={folderOrangeIcon} alt="Folder" className="h-12 w-12" />;
  }
};

// API sécurisée
const secureApiRequest = async (method: string, url: string, data?: any): Promise<Response> => {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }
  
  return response;
};

export default function CloudStorage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // États
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);

  // États des dialogues
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // États pour les actions
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<string>("orange");
  const [itemToDelete, setItemToDelete] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [itemToRename, setItemToRename] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [itemToShare, setItemToShare] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareSubject, setShareSubject] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Queries
  const { data: folders = [], isLoading: foldersLoading, error: foldersError, refetch: refetchFolders } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: async () => {
      const response = await secureApiRequest('GET', `/api/folders?parentId=${currentFolderId || 'null'}`);
      return response.json();
    },
    staleTime: 30000,
    retry: 3,
    retryDelay: 1000,
  });

  const { data: files = [], isLoading: filesLoading, error: filesError, refetch: refetchFiles } = useQuery({
    queryKey: ["files", currentFolderId],
    queryFn: async () => {
      const response = await secureApiRequest('GET', `/api/files?folderId=${currentFolderId || 'null'}`);
      return response.json();
    },
    staleTime: 30000,
    retry: 3,
    retryDelay: 1000,
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId: number | null; iconType: string }) => {
      if (!folderData.name.trim()) {
        throw new Error("Le nom du dossier ne peut pas être vide");
      }
      if (folderData.name.length > 255) {
        throw new Error("Le nom du dossier est trop long (maximum 255 caractères)");
      }
      
      const response = await secureApiRequest('POST', '/api/folders', folderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      setSelectedFolderIcon("orange");
      toast({ title: "Dossier créé", description: "Le dossier a été créé avec succès." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: number; isFolder: boolean }) => {
      const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
      const response = await secureApiRequest('DELETE', endpoint);
      return response.json();
    },
    onSuccess: (_, { isFolder }) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast({ 
        title: "Supprimé", 
        description: `${isFolder ? 'Dossier' : 'Fichier'} supprimé avec succès.` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur de suppression", description: error.message, variant: "destructive" });
    }
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name, isFolder }: { id: number; name: string; isFolder: boolean }) => {
      if (!name.trim()) {
        throw new Error("Le nom ne peut pas être vide");
      }
      if (name.length > 255) {
        throw new Error("Le nom est trop long (maximum 255 caractères)");
      }
      
      const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
      const response = await secureApiRequest('PATCH', endpoint, { name: name.trim() });
      return response.json();
    },
    onSuccess: (_, { isFolder }) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setIsRenameDialogOpen(false);
      setItemToRename(null);
      setNewItemName("");
      toast({ 
        title: "Renommé", 
        description: `${isFolder ? 'Dossier' : 'Fichier'} renommé avec succès.` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur de renommage", description: error.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      if (!files.length) {
        throw new Error("Aucun fichier sélectionné");
      }

      const formData = new FormData();
      Array.from(files).forEach(file => {
        if (file.size > 100 * 1024 * 1024) {
          throw new Error(`Le fichier ${file.name} est trop volumineux (maximum 100MB)`);
        }
        formData.append('files', file);
      });
      
      if (currentFolderId) {
        formData.append('folderId', currentFolderId.toString());
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setUploadProgress(0);
      toast({ title: "Upload terminé", description: "Tous les fichiers ont été uploadés avec succès." });
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
    }
  });

  // Gestionnaires
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setOperationInProgress("upload");
      uploadMutation.mutate(files);
    }
    if (event.target) {
      event.target.value = '';
    }
  }, [uploadMutation]);

  const handleDownload = useCallback(async (file: File) => {
    try {
      setOperationInProgress(`download-${file.id}`);
      
      const downloadWindow = window.open(file.url, '_blank');
      
      if (!downloadWindow) {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      toast({ 
        title: "Téléchargement", 
        description: `Téléchargement de ${file.name} démarré` 
      });
    } catch (error) {
      toast({ 
        title: "Erreur de téléchargement", 
        description: "Impossible de télécharger le fichier", 
        variant: "destructive" 
      });
    } finally {
      setOperationInProgress(null);
    }
  }, [toast]);

  const handleDeleteItem = useCallback((id: number, name: string, isFolder: boolean) => {
    setItemToDelete({ id, name, isFolder });
    setIsDeleteDialogOpen(true);
  }, []);

  const handleRenameItem = useCallback((id: number, name: string, isFolder: boolean) => {
    setItemToRename({ id, name, isFolder });
    setNewItemName(name);
    setIsRenameDialogOpen(true);
  }, []);

  const handleShareItem = useCallback((id: number, name: string, isFolder: boolean) => {
    setItemToShare({ id, name, isFolder });
    setShareSubject(`Partage ${isFolder ? 'de dossier' : 'de fichier'} : ${name}`);
    setShareMessage(`Bonjour,\n\nJe partage avec vous ${isFolder ? 'le dossier' : 'le fichier'} "${name}".\n\nCordialement,`);
    setIsShareDialogOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    setOperationInProgress("refresh");
    Promise.all([refetchFolders(), refetchFiles()])
      .then(() => {
        toast({ title: "Actualisé", description: "Les données ont été actualisées." });
      })
      .catch(() => {
        toast({ title: "Erreur", description: "Impossible d'actualiser les données.", variant: "destructive" });
      })
      .finally(() => {
        setOperationInProgress(null);
      });
  }, [refetchFolders, refetchFiles, toast]);

  // Filtrage
  const filteredFolders = folders.filter((folder: Folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter((file: File) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Gestion des erreurs
  if (foldersError || filesError) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-4">Impossible de charger les données du Cloud.</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex-1 flex flex-col overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
          
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <Monitor className="h-8 w-8 text-blue-600" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Cloud</h2>
              {operationInProgress && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">En cours...</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col space-y-3">
              <div className="flex space-x-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  multiple 
                  accept="*/*"
                />
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex items-center space-x-2"
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="h-4 w-4" />
                  <span>{uploadMutation.isPending ? "Upload..." : "Upload Files"}</span>
                </Button>
                
                <Button
                  onClick={() => setIsCreateFolderDialogOpen(true)}
                  className="flex items-center space-x-2"
                  disabled={createFolderMutation.isPending}
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>Nouveau Dossier</span>
                </Button>
                
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="icon"
                  disabled={operationInProgress === "refresh"}
                >
                  <RefreshCw className={`h-4 w-4 ${operationInProgress === "refresh" ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Barre de recherche et contrôles */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Rechercher des fichiers et dossiers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Indicateur de progression */}
          {uploadMutation.isPending && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Upload en cours...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Zone de contenu principal */}
          <div className="flex-1 overflow-y-auto">
            {(foldersLoading || filesLoading) ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-lg">Chargement...</span>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Grille des dossiers */}
                {filteredFolders.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <FolderPlus className="h-5 w-5 mr-2" />
                      Dossiers ({filteredFolders.length})
                    </h3>
                    <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1'}`}>
                      {filteredFolders.map((folder: Folder) => (
                        <div 
                          key={folder.id}
                          className="group border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-gray-800"
                          onDoubleClick={() => setCurrentFolderId(folder.id)}
                        >
                          <div className="flex flex-col items-center text-center space-y-2">
                            {getFolderIcon(folder.iconType)}
                            <div className="w-full">
                              <p className="font-medium text-sm truncate" title={folder.name}>
                                {folder.name}
                              </p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-gray-500">
                                  Dossier
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRenameItem(folder.id, folder.name, true);
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Renommer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleShareItem(folder.id, folder.name, true);
                                      }}
                                    >
                                      <Share className="mr-2 h-4 w-4" />
                                      Partager
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteItem(folder.id, folder.name, true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grille des fichiers */}
                {filteredFiles.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <Upload className="h-5 w-5 mr-2" />
                      Fichiers ({filteredFiles.length})
                    </h3>
                    <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-1'}`}>
                      {filteredFiles.map((file: File) => (
                        <div 
                          key={file.id}
                          className="group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-all bg-white dark:bg-gray-800"
                        >
                          <div className="h-20 bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-2">
                            {file.type.startsWith('image/') ? (
                              <img src={file.url} alt={file.name} className="h-12 w-12 object-cover rounded" />
                            ) : (
                              getFileIcon(file.type, file.name)
                            )}
                          </div>
                          <div className="p-3">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-medium text-sm truncate flex-1" title={file.name}>
                                {file.name}
                              </h4>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(file);
                                    }}
                                    disabled={operationInProgress === `download-${file.id}`}
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    {operationInProgress === `download-${file.id}` ? "Téléchargement..." : "Télécharger"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameItem(file.id, file.name, false);
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Renommer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleShareItem(file.id, file.name, false);
                                    }}
                                  >
                                    <Share className="mr-2 h-4 w-4" />
                                    Partager
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteItem(file.id, file.name, false);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message si aucun élément */}
                {filteredFolders.length === 0 && filteredFiles.length === 0 && !foldersLoading && !filesLoading && (
                  <div className="text-center py-12">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {searchTerm ? "Aucun élément trouvé pour cette recherche." : "Ce dossier est vide."}
                    </p>
                    {!searchTerm && (
                      <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Commencer par uploader des fichiers
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogues */}
      
      {/* Dialogue de création de dossier */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau dossier</DialogTitle>
            <DialogDescription>
              Choisissez un nom et une icône pour votre nouveau dossier.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom du dossier</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Entrez le nom du dossier"
                className="w-full"
                maxLength={255}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    createFolderMutation.mutate({
                      name: newFolderName.trim(),
                      parentId: currentFolderId,
                      iconType: selectedFolderIcon
                    });
                  }
                }}
              />
              {newFolderName.length > 200 && (
                <p className="text-xs text-orange-500 mt-1">
                  {255 - newFolderName.length} caractères restants
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-3 block">Choisir une icône</label>
              <div className="flex gap-4 justify-center">
                {[
                  { type: "orange", icon: folderOrangeIcon, label: "Orange" },
                  { type: "blue", icon: folderBlueIcon, label: "Bleu" },
                  { type: "archive", icon: folderArchiveIcon, label: "Archive" }
                ].map((iconOption) => (
                  <div
                    key={iconOption.type}
                    className={`cursor-pointer p-2 rounded-lg border-2 transition-all ${
                      selectedFolderIcon === iconOption.type
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedFolderIcon(iconOption.type)}
                  >
                    <img src={iconOption.icon} alt={iconOption.label} className="h-12 w-12" />
                    <p className="text-xs text-center mt-1">{iconOption.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (newFolderName.trim()) {
                  createFolderMutation.mutate({
                    name: newFolderName.trim(),
                    parentId: currentFolderId,
                    iconType: selectedFolderIcon
                  });
                }
              }}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de suppression */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {itemToDelete?.isFolder ? 'le dossier' : 'le fichier'} "{itemToDelete?.name}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (itemToDelete) {
                  deleteMutation.mutate(itemToDelete);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de renommage */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer {itemToRename?.isFolder ? "le dossier" : "le fichier"}</DialogTitle>
            <DialogDescription>
              Entrez le nouveau nom pour {itemToRename?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Nouveau nom"
              className="w-full"
              maxLength={255}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newItemName.trim() && itemToRename) {
                  renameMutation.mutate({
                    id: itemToRename.id,
                    name: newItemName.trim(),
                    isFolder: itemToRename.isFolder
                  });
                }
              }}
            />
            {newItemName.length > 200 && (
              <p className="text-xs text-orange-500 mt-1">
                {255 - newItemName.length} caractères restants
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (newItemName.trim() && itemToRename) {
                  renameMutation.mutate({
                    id: itemToRename.id,
                    name: newItemName.trim(),
                    isFolder: itemToRename.isFolder
                  });
                }
              }}
              disabled={!newItemName.trim() || renameMutation.isPending || newItemName.trim() === itemToRename?.name}
            >
              {renameMutation.isPending ? "Renommage..." : "Renommer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de partage */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partager {itemToShare?.isFolder ? "le dossier" : "le fichier"}</DialogTitle>
            <DialogDescription>
              Entrez l'adresse email Rony du destinataire.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Destinataire</label>
              <Input
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="nom@rony.com"
                type="email"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sujet</label>
              <Input
                value={shareSubject}
                onChange={(e) => setShareSubject(e.target.value)}
                placeholder="Sujet du message"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Message</label>
              <textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder="Votre message..."
                className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (shareEmail.trim() && shareSubject.trim() && itemToShare) {
                  toast({ title: "Partage envoyé", description: "Le message a été envoyé avec succès." });
                  setIsShareDialogOpen(false);
                  setItemToShare(null);
                  setShareEmail("");
                  setShareSubject("");
                  setShareMessage("");
                }
              }}
              disabled={!shareEmail.trim() || !shareSubject.trim()}
            >
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}