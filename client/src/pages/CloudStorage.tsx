import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Upload, 
  FolderPlus, 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  ChevronRight,
  ChevronLeft,
  Trash2,
  Download,
  Share,
  MoreVertical,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  Edit
} from "lucide-react";

// Import des icônes personnalisées et de l'arrière-plan
import folderOrangeIcon from "@assets/icons8-dossier-mac-94_1750386744627.png";
import folderBlueIcon from "@assets/icons8-dossier-mac-64_1750386753922.png";
import folderArchiveIcon from "@assets/icons8-dossier-mac-48_1750386762042.png";
import cloudBackgroundImage from "@assets/image_1750395141900.png";

interface Folder {
  id: number;
  name: string;
  path: string;
  ownerId: number;
  parentId: number | null;
  iconType: string | null;
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean | null;
}

interface File {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploaderId: number;
  updatedAt: Date;
  isShared: boolean | null;
  folderId: number | null;
  uploadedAt: Date;
}

export default function CloudStorage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // États du composant
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState<{ id: number; name: string }[]>([]);
  const [folderStack, setFolderStack] = useState<Folder[]>([{ id: 0, name: "Cloud", path: "/", ownerId: user?.id || 0, parentId: null, iconType: null, createdAt: new Date(), updatedAt: new Date(), isShared: false }]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFiles, setSelectedFiles] = useState<Record<number, boolean>>({});
  
  // États des dialogues
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // États pour les actions
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<string>("orange");
  const [folderToUpdateIcon, setFolderToUpdateIcon] = useState<number | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [itemToRename, setItemToRename] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [sharePermission, setSharePermission] = useState<"read" | "write" | "admin">("read");
  const [shareEmail, setShareEmail] = useState("");

  // Requêtes
  const { data: folders = [] } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: async () => {
      const res = await fetch(`/api/folders?parentId=${currentFolderId || 'null'}`);
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    }
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", currentFolderId],
    queryFn: async () => {
      const res = await fetch(`/api/files?folderId=${currentFolderId || 'null'}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    }
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId: number | null; iconType: string }) => {
      const res = await apiRequest("POST", "/api/folders", folderData);
      if (!res.ok) throw new Error("Failed to create folder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      toast({ title: "Dossier créé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la création", description: error.message, variant: "destructive" });
    }
  });

  const updateFolderIconMutation = useMutation({
    mutationFn: async ({ folderId, iconType }: { folderId: number; iconType: string }) => {
      const res = await apiRequest("PATCH", `/api/folders/${folderId}`, { iconType });
      if (!res.ok) throw new Error("Failed to update folder icon");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      setIsIconSelectorOpen(false);
      setFolderToUpdateIcon(null);
      toast({ title: "Icône mise à jour avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la mise à jour", description: error.message, variant: "destructive" });
    }
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      if (currentFolderId) {
        formData.append('folderId', currentFolderId.toString());
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload files');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      toast({ title: "Fichiers uploadés avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de l'upload", description: error.message, variant: "destructive" });
    }
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name, isFolder }: { id: number; name: string; isFolder: boolean }) => {
      const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
      const res = await apiRequest("PATCH", endpoint, { name });
      if (!res.ok) throw new Error("Failed to rename item");
      return res.json();
    },
    onSuccess: (_, { isFolder }) => {
      const queryKey = isFolder ? ["folders", currentFolderId] : ["files", currentFolderId];
      queryClient.invalidateQueries({ queryKey });
      setIsRenameDialogOpen(false);
      setItemToRename(null);
      setNewItemName("");
      toast({ title: "Élément renommé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors du renommage", description: error.message, variant: "destructive" });
    }
  });

  const shareMutation = useMutation({
    mutationFn: async ({ fileId, email, permission }: { fileId: number; email: string; permission: string }) => {
      // First get user by email
      const userRes = await fetch(`/api/users?email=${email}`);
      if (!userRes.ok) throw new Error("Utilisateur introuvable");
      const users = await userRes.json();
      if (!users.data || users.data.length === 0) throw new Error("Utilisateur introuvable");
      
      const sharedWithId = users.data[0].id;
      const res = await apiRequest("POST", "/api/files/share", {
        fileId,
        sharedWithId,
        permission
      });
      if (!res.ok) throw new Error("Failed to share file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      setIsShareDialogOpen(false);
      setItemToShare(null);
      setShareEmail("");
      toast({ title: "Fichier partagé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors du partage", description: error.message, variant: "destructive" });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: number; isFolder: boolean }) => {
      const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
      const res = await apiRequest("DELETE", endpoint);
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: (_, { isFolder }) => {
      const queryKey = isFolder ? ["folders", currentFolderId] : ["files", currentFolderId];
      queryClient.invalidateQueries({ queryKey });
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast({ title: "Élément supprimé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la suppression", description: error.message, variant: "destructive" });
    }
  });

  // Fonctions utilitaires
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="h-8 w-8 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="h-8 w-8 text-green-500" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="h-8 w-8 text-gray-500" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return <Archive className="h-8 w-8 text-yellow-500" />;
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  const getFolderIcon = (iconType: string = "orange") => {
    const className = "h-10 w-10 object-contain";
    switch (iconType) {
      case "orange":
        return <img src={folderOrangeIcon} alt="Dossier orange" className={className} />;
      case "blue":
        return <img src={folderBlueIcon} alt="Dossier bleu" className={className} />;
      case "archive":
        return <img src={folderArchiveIcon} alt="Dossier archive" className={className} />;
      default:
        return <img src={folderOrangeIcon} alt="Dossier" className={className} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handlers
  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setFolderStack([...folderStack, folder]);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      // Retour à la racine
      setCurrentFolderId(null);
      setFolderStack([folderStack[0]]);
    } else {
      // Navigation vers un dossier parent
      const newStack = folderStack.slice(0, index + 1);
      setFolderStack(newStack);
      setCurrentFolderId(newStack[newStack.length - 1].id === 0 ? null : newStack[newStack.length - 1].id);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadFilesMutation.mutate(files);
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate({
        name: newFolderName.trim(),
        parentId: currentFolderId,
        iconType: selectedFolderIcon
      });
    }
  };

  const handleDeleteItem = (id: number, name: string, isFolder: boolean) => {
    setItemToDelete({ id, name, isFolder });
    setIsDeleteDialogOpen(true);
  };

  const handleUpdateFolderIcon = (folderId: number) => {
    setFolderToUpdateIcon(folderId);
    setIsIconSelectorOpen(true);
  };

  const handleRenameItem = (id: number, name: string, isFolder: boolean) => {
    setItemToRename({ id, name, isFolder });
    setNewItemName(name);
    setIsRenameDialogOpen(true);
  };

  const handleShareItem = (id: number, name: string, isFolder: boolean) => {
    setItemToShare({ id, name, isFolder });
    setIsShareDialogOpen(true);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Filtrage des données
  const filteredFolders = folders.filter((folder: Folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter((file: File) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div 
      className="flex-1 p-6 flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(${cloudBackgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow p-6 flex-1 flex flex-col overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
          {/* Header avec titre et actions principales */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Cloud</h2>
            <div className="flex space-x-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                multiple 
              />
              <Button
                onClick={triggerFileInput}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Files</span>
              </Button>
              <Button
                onClick={() => setIsCreateFolderDialogOpen(true)}
                className="flex items-center space-x-2"
              >
                <FolderPlus className="h-4 w-4" />
                <span>New Folder</span>
              </Button>
            </div>
          </div>

          {/* Barre de recherche et filtres */}
          <div className="flex flex-wrap gap-4 items-center mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher des fichiers et dossiers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation breadcrumb avec bouton retour */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                {folderStack.map((folder, index) => (
                  <div key={index} className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBreadcrumbClick(index)}
                      className="p-1 h-auto font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {folder.name}
                    </Button>
                    {index < folderStack.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Bouton Retour */}
              {folderStack.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newStack = folderStack.slice(0, -1);
                    setFolderStack(newStack);
                    setCurrentFolderId(newStack[newStack.length - 1].id === 0 ? null : newStack[newStack.length - 1].id);
                  }}
                  className="flex items-center space-x-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Retour</span>
                </Button>
              )}
            </div>
          </div>

          {/* Zone de contenu avec défilement */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
            {/* Grille des dossiers */}
            {filteredFolders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Dossiers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredFolders.map((folder: Folder) => (
                    <div 
                      key={folder.id} 
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-center">
                        <div 
                          className="w-12 h-12 flex items-center justify-center mr-3 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateFolderIcon(folder.id);
                          }}
                        >
                          {getFolderIcon(folder.iconType || "orange")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 
                            className="font-medium truncate cursor-pointer"
                            onClick={() => handleFolderClick(folder)}
                          >
                            {folder.name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {formatDate(folder.updatedAt)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateFolderIcon(folder.id);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Changer l'icône
                            </DropdownMenuItem>
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
                  ))}
                </div>
              </div>
            )}

            {/* Grille des fichiers */}
            {filteredFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Fichiers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredFiles.map((file: File) => (
                    <div 
                      key={file.id} 
                      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                        ) : (
                          getFileIcon(file.type)
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium truncate flex-1">{file.name}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRenameItem(file.id, file.name, false)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Renommer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleShareItem(file.id, file.name, false)}
                              >
                                <Share className="mr-2 h-4 w-4" />
                                Partager
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                <a href={file.url} download={file.name} className="flex-1">
                                  Télécharger
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteItem(file.id, file.name, false)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message si aucun élément */}
            {filteredFolders.length === 0 && filteredFiles.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? "Aucun élément trouvé pour cette recherche." : "Ce dossier est vide."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogue de création de dossier */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom du dossier</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Entrez le nom du dossier"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-3 block">Choisir une icône</label>
              <div className="flex gap-4 justify-center">
                <div 
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFolderIcon === "orange" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFolderIcon("orange")}
                >
                  <img src={folderOrangeIcon} alt="Dossier orange" className="w-12 h-12" />
                  <p className="text-xs text-center mt-1">Orange</p>
                </div>
                <div 
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFolderIcon === "blue" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFolderIcon("blue")}
                >
                  <img src={folderBlueIcon} alt="Dossier bleu" className="w-12 h-12" />
                  <p className="text-xs text-center mt-1">Bleu</p>
                </div>
                <div 
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFolderIcon === "archive" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFolderIcon("archive")}
                >
                  <img src={folderArchiveIcon} alt="Dossier archive" className="w-12 h-12" />
                  <p className="text-xs text-center mt-1">Archive</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de sélection d'icône */}
      <Dialog open={isIconSelectorOpen} onOpenChange={setIsIconSelectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer l'icône du dossier</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="flex gap-6 justify-center">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedFolderIcon === "orange" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedFolderIcon("orange")}
              >
                <img src={folderOrangeIcon} alt="Dossier orange" className="w-16 h-16" />
                <p className="text-sm text-center mt-2">Orange</p>
              </div>
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedFolderIcon === "blue" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedFolderIcon("blue")}
              >
                <img src={folderBlueIcon} alt="Dossier bleu" className="w-16 h-16" />
                <p className="text-sm text-center mt-2">Bleu</p>
              </div>
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedFolderIcon === "archive" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedFolderIcon("archive")}
              >
                <img src={folderArchiveIcon} alt="Dossier archive" className="w-16 h-16" />
                <p className="text-sm text-center mt-2">Archive</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIconSelectorOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (folderToUpdateIcon) {
                  updateFolderIconMutation.mutate({ 
                    folderId: folderToUpdateIcon, 
                    iconType: selectedFolderIcon 
                  });
                }
              }}
              disabled={!folderToUpdateIcon || updateFolderIconMutation.isPending}
            >
              {updateFolderIconMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de renommage */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer {itemToRename?.isFolder ? "le dossier" : "le fichier"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Nouveau nom"
              className="w-full"
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
              disabled={!newItemName.trim() || renameMutation.isPending}
            >
              {renameMutation.isPending ? "Renommage..." : "Renommer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de partage */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager {itemToShare?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email de l'utilisateur</label>
              <Input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="exemple@email.com"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Permissions</label>
              <select 
                value={sharePermission} 
                onChange={(e) => setSharePermission(e.target.value as "read" | "write" | "admin")}
                className="w-full p-2 border rounded-md"
              >
                <option value="read">Lecture seule</option>
                <option value="write">Lecture et écriture</option>
                <option value="admin">Administration complète</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (shareEmail.trim() && itemToShare) {
                  shareMutation.mutate({
                    fileId: itemToShare.id,
                    email: shareEmail.trim(),
                    permission: sharePermission
                  });
                }
              }}
              disabled={!shareEmail.trim() || shareMutation.isPending}
            >
              {shareMutation.isPending ? "Partage..." : "Partager"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation de suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{itemToDelete?.name}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  deleteItemMutation.mutate({ 
                    id: itemToDelete.id, 
                    isFolder: itemToDelete.isFolder 
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}