import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Upload, FolderPlus, Download, Share, Settings, BarChart3, History, RotateCcw } from 'lucide-react';
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

  // Requêtes pour les dossiers et fichiers
  const { data: folders = [] } = useQuery({
    queryKey: ['/api/folders', currentFolderId],
    enabled: true
  });

  const { data: files = [] } = useQuery({
    queryKey: ['/api/files', currentFolderId],
    enabled: true
  });

  // États pour les dialogues et modales
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<"orange" | "blue" | "archive">("orange");
  const [uploadingFiles, setUploadingFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

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
  const filteredFolders = folders.filter((folder: any) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter((file: any) => {
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

  // Gestionnaires d'événements
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      uploadFilesMutation.mutate(files);
    }
    // Reset input pour permettre de re-sélectionner le même fichier
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      uploadFilesMutation.mutate(files);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
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

  const triggerFileInput = () => {
    console.log('[ui] Triggering file input click');
    fileInputRef.current?.click();
  };

  const triggerFolderInput = () => {
    console.log('[ui] Triggering folder input click');
    folderInputRef.current?.click();
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
          
          {/* Boutons d'actions séparés comme l'original */}
          <div className="flex items-center gap-2">
            <Button 
              onClick={triggerFileInput}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Fichiers
            </Button>
            <Button 
              onClick={triggerFolderInput}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isUploading}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Upload Dossier
            </Button>
            <Button 
              onClick={() => setIsCreateFolderDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Nouveau Dossier
            </Button>
          </div>
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
        {/* Grid des dossiers et fichiers style OneDrive */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {/* Dossiers */}
          {filteredFolders.map((folder: any) => (
            <div
              key={folder.id}
              className="group cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
              onClick={() => {
                setCurrentFolderId(folder.id);
                setCurrentFolderName(folder.name);
              }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-2">
                  {getFolderIcon(folder.iconType)}
                </div>
                <p className="text-xs text-gray-900 truncate w-full font-medium">
                  {folder.name}
                </p>
              </div>
            </div>
          ))}

          {/* Fichiers */}
          {filteredFiles.map((file: any) => (
            <div
              key={file.id}
              className="group cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-2">
                  {getFileIcon(file.type, file.name)}
                </div>
                <p className="text-xs text-gray-900 truncate w-full font-medium">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Message si aucun élément */}
        {filteredFolders.length === 0 && filteredFiles.length === 0 && (
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
        webkitdirectory=""
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
    </div>
  );
}