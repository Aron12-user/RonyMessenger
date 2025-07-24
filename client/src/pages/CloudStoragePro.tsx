import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Search, 
  FolderPlus, 
  Grid3X3, 
  List, 
  Filter, 
  SortAsc, 
  MoreVertical,
  Eye,
  Download,
  Edit3,
  Trash2,
  Share2,
  CheckSquare,
  Square,
  ChevronRight,
  Home,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File as FileIcon,
  Archive,
  Settings
} from "lucide-react";
import type { File, Folder } from "@/../../shared/schema";

// Import des icônes personnalisées
import folderOrangeIcon from "@assets/icons8-dossier-mac-94_1750386744627.png";
import folderArchiveIcon from "@assets/icons8-dossier-mac-64_1750386753922.png";
import folderBlueIcon from "@assets/icons8-dossier-mac-48_1750386762042.png";

export default function CloudStoragePro() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // États pour l'interface
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<"all" | "images" | "documents" | "videos" | "audio">("all");
  const [selectedFiles, setSelectedFiles] = useState<Record<number, boolean>>({});
  const [selectedFolders, setSelectedFolders] = useState<Record<number, boolean>>({});
  
  // États pour les dialogues
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  
  // États pour les formulaires
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<"default" | "orange" | "blue" | "archive">("orange");
  const [shareRecipient, setShareRecipient] = useState("");
  const [sharePermission, setSharePermission] = useState<"read" | "write" | "admin">("read");
  const [newName, setNewName] = useState("");
  const [itemToDelete, setItemToDelete] = useState<{id: number; name: string; isFolder: boolean} | null>(null);
  const [itemToRename, setItemToRename] = useState<{id: number; isFolder: boolean} | null>(null);
  
  // Pagination et défilement
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(24); // 24 éléments par page pour une grille 6x4
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Requêtes pour récupérer les données
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['/api/folders', currentFolderId],
    queryFn: () => apiRequest(`/api/folders?parent=${currentFolderId || ''}`),
  });

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/files', currentFolderId],
    queryFn: () => apiRequest(`/api/files?folder=${currentFolderId || ''}`),
  });

  const { data: folderPath = [], isLoading: pathLoading } = useQuery({
    queryKey: ['/api/folders/path', currentFolderId],
    queryFn: () => currentFolderId ? apiRequest(`/api/folders/${currentFolderId}/path`) : Promise.resolve([]),
    enabled: !!currentFolderId,
  });

  // Statistiques de stockage
  const { data: storageStats } = useQuery({
    queryKey: ['/api/storage/stats'],
    queryFn: () => apiRequest('/api/storage/stats'),
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: (data: { name: string; iconType: string }) => 
      apiRequest('/api/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          parentId: currentFolderId,
          iconType: data.iconType,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      setSelectedFolderIcon("orange");
      toast({ title: "Dossier créé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création du dossier", variant: "destructive" });
    },
  });

  const uploadFilesMutation = useMutation({
    mutationFn: (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
      if (currentFolderId) formData.append('folderId', currentFolderId.toString());
      
      return fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storage/stats'] });
      toast({ title: "Fichiers téléchargés avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors du téléchargement", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ id, isFolder }: { id: number; isFolder: boolean }) => 
      apiRequest(`/api/${isFolder ? 'folders' : 'files'}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storage/stats'] });
      setShowDeleteDialog(false);
      setItemToDelete(null);
      toast({ title: "Élément supprimé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const renameItemMutation = useMutation({
    mutationFn: () => {
      if (!itemToRename) throw new Error("Aucun élément à renommer");
      return apiRequest(`/api/${itemToRename.isFolder ? 'folders' : 'files'}/${itemToRename.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      setIsRenameDialogOpen(false);
      setItemToRename(null);
      setNewName("");
      toast({ title: "Élément renommé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors du renommage", variant: "destructive" });
    },
  });

  const shareFilesMutation = useMutation({
    mutationFn: async () => {
      try {
        const selectedFileIds = getSelectedFileIds();
        
        if (selectedFileIds.length === 0) {
          throw new Error("Aucun fichier sélectionné");
        }

        if (!shareRecipient.trim()) {
          throw new Error("Nom d'utilisateur du destinataire requis");
        }

        // Vérifier que l'utilisateur destinataire existe
        const usersRes = await fetch('/api/users', { credentials: 'include' });
        if (!usersRes.ok) throw new Error("Impossible de récupérer les utilisateurs");
        
        const usersData = await usersRes.json();
        const allUsers = Array.isArray(usersData) ? usersData : usersData.data || [];
        const targetUser = allUsers.find((u: any) => u.username === shareRecipient.trim());
        
        if (!targetUser) {
          throw new Error("Utilisateur destinataire introuvable");
        }

        // Partager chaque fichier individuellement
        const results = [];
        for (const fileId of selectedFileIds) {
          const response = await fetch('/api/files/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              fileId: fileId,
              sharedWithId: targetUser.id,
              permission: sharePermission,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Erreur lors du partage du fichier ${fileId}`);
          }
          
          const result = await response.json();
          results.push(result);
        }

        return results;
      } catch (error) {
        console.error("Erreur détaillée lors du partage:", error);
        throw error;
      }
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      setIsShareDialogOpen(false);
      setShareRecipient("");
      setSelectedFiles({});
      
      // Notification de succès avec détails
      const fileCount = results?.length || 0;
      const recipientName = results?.[0]?.recipient || shareRecipient;
      
      toast({ 
        title: "Partage réussi", 
        description: `${fileCount} fichier(s) partagé(s) avec ${recipientName}. Notification envoyée en temps réel.`
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors du partage", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Fonctions utilitaires
  const getSelectedFileIds = () => {
    return Object.entries(selectedFiles)
      .filter(([_, selected]) => selected)
      .map(([id]) => parseInt(id));
  };

  const getSelectedFolderIds = () => {
    return Object.entries(selectedFolders)
      .filter(([_, selected]) => selected)
      .map(([id]) => parseInt(id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.split('/')[0];
    const iconClass = "h-8 w-8";
    
    switch (type) {
      case 'image':
        return <FileImage className={`${iconClass} text-green-500`} />;
      case 'video':
        return <FileVideo className={`${iconClass} text-purple-500`} />;
      case 'audio':
        return <FileAudio className={`${iconClass} text-yellow-500`} />;
      case 'application':
        if (fileType.includes('pdf')) {
          return <FileText className={`${iconClass} text-red-500`} />;
        }
        return <Archive className={`${iconClass} text-blue-500`} />;
      default:
        return <FileIcon className={`${iconClass} text-gray-500`} />;
    }
  };

  const getFolderIcon = (iconType: string = "default") => {
    const className = "h-12 w-12 object-contain";
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

  // Filtrage et tri des données
  const filteredAndSortedFolders = useMemo(() => {
    let filtered = folders.filter((folder: Folder) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a: Folder, b: Folder) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [folders, searchQuery, sortBy, sortOrder]);

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files.filter((file: File) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === "all" || 
        (filterType === "images" && file.type.startsWith("image/")) ||
        (filterType === "videos" && file.type.startsWith("video/")) ||
        (filterType === "audio" && file.type.startsWith("audio/")) ||
        (filterType === "documents" && (file.type.includes("pdf") || file.type.includes("document") || file.type.includes("text")));
      
      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a: File, b: File) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "date":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [files, searchQuery, filterType, sortBy, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedFiles.length + filteredAndSortedFolders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedFolders = filteredAndSortedFolders.slice(
    Math.max(0, startIndex), 
    Math.max(0, endIndex - filteredAndSortedFiles.length)
  );
  const paginatedFiles = filteredAndSortedFiles.slice(
    Math.max(0, startIndex - filteredAndSortedFolders.length), 
    endIndex - filteredAndSortedFolders.length
  );

  // Gestion des actions
  const handleSelectFile = (fileId: number) => {
    setSelectedFiles(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  const handleSelectFolder = (folderId: number) => {
    setSelectedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = [...paginatedFiles, ...paginatedFolders].every(item => 
      'size' in item ? selectedFiles[item.id] : selectedFolders[item.id]
    );

    if (allSelected) {
      setSelectedFiles({});
      setSelectedFolders({});
    } else {
      const newSelectedFiles: Record<number, boolean> = {};
      const newSelectedFolders: Record<number, boolean> = {};
      
      paginatedFiles.forEach(file => newSelectedFiles[file.id] = true);
      paginatedFolders.forEach(folder => newSelectedFolders[folder.id] = true);
      
      setSelectedFiles(newSelectedFiles);
      setSelectedFolders(newSelectedFolders);
    }
  };

  const handleDeleteItem = (id: number, name: string, isFolder: boolean) => {
    setItemToDelete({ id, name, isFolder });
    setShowDeleteDialog(true);
  };

  const handleRenameItem = (id: number, isFolder: boolean, currentName: string) => {
    setItemToRename({ id, isFolder });
    setNewName(currentName);
    setIsRenameDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItemMutation.mutate({ id: itemToDelete.id, isFolder: itemToDelete.isFolder });
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
        iconType: selectedFolderIcon 
      });
    }
  };

  // Gestion du défilement infini
  const handleScroll = () => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 1000 &&
      !isLoadingMore &&
      currentPage < totalPages
    ) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      }, 500);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPage, totalPages, isLoadingMore]);

  // Interface utilisateur
  return (
    <section className="flex-1 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* En-tête avec statistiques */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Mes Fichiers</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Organisez et gérez vos documents en toute simplicité
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Nouveau dossier
              </Button>
            </div>
          </div>

          {/* Statistiques de stockage */}
          {storageStats && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Espace utilisé
                </span>
                <span className="text-sm font-medium">
                  {formatFileSize(storageStats.used)} / {formatFileSize(storageStats.total)}
                </span>
              </div>
              <Progress value={(storageStats.used / storageStats.total) * 100} className="h-2" />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{storageStats.fileCount} fichiers</span>
                <span>{Math.round((storageStats.used / storageStats.total) * 100)}% utilisé</span>
              </div>
            </div>
          )}
        </div>

        {/* Barre d'outils */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border p-4 mb-6">
          {/* Navigation et fil d'Ariane */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolderId(null)}
              className="h-8"
            >
              <Home className="h-4 w-4" />
            </Button>
            {folderPath.map((folder: any, index: number) => (
              <div key={folder.id} className="flex items-center">
                <ChevronRight className="h-4 w-4 text-gray-400" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="h-8"
                >
                  {folder.name}
                </Button>  
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher des fichiers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtres et tri */}
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="videos">Vidéos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [newSortBy, newSortOrder] = value.split('-');
                setSortBy(newSortBy as any);
                setSortOrder(newSortOrder as any);
              }}>
                <SelectTrigger className="w-[140px]">
                  <SortAsc className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nom A-Z</SelectItem>
                  <SelectItem value="name-desc">Nom Z-A</SelectItem>
                  <SelectItem value="date-desc">Plus récent</SelectItem>
                  <SelectItem value="date-asc">Plus ancien</SelectItem>
                  <SelectItem value="size-desc">Plus volumineux</SelectItem>
                  <SelectItem value="size-asc">Plus petit</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="border-0"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="border-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions en lot */}
          {(getSelectedFileIds().length > 0 || getSelectedFolderIds().length > 0) && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {getSelectedFileIds().length + getSelectedFolderIds().length} élément(s) sélectionné(s)
                </span>
                <div className="flex gap-2">
                  {getSelectedFileIds().length > 0 && (
                    <Button size="sm" onClick={() => setIsShareDialogOpen(true)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Partager
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedFiles({});
                      setSelectedFolders({});
                    }}
                  >
                    Désélectionner
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contenu principal */}
        <div className="space-y-6">
          {(foldersLoading || filesLoading) ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Dossiers */}
              {paginatedFolders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Dossiers ({filteredAndSortedFolders.length})</h3>
                  </div>
                  
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {paginatedFolders.map((folder: Folder) => (
                        <div
                          key={folder.id}
                          className={`group border rounded-lg p-4 hover:shadow-lg transition-all duration-200 cursor-pointer ${
                            selectedFolders[folder.id] 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onDoubleClick={() => setCurrentFolderId(folder.id)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <input
                              type="checkbox"
                              checked={selectedFolders[folder.id] || false}
                              onChange={() => handleSelectFolder(folder.id)}
                              className="rounded border-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setCurrentFolderId(folder.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ouvrir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRenameItem(folder.id, true, folder.name)}>
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  Renommer
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setItemToRename({ id: folder.id, isFolder: true });
                                  setIsIconSelectorOpen(true);
                                }}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Changer l'icône
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteItem(folder.id, folder.name, true)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-3">
                              {getFolderIcon(folder.iconType)}
                            </div>
                            <h4 className="font-medium text-sm truncate w-full">{folder.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {formatDate(folder.updatedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paginatedFolders.map((folder: Folder) => (
                        <div
                          key={folder.id}
                          className={`flex items-center p-3 border rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer ${
                            selectedFolders[folder.id] 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onDoubleClick={() => setCurrentFolderId(folder.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFolders[folder.id] || false}
                            onChange={() => handleSelectFolder(folder.id)}
                            className="mr-3 rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div className="mr-3">
                            {getFolderIcon(folder.iconType)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{folder.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Dossier • {formatDate(folder.updatedAt)}
                            </p>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setCurrentFolderId(folder.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ouvrir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRenameItem(folder.id, true, folder.name)}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                Renommer
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setItemToRename({ id: folder.id, isFolder: true });
                                setIsIconSelectorOpen(true);
                              }}>
                                <Settings className="mr-2 h-4 w-4" />
                                Changer l'icône
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteItem(folder.id, folder.name, true)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fichiers */}
              {paginatedFiles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Fichiers ({filteredAndSortedFiles.length})</h3>
                    {paginatedFiles.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                      >
                        {paginatedFiles.every(file => selectedFiles[file.id]) ? 
                          <Square className="h-4 w-4 mr-2" /> : 
                          <CheckSquare className="h-4 w-4 mr-2" />
                        }
                        {paginatedFiles.every(file => selectedFiles[file.id]) ? 'Désélectionner' : 'Tout sélectionner'}
                      </Button>
                    )}
                  </div>
                  
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {paginatedFiles.map((file: File) => (
                        <div
                          key={file.id}
                          className={`group border rounded-lg p-4 hover:shadow-lg transition-all duration-200 cursor-pointer ${
                            selectedFiles[file.id] 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onClick={() => handleSelectFile(file.id)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <input
                              type="checkbox"
                              checked={selectedFiles[file.id] || false}
                              onChange={() => handleSelectFile(file.id)}
                              className="rounded border-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => window.open(file.url, '_blank')}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Aperçu
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(file.url, '_blank')}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Télécharger
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRenameItem(file.id, false, file.name)}>
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  Renommer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteItem(file.id, file.name, false)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-3">
                              {getFileIcon(file.type)}
                            </div>
                            <h4 className="font-medium text-sm truncate w-full mb-1">{file.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {formatDate(file.updatedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paginatedFiles.map((file: File) => (
                        <div
                          key={file.id}
                          className={`flex items-center p-3 border rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer ${
                            selectedFiles[file.id] 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onClick={() => handleSelectFile(file.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFiles[file.id] || false}
                            onChange={() => handleSelectFile(file.id)}
                            className="mr-3 rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div className="mr-3">
                            {getFileIcon(file.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{file.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)} • {formatDate(file.updatedAt)}
                            </p>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(file.url, '_blank')}>
                                <Eye className="mr-2 h-4 w-4" />
                                Aperçu
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(file.url, '_blank')}>
                                <Download className="mr-2 h-4 w-4" />
                                Télécharger
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRenameItem(file.id, false, file.name)}>
                                <Edit3 className="mr-2 h-4 w-4" />
                                Renommer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteItem(file.id, file.name, false)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* État vide */}
              {paginatedFiles.length === 0 && paginatedFolders.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📁</div>
                  <h3 className="text-xl font-medium mb-2">Aucun fichier ou dossier</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Commencez par télécharger des fichiers ou créer un dossier
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Télécharger des fichiers
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(true)}>
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Créer un dossier
                    </Button>
                  </div>
                </div>
              )}

              {/* Indicateur de chargement pour le défilement infini */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                  <span className="text-sm text-gray-600">Chargement...</span>
                </div>
              )}

              {/* Pagination info */}
              {totalPages > 1 && (
                <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} sur {totalPages} • {totalItems} élément(s) au total
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Input caché pour l'upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Dialogues */}
      {/* Dialogue de création de dossier */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Créer un nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <label className="text-sm font-medium mb-2 block">Icône du dossier</label>
              <div className="flex gap-3">
                {[
                  { type: "orange", icon: folderOrangeIcon, label: "Orange" },
                  { type: "blue", icon: folderBlueIcon, label: "Bleu" },
                  { type: "archive", icon: folderArchiveIcon, label: "Archive" }
                ].map((option) => (
                  <div
                    key={option.type}
                    className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedFolderIcon === option.type 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedFolderIcon(option.type as any)}
                  >
                    <img src={option.icon} alt={option.label} className="h-8 w-8 mb-1" />
                    <span className="text-xs">{option.label}</span>
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
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Création..." : "Créer le dossier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de changement d'icône */}
      <Dialog open={isIconSelectorOpen} onOpenChange={setIsIconSelectorOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Changer l'icône du dossier</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-4 justify-center">
              {[
                { type: "orange", icon: folderOrangeIcon, label: "Orange" },
                { type: "blue", icon: folderBlueIcon, label: "Bleu" },
                { type: "archive", icon: folderArchiveIcon, label: "Archive" }
              ].map((option) => (
                <div
                  key={option.type}
                  className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedFolderIcon === option.type 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedFolderIcon(option.type as any)}
                >
                  <img src={option.icon} alt={option.label} className="h-12 w-12 mb-2" />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIconSelectorOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (itemToRename) {
                  // Mettre à jour l'icône du dossier
                  apiRequest(`/api/folders/${itemToRename.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ iconType: selectedFolderIcon }),
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
                    setIsIconSelectorOpen(false);
                    setItemToRename(null);
                    toast({ title: "Icône du dossier mise à jour" });
                  }).catch(() => {
                    toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
                  });
                }
              }}
            >
              Confirmer
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
            <label className="text-sm font-medium mb-2 block">Nouveau nom</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Entrez le nouveau nom`}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => renameItemMutation.mutate()}
              disabled={!newName.trim() || renameItemMutation.isPending}
            >
              {renameItemMutation.isPending ? "Renommage..." : "Renommer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de partage */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager des fichiers</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom d'utilisateur du destinataire</label>
              <Input
                value={shareRecipient}
                onChange={(e) => setShareRecipient(e.target.value)}
                placeholder="Entrez le nom d'utilisateur"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Niveau de permission</label>
              <Select value={sharePermission} onValueChange={setSharePermission}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez le niveau de permission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Lecture seule</SelectItem>
                  <SelectItem value="write">Lecture et écriture</SelectItem>
                  <SelectItem value="admin">Accès complet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Partage de {getSelectedFileIds().length} fichier(s) avec des permissions de {sharePermission}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => shareFilesMutation.mutate()}
              disabled={!shareRecipient.trim() || shareFilesMutation.isPending}
            >
              {shareFilesMutation.isPending ? "Partage..." : "Partager les fichiers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {itemToDelete?.isFolder ? "le dossier" : "le fichier"}</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{itemToDelete?.name}" ? 
              {itemToDelete?.isFolder && " Cela supprimera également tous les fichiers et sous-dossiers qu'il contient."}
              {" "}Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}