import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
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

  // Upload de fichiers avec optimisations
  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      if (currentFolderId) {
        formData.append('folderId', currentFolderId.toString());
      }

      return apiRequest('/api/upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      setIsUploading(false);
      setUploadProgress({});
      toast({ title: "Fichiers uploadés avec succès !" });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress({});
      toast({ title: "Erreur d'upload", variant: "destructive" });
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
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerFolderInput = () => {
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
          
          {/* Menu Actions Cloud unifié */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Settings className="mr-2 h-4 w-4" />
                Actions Cloud
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={triggerFileInput}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Fichiers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={triggerFolderInput}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Upload Dossier
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FolderPlus className="mr-2 h-4 w-4" />
                Nouveau Dossier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <RotateCcw className="mr-2 h-4 w-4" />
                Synchroniser Bureau
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BarChart3 className="mr-2 h-4 w-4" />
                Statistiques
              </DropdownMenuItem>
              <DropdownMenuItem>
                <History className="mr-2 h-4 w-4" />
                Historique
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        {/* Progress bars ultra-minces */}
        {isUploading && (
          <div className="mt-2 space-y-1">
            <div className="h-1 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-gray-500">Upload en cours...</p>
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
        onChange={handleFileUpload}
        className="hidden"
        webkitdirectory=""
      />
    </div>
  );
}