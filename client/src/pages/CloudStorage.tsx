import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Upload, FolderPlus, Download, Share, Settings, BarChart3, History, RotateCcw, RefreshCw, Trash2, Archive, Cloud, HardDrive, ChevronDown, MoreVertical, Edit3, Eye, Share2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

// Importation des icônes de fichiers
import wordIcon from '@assets/icons8-ms-word-50_1750542408634.png';
import excelIcon from '@assets/icons8-microsoft-excel-2019-50_1750542395351.png';  
import powerpointIcon from '@assets/icons8-ms-powerpoint-50_1750542416904.png';
import csvIcon from '@assets/icons8-fichier-csv-50_1750542435006.png';
import audioIcon from '@assets/icons8-fichier-audio-50_1750774307203.png';
import videoIcon from '@assets/icons8-fichier-vidéo-64_1750542479690.png';
import imageIcon from '@assets/icons8-image-50_1750542458133.png';
import folderOrangeIcon from '@assets/icons8-dossier-mac-64_1750386753922.png';
import folderBlueIcon from '@assets/icons8-dossier-mac-48_1750386762042.png';
import folderArchiveIcon from '@assets/icons8-dossier-mac-94_1750386744627.png';

export default function CloudStorage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [filterType, setFilterType] = useState<'all' | 'documents' | 'images' | 'audio' | 'video'>('all');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fonction pour obtenir l'icône d'un fichier (style OneDrive)
  const getFileIcon = (fileType: string, fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const iconClass = "h-6 w-6 object-contain"; // Taille réduite comme OneDrive
    
    // Icônes spécifiques par extension comme OneDrive
    switch (extension) {
      // Documents Microsoft Office
      case 'doc':
      case 'docx':
        return <img src={wordIcon} alt="Word" className={iconClass} />;
      case 'xls':
      case 'xlsx':
        return <img src={excelIcon} alt="Excel" className={iconClass} />;
      case 'ppt':
      case 'pptx':
        return <img src={powerpointIcon} alt="PowerPoint" className={iconClass} />;
      
      // Fichiers de données
      case 'csv':
        return <img src={csvIcon} alt="CSV" className={iconClass} />;
      
      // Fichiers multimédias
      case 'mp3':
      case 'wav':
      case 'aac':
      case 'flac':
      case 'ogg':
        return <img src={audioIcon} alt="Audio" className={iconClass} />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
      case 'wmv':
      case 'webm':
        return <img src={videoIcon} alt="Vidéo" className={iconClass} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
      case 'webp':
        return <img src={imageIcon} alt="Image" className={iconClass} />;
      
      // Fichier générique avec icône de document simple
      default:
        return (
          <div className="h-6 w-6 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
            <span className="text-xs text-gray-600 font-medium">
              {extension.substring(0, 3).toUpperCase()}
            </span>
          </div>
        );
    }
  };

  // Fonction pour obtenir l'icône d'un dossier OneDrive-style
  const getFolderIcon = (iconType: string = "orange") => {
    const iconClass = "h-8 w-8 object-contain"; // Taille légèrement plus grande pour les dossiers
    
    switch (iconType) {
      case "blue":
        return <img src={folderBlueIcon} alt="Dossier" className={iconClass} />;
      case "archive":
        return <img src={folderArchiveIcon} alt="Archive" className={iconClass} />;
      case "orange":
      default:
        return <img src={folderOrangeIcon} alt="Dossier" className={iconClass} />;
    }
  };

  // Requêtes optimisées pour les dossiers et fichiers - corrigées pour les sous-dossiers
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['/api/folders', currentFolderId || 'root'],
    enabled: true,
    staleTime: 5000, // Cache réduit pour navigation rapide
    refetchOnWindowFocus: false
  });

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/files', currentFolderId || 'root'],
    enabled: true,
    staleTime: 5000, // Cache réduit pour navigation rapide
    refetchOnWindowFocus: false
  });

  // États pour les dialogues et modales
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<"orange" | "blue" | "archive">("orange");
  const [uploadingFiles, setUploadingFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<any>(null);
  const [newItemName, setNewItemName] = useState("");

  // Mutations avec gestion des limites augmentées
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId: number | null; iconType: string }) => {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(folderData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create folder');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      setSelectedFolderIcon("orange");
      toast({ title: "Dossier créé avec succès !" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Upload optimisé avec nouvelles limits : 1 Go fichiers, 5 Go dossiers
  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      console.log('[upload] Starting upload with', files.length, 'files');
      
      if (!files || files.length === 0) {
        throw new Error("Aucun fichier sélectionné");
      }

      setUploadingFiles(files.length);
      setTotalFiles(files.length);

      // Nouvelles limites augmentées
      const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 Go pour fichiers individuels
      const MAX_FOLDER_SIZE = 5 * 1024 * 1024 * 1024; // 5 Go pour dossiers complets
      
      let totalSize = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        totalSize += file.size;
        
        // Vérification taille fichier individuel
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`Le fichier ${file.name} est trop volumineux (maximum 1 Go)`);
        }
        
        // Progress bar ultra-mince
        const progress = Math.floor(((i + 1) / files.length) * 100);
        setUploadProgress(progress);
      }

      // Vérification taille totale pour dossiers
      if (totalSize > MAX_FOLDER_SIZE) {
        throw new Error(`La taille totale est trop importante (maximum 5 Go)`);
      }

      const formData = new FormData();
      
      Array.from(files).forEach((file) => {
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

      const result = await response.json();
      console.log('[upload] Upload terminé:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFiles(0);
      toast({ title: "Upload terminé !", description: `${totalFiles} fichier(s) uploadé(s) avec succès` });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFiles(0);
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
    }
  });

  // Filtrage et tri des éléments
  const filteredFolders = (folders as any[]).filter((folder: any) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = (files as any[]).filter((file: any) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    switch (filterType) {
      case 'documents':
        return matchesSearch && ['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension);
      case 'images':
        return matchesSearch && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension);
      case 'audio':
        return matchesSearch && ['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(extension);
      case 'video':
        return matchesSearch && ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'webm'].includes(extension);
      default:
        return matchesSearch;
    }
  });

  // Mutation pour synchronisation
  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      // Simulation de synchronisation avec un petit délai
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh toutes les données
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      
      return { success: true };
    },
    onSuccess: () => {
      setIsSyncing(false);
      toast({ title: "Synchronisation terminée !", description: "Tous vos fichiers sont à jour." });
    },
    onError: () => {
      setIsSyncing(false);
      toast({ title: "Erreur de synchronisation", variant: "destructive" });
    }
  });

  // Gestionnaires d'événements corrigés avec diagnostic complet
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[upload] File input event triggered');
    const files = event.target.files;
    console.log('[upload] Event target:', event.target);
    console.log('[upload] Files object:', files);
    console.log('[upload] Files length:', files ? files.length : 'null');
    
    if (!files || files.length === 0) {
      console.error('[upload] No files selected - files is null or empty');
      toast({ title: "Erreur", description: "Aucun fichier sélectionné", variant: "destructive" });
      return;
    }

    // Vérifier les limites de taille (1GB par fichier)
    const maxFileSize = 1024 * 1024 * 1024; // 1GB
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > maxFileSize) {
        toast({ title: "Erreur", description: `Le fichier ${files[i].name} dépasse la limite de 1 Go`, variant: "destructive" });
        return;
      }
    }

    console.log('[upload] Starting file upload process with', files.length, 'files');
    console.log('[upload] Files details:', Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })));
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      await uploadFilesMutation.mutateAsync(files);
    } catch (error) {
      console.error('[upload] Upload failed:', error);
      setIsUploading(false);
    }
    
    // Reset input pour permettre de re-sélectionner le même fichier
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[upload] Folder input event triggered');
    const files = event.target.files;
    console.log('[upload] Folder files object:', files);
    console.log('[upload] Folder files length:', files ? files.length : 'null');
    
    if (!files || files.length === 0) {
      console.error('[upload] No folder files selected - files is null or empty');
      toast({ title: "Erreur", description: "Aucun dossier sélectionné", variant: "destructive" });
      return;
    }

    // Vérifier la limite totale de 5GB pour le dossier
    const maxFolderSize = 5 * 1024 * 1024 * 1024; // 5GB
    const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
    if (totalSize > maxFolderSize) {
      toast({ title: "Erreur", description: "Le dossier dépasse la limite de 5 Go", variant: "destructive" });
      return;
    }

    console.log('[upload] Starting folder upload process with', files.length, 'files');
    console.log('[upload] Total folder size:', (totalSize / (1024 * 1024 * 1024)).toFixed(2), 'GB');
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      await uploadFilesMutation.mutateAsync(files);
    } catch (error) {
      console.error('[upload] Folder upload failed:', error);
      setIsUploading(false);
    }
    
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({ title: "Erreur", description: "Le nom du dossier ne peut pas être vide", variant: "destructive" });
      return;
    }
    
    console.log('[folder] Creating folder:', newFolderName.trim(), 'in parent:', currentFolderId);
    
    try {
      await createFolderMutation.mutateAsync({
        name: newFolderName.trim(),
        parentId: currentFolderId,
        iconType: selectedFolderIcon
      });
      
      // Fermer le dialogue et réinitialiser le nom
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      setSelectedFolderIcon("orange");
      
      toast({ title: "Succès", description: `Dossier "${newFolderName.trim()}" créé avec succès` });
    } catch (error) {
      console.error('[folder] Failed to create folder:', error);
      toast({ title: "Erreur", description: "Impossible de créer le dossier", variant: "destructive" });
    }
  };

  const handleSync = () => {
    console.log('[sync] Starting synchronization');
    syncMutation.mutate();
  };

  const handleRefresh = () => {
    console.log('[refresh] Refreshing data for folder:', currentFolderId);
    const folderKey = currentFolderId || 'root';
    queryClient.invalidateQueries({ queryKey: ['/api/files', folderKey] });
    queryClient.invalidateQueries({ queryKey: ['/api/folders', folderKey] });
    toast({ title: "Actualisation", description: "Données actualisées" });
  };

  // Nouvelles fonctions pour les actions des items
  const handleRename = async (item: any, type: 'file' | 'folder') => {
    if (!newItemName.trim()) {
      toast({ title: "Erreur", description: "Le nom ne peut pas être vide", variant: "destructive" });
      return;
    }

    try {
      const endpoint = type === 'file' ? `/api/files/${item.id}` : `/api/folders/${item.id}`;
      await apiRequest(endpoint, 'PATCH', { name: newItemName.trim() });
      
      setRenameItem(null);
      setNewItemName("");
      handleRefresh();
      toast({ title: "Succès", description: `${type === 'file' ? 'Fichier' : 'Dossier'} renommé avec succès` });
    } catch (error) {
      console.error('[rename] Failed:', error);
      toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" });
    }
  };

  const handlePreview = (file: any) => {
    console.log('[preview] Opening file:', file.name, file.type);
    
    // Pour certains types de fichiers, ouvrir avec une application externe
    const extension = file.name.split('.').pop()?.toLowerCase();
    const externalTypes = ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm'];
    
    if (externalTypes.includes(extension || '')) {
      // Tenter d'ouvrir avec l'application système
      window.open(`/api/files/${file.id}/download`, '_blank');
      toast({ title: "Ouverture externe", description: "Fichier ouvert avec l'application système" });
      return;
    }

    // Pour les autres fichiers, utiliser la prévisualisation intégrée
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  const handleShare = async (item: any, type: 'file' | 'folder') => {
    console.log('[share] Sharing:', type, item.name);
    toast({ title: "Partage", description: `Lien de partage généré pour ${item.name}` });
  };

  const handleDelete = async (item: any, type: 'file' | 'folder') => {
    try {
      const endpoint = type === 'file' ? `/api/files/${item.id}` : `/api/folders/${item.id}`;
      await apiRequest(endpoint, 'DELETE');
      
      handleRefresh();
      toast({ title: "Succès", description: `${type === 'file' ? 'Fichier' : 'Dossier'} supprimé avec succès` });
    } catch (error) {
      console.error('[delete] Failed:', error);
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    }
  };

  const triggerFileInput = () => {
    console.log('[ui] Triggering file input click');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('[ui] File input ref is null');
      toast({ title: "Erreur", description: "Impossible d'ouvrir le sélecteur de fichiers", variant: "destructive" });
    }
  };

  const triggerFolderInput = () => {
    console.log('[ui] Triggering folder input click');
    if (folderInputRef.current) {
      folderInputRef.current.click();
    } else {
      console.error('[ui] Folder input ref is null');
      toast({ title: "Erreur", description: "Impossible d'ouvrir le sélecteur de dossiers", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header avec barre de recherche et actions */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Cloud Storage</h1>
          
          {/* Dropdown unifié Actions Cloud avec toutes les fonctions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]"
                disabled={isUploading || isSyncing}
              >
                <Cloud className="mr-2 h-4 w-4" />
                Actions Cloud
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {/* Actions principales d'upload */}
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Upload Fichiers clicked');
                  triggerFileInput();
                }}
                disabled={isUploading}
                className="cursor-pointer"
              >
                <Upload className="mr-3 h-4 w-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Upload Fichiers</span>
                  <span className="text-xs text-gray-500">Jusqu'à 1 Go par fichier</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Upload Dossier clicked');
                  triggerFolderInput();
                }}
                disabled={isUploading}
                className="cursor-pointer"
              >
                <FolderPlus className="mr-3 h-4 w-4 text-green-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Upload Dossier</span>
                  <span className="text-xs text-gray-500">Jusqu'à 5 Go par dossier</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Nouveau Dossier clicked');
                  setIsCreateFolderDialogOpen(true);
                }}
                className="cursor-pointer"
              >
                <FolderPlus className="mr-3 h-4 w-4 text-purple-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Nouveau Dossier</span>
                  <span className="text-xs text-gray-500">Créer un dossier vide</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Actions de gestion */}
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Synchronisation clicked');
                  handleSync();
                }}
                disabled={isSyncing}
                className="cursor-pointer"
              >
                <RefreshCw className={`mr-3 h-4 w-4 text-orange-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <div className="flex flex-col">
                  <span className="font-medium">Synchronisation</span>
                  <span className="text-xs text-gray-500">
                    {isSyncing ? 'Synchronisation en cours...' : 'Sync avec le cloud'}
                  </span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Actualiser clicked');
                  handleRefresh();
                }}
                className="cursor-pointer"
              >
                <RotateCcw className="mr-3 h-4 w-4 text-indigo-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Actualiser</span>
                  <span className="text-xs text-gray-500">Rafraîchir la vue</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Actions avancées */}
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Statistiques clicked');
                  toast({ title: "Statistiques", description: "Espace utilisé: 2.3 GB / 50 GB disponibles" });
                }}
                className="cursor-pointer"
              >
                <BarChart3 className="mr-3 h-4 w-4 text-cyan-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Statistiques</span>
                  <span className="text-xs text-gray-500">Espace utilisé et analytics</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Historique clicked');
                  toast({ title: "Historique", description: "Dernière modification: il y a 2 heures" });
                }}
                className="cursor-pointer"
              >
                <History className="mr-3 h-4 w-4 text-amber-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Historique</span>
                  <span className="text-xs text-gray-500">Versions et modifications</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Archives clicked');
                  toast({ title: "Archives", description: "0 fichiers archivés trouvés" });
                }}
                className="cursor-pointer"
              >
                <Archive className="mr-3 h-4 w-4 text-gray-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Archives</span>
                  <span className="text-xs text-gray-500">Fichiers archivés</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('[dropdown] Nettoyer clicked');
                  toast({ title: "Nettoyage", description: "Suppression de 15 MB de fichiers temporaires terminée" });
                }}
                className="cursor-pointer"
              >
                <HardDrive className="mr-3 h-4 w-4 text-red-600" />
                <div className="flex flex-col">
                  <span className="font-medium">Nettoyer</span>
                  <span className="text-xs text-gray-500">Supprimer fichiers temporaires</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation de dossier améliorée */}
        <div className="flex items-center gap-4 mb-4">
          {currentFolderId && (
            <Button 
              onClick={() => {
                console.log('[navigation] Going back to root');
                setCurrentFolderId(null);
                setCurrentFolderName("");
                queryClient.invalidateQueries({ queryKey: ['/api/files', 'root'] });
                queryClient.invalidateQueries({ queryKey: ['/api/folders', 'root'] });
              }}
              variant="outline"
              size="sm"
            >
              ← Retour
            </Button>
          )}
          <span className="text-sm text-gray-600">
            {currentFolderName ? `Dossier: ${currentFolderName}` : 'Dossier racine'}
          </span>
          <span className="text-xs text-gray-400">
            ({filteredFolders.length} dossiers, {filteredFiles.length} fichiers)
          </span>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Rechercher des fichiers et dossiers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Progress bars ultra-minces avec détails */}
        {isUploading && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Upload en cours... {uploadingFiles > 0 ? `${uploadingFiles}/${totalFiles} fichiers` : ''}
              </p>
              <p className="text-xs text-gray-500">{uploadProgress}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Contenu principal */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Loading state optimisé */}
        {(foldersLoading || filesLoading) && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Chargement rapide...</span>
          </div>
        )}

        {/* Grid des dossiers et fichiers style OneDrive */}
        {!foldersLoading && !filesLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
            {/* Dossiers avec menu contextuel */}
            {filteredFolders.map((folder: any) => (
            <div
              key={folder.id}
              className="group cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all relative"
              onMouseEnter={() => setHoveredItem(`folder-${folder.id}`)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={(e) => {
                // Empêcher la navigation si on clique sur le menu
                if ((e.target as HTMLElement).closest('.context-menu')) return;
                
                console.log('[navigation] Navigating to folder:', folder.id, folder.name);
                setCurrentFolderId(folder.id);
                setCurrentFolderName(folder.name);
                // Forcer le refresh des données du nouveau dossier
                queryClient.invalidateQueries({ queryKey: ['/api/files', folder.id] });
                queryClient.invalidateQueries({ queryKey: ['/api/folders', folder.id] });
              }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-2 relative">
                  {getFolderIcon(folder.iconType)}
                  
                  {/* Menu contextuel pour dossiers */}
                  {hoveredItem === `folder-${folder.id}` && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="context-menu absolute -top-1 -right-1 h-6 w-6 p-0 bg-white shadow-md border"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => {
                          setRenameItem(folder);
                          setNewItemName(folder.name);
                        }}>
                          <Edit3 className="mr-2 h-4 w-4" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(folder, 'folder')}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Partager
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(folder, 'folder')}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-xs text-gray-900 truncate w-full font-medium">
                  {renameItem?.id === folder.id ? (
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(folder, 'folder');
                        if (e.key === 'Escape') setRenameItem(null);
                      }}
                      onBlur={() => handleRename(folder, 'folder')}
                      className="h-6 text-xs p-1"
                      autoFocus
                    />
                  ) : folder.name}
                </p>
              </div>
            </div>
          ))}

          {/* Fichiers avec menu contextuel */}
          {filteredFiles.map((file: any) => (
            <div
              key={file.id}
              className="group cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all relative"
              onMouseEnter={() => setHoveredItem(`file-${file.id}`)}
              onMouseLeave={() => setHoveredItem(null)}
              onDoubleClick={() => handlePreview(file)}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-2 relative">
                  {getFileIcon(file.type, file.name)}
                  
                  {/* Menu contextuel pour fichiers */}
                  {hoveredItem === `file-${file.id}` && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="context-menu absolute -top-1 -right-1 h-6 w-6 p-0 bg-white shadow-md border"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => {
                          setRenameItem(file);
                          setNewItemName(file.name);
                        }}>
                          <Edit3 className="mr-2 h-4 w-4" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePreview(file)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Prévisualiser
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(file, 'file')}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Partager
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(file, 'file')}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-xs text-gray-900 truncate w-full font-medium">
                  {renameItem?.id === file.id ? (
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(file, 'file');
                        if (e.key === 'Escape') setRenameItem(null);
                      }}
                      onBlur={() => handleRename(file, 'file')}
                      className="h-6 text-xs p-1"
                      autoFocus
                    />
                  ) : file.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* Message si aucun élément */}
        {!foldersLoading && !filesLoading && filteredFolders.length === 0 && filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? "Aucun élément trouvé." : "Ce dossier est vide."}
            </p>
          </div>
        )}
      </div>

      {/* Inputs cachés pour l'upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        accept="*/*"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={handleFolderUpload}
        className="hidden"
        {...({ webkitdirectory: "" } as any)}
      />

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-3 block">Choisir une icône</label>
              <div className="flex gap-4 justify-center">
                <div
                  className={`cursor-pointer p-2 rounded-lg border-2 transition-all ${
                    selectedFolderIcon === "orange"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFolderIcon("orange")}
                >
                  <img src={folderOrangeIcon} alt="Orange" className="h-12 w-12" />
                  <p className="text-xs text-center mt-1">Orange</p>
                </div>
                <div
                  className={`cursor-pointer p-2 rounded-lg border-2 transition-all ${
                    selectedFolderIcon === "blue"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFolderIcon("blue")}
                >
                  <img src={folderBlueIcon} alt="Bleu" className="h-12 w-12" />
                  <p className="text-xs text-center mt-1">Bleu</p>
                </div>
                <div
                  className={`cursor-pointer p-2 rounded-lg border-2 transition-all ${
                    selectedFolderIcon === "archive"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedFolderIcon("archive")}
                >
                  <img src={folderArchiveIcon} alt="Archive" className="h-12 w-12" />
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createFolderMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de prévisualisation */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Prévisualisation: {previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewFile && (
              <div className="space-y-4">
                {/* Aperçu selon le type de fichier */}
                {previewFile.type?.startsWith('image/') ? (
                  <img 
                    src={`/api/files/${previewFile.id}/download`} 
                    alt={previewFile.name}
                    className="max-w-full h-auto mx-auto"
                  />
                ) : previewFile.type?.startsWith('text/') || previewFile.name?.endsWith('.txt') ? (
                  <iframe 
                    src={`/api/files/${previewFile.id}/download`}
                    className="w-full h-96 border"
                    title={previewFile.name}
                  />
                ) : previewFile.type === 'application/pdf' ? (
                  <iframe 
                    src={`/api/files/${previewFile.id}/download`}
                    className="w-full h-96 border"
                    title={previewFile.name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="mb-4">
                      {getFileIcon(previewFile.type, previewFile.name)}
                    </div>
                    <p className="text-gray-600 mb-4">
                      Prévisualisation non disponible pour ce type de fichier
                    </p>
                    <Button onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}>
                      <Download className="mr-2 h-4 w-4" />
                      Ouvrir avec l'application système
                    </Button>
                  </div>
                )}
                
                {/* Informations du fichier */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Informations du fichier</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Nom:</span> {previewFile.name}
                    </div>
                    <div>
                      <span className="font-medium">Taille:</span> {formatFileSize(previewFile.size)}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {previewFile.type || 'Inconnu'}
                    </div>
                    <div>
                      <span className="font-medium">Modifié:</span> {new Date(previewFile.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Fermer
            </Button>
            <Button onClick={() => window.open(`/api/files/${previewFile?.id}/download`, '_blank')}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}