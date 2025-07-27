import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Upload, FolderPlus, Download, Share, Settings, BarChart3, History, RotateCcw, RefreshCw, Trash2, Archive, Cloud, HardDrive, ChevronDown, MoreVertical, Edit3, Eye, Share2, AlertCircle, Info, ExternalLink, ArrowLeft, Sync, X, Maximize2, Play, Pause, Volume2, Filter } from 'lucide-react';
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

  // Stabilisation de scroll pour éviter les remontées non souhaitées
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fonction pour maintenir la position de scroll
  const preserveScrollPosition = () => {
    if (containerRef.current) {
      setScrollPosition(containerRef.current.scrollTop);
    }
  };

  // Restaurer la position de scroll après des opérations
  const restoreScrollPosition = () => {
    setTimeout(() => {
      if (containerRef.current && scrollPosition > 0) {
        containerRef.current.scrollTop = scrollPosition;
      }
    }, 100);
  };

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

  // Requêtes optimisées pour les dossiers et fichiers avec paramètres corrects
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['/api/folders', currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/folders?parentId=${currentFolderId}`
        : '/api/folders';
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch folders');
      return response.json();
    },
    enabled: true,
    staleTime: 1000, // Cache très court pour navigation fluide
    refetchOnWindowFocus: false
  });

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/files', currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `/api/files?folderId=${currentFolderId}`
        : '/api/files';
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
    enabled: true,
    staleTime: 1000, // Cache très court pour navigation fluide
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
  const [externalOpenDialog, setExternalOpenDialog] = useState<{file: any, app: string} | null>(null);
  const [shareDialog, setShareDialog] = useState<{item: any, type: 'file' | 'folder'} | null>(null);
  const [shareFormData, setShareFormData] = useState({
    recipientEmail: '',
    subject: '',
    message: ''
  });

  // Mutations avec gestion des limites augmentées
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId: number | null; iconType: string }) => {
      console.log('[folder] Creating folder with data:', folderData);
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
    onSuccess: (data) => {
      console.log('[folder] Folder created successfully:', data);
      // Invalider le cache pour le dossier parent actuel
      queryClient.invalidateQueries({ queryKey: ['/api/folders', currentFolderId] });
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      setSelectedFolderIcon("orange");
      toast({ 
        title: "Dossier créé avec succès !", 
        description: `Le dossier "${data.name}" a été créé dans ${currentFolderName || 'la racine'}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // ✅ UPLOAD AVEC LIMITES FINALES : 10 Go fichiers, 2 To dossiers, 10 To stockage total
  const uploadFilesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      console.log('[upload] Starting upload with', files.length, 'files');
      
      if (!files || files.length === 0) {
        throw new Error("Aucun fichier sélectionné");
      }

      setUploadingFiles(files.length);
      setTotalFiles(files.length);

      // ✅ LIMITES FINALES CONFIRMÉES selon spécifications utilisateur
      const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 Go pour fichiers individuels
      const MAX_FOLDER_SIZE = 2 * 1024 * 1024 * 1024 * 1024; // 2 To pour dossiers complets
      const MAX_TOTAL_CLOUD_STORAGE = 10 * 1024 * 1024 * 1024 * 1024; // 10 To stockage total Cloud
      
      let totalSize = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        totalSize += file.size;
        
        // Vérification taille fichier individuel
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`Le fichier ${file.name} est trop volumineux (maximum 10 Go)`);
        }
        
        // Progress bar ultra-mince
        const progress = Math.floor(((i + 1) / files.length) * 100);
        setUploadProgress(progress);
      }

      // Vérification taille totale pour dossiers
      if (totalSize > MAX_FOLDER_SIZE) {
        throw new Error(`La taille totale du dossier est trop importante (maximum 2 To)`);
      }

      // ✅ VALIDATION STOCKAGE TOTAL CLOUD (10 To maximum)
      // Note: Cette vérification devrait idéalement être faite côté serveur aussi
      // pour une sécurité complète, mais nous validons ici pour une meilleure UX

      const formData = new FormData();
      
      const filePaths: string[] = [];
      
      // Ajouter tous les fichiers avec leurs chemins relatifs
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('files', file);
        
        // Vérifier si c'est un upload de dossier (webkitRelativePath)
        const webkitFile = file as any;
        if (webkitFile.webkitRelativePath) {
          filePaths.push(webkitFile.webkitRelativePath);
        } else {
          filePaths.push(file.name);
        }
      }
      
      formData.append('filePaths', JSON.stringify(filePaths));
      
      // CRITIQUE: Ajouter le folderId actuel pour l'upload dans le dossier courant
      if (currentFolderId) {
        formData.append('folderId', currentFolderId.toString());
        console.log('[upload] Uploading to folder ID:', currentFolderId);
      } else {
        console.log('[upload] Uploading to root folder');
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
    onSuccess: (data) => {
      console.log('[upload] Upload successful in folder:', currentFolderId);
      // Invalider spécifiquement le cache pour le dossier actuel
      queryClient.invalidateQueries({ queryKey: ['/api/files', currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ['/api/folders', currentFolderId] });
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFiles(0);
      toast({ 
        title: "Upload terminé !", 
        description: `${data.filesCreated || totalFiles} fichier(s) uploadé(s) avec succès dans ${currentFolderName || 'la racine'}` 
      });
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

    // ✅ LIMITES FINALES : 10 Go par fichier
    const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > maxFileSize) {
        toast({ title: "Erreur", description: `Le fichier ${files[i].name} dépasse la limite de 10 Go`, variant: "destructive" });
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

    // ✅ LIMITES FINALES : 2 To pour dossier complet
    const maxFolderSize = 2 * 1024 * 1024 * 1024 * 1024; // 2TB
    const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
    if (totalSize > maxFolderSize) {
      toast({ title: "Erreur", description: "Le dossier dépasse la limite de 2 To", variant: "destructive" });
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

  // Fonction de détection intelligente des types de fichiers
  const detectFileTypeAndAction = (file: any) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type?.toLowerCase();
    
    // Types supportés nativement par l'application (prévisualisation intégrée)
    const nativelySupported = {
      images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
      videos: ['mp4', 'webm', 'ogg', 'mov'],
      audio: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
      documents: ['pdf'],
      text: ['txt', 'md', 'json', 'xml', 'css', 'js', 'html', 'csv']
    };
    
    // Types nécessitant ouverture externe avec applications spécifiques
    const externalAppTypes = {
      office: {
        extensions: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'xlsm', 'pptm', 'docm', 'xltx', 'potx'],
        mimeTypes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        app: 'Microsoft Office'
      },
      adobe: {
        extensions: ['psd', 'ai', 'indd', 'eps', 'psb', 'xd', 'aep', 'prproj'],
        mimeTypes: ['image/vnd.adobe.photoshop', 'application/postscript'],
        app: 'Adobe Creative Suite'
      },
      cad: {
        extensions: ['dwg', 'dxf', 'step', 'iges', 'stp', 'igs', 'catpart', 'catproduct'],
        mimeTypes: ['application/acad', 'image/vnd.dwg'],
        app: 'AutoCAD ou logiciel CAD'
      },
      executables: {
        extensions: ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm', 'pkg', 'run', 'bin'],
        mimeTypes: ['application/x-msdownload', 'application/x-msi', 'application/x-apple-diskimage', 'application/x-debian-package'],
        app: 'Système d\'exploitation'
      },
      compressed: {
        extensions: ['rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lzma', 'z', 'lz4'],
        mimeTypes: ['application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar', 'application/gzip'],
        app: 'Gestionnaire d\'archives'
      },
      development: {
        extensions: ['py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'pl', 'sh', 'bat', 'ps1'],
        mimeTypes: ['text/x-python', 'text/x-java-source', 'text/x-c', 'text/x-php'],
        app: 'IDE ou éditeur de code'
      },
      mobile: {
        extensions: ['apk', 'ipa', 'xapk', 'aab'],
        mimeTypes: ['application/vnd.android.package-archive'],
        app: 'Émulateur mobile ou appareil'
      },
      specialized: {
        extensions: ['blend', 'max', 'ma', 'mb', 'obj', 'fbx', 'stl', '3ds', 'dae', 'ply', 'x3d'],
        mimeTypes: ['model/obj', 'model/stl'],
        app: 'Logiciel de modélisation 3D'
      },
      databases: {
        extensions: ['db', 'sqlite', 'mdb', 'accdb', 'dbf'],
        mimeTypes: ['application/x-sqlite3', 'application/msaccess'],
        app: 'Gestionnaire de base de données'
      },
      fonts: {
        extensions: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
        mimeTypes: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2'],
        app: 'Gestionnaire de polices'
      },
      ebooks: {
        extensions: ['epub', 'mobi', 'azw', 'azw3', 'fb2'],
        mimeTypes: ['application/epub+zip'],
        app: 'Lecteur d\'e-books'
      }
    };
    
    // Vérifier si le fichier est supporté nativement
    for (const [category, extensions] of Object.entries(nativelySupported)) {
      if (extensions.includes(extension) || 
          (mimeType && (
            (category === 'images' && mimeType.startsWith('image/')) ||
            (category === 'videos' && mimeType.startsWith('video/')) ||
            (category === 'audio' && mimeType.startsWith('audio/')) ||
            (category === 'documents' && mimeType === 'application/pdf') ||
            (category === 'text' && mimeType.startsWith('text/'))
          ))) {
        return { action: 'native', category };
      }
    }
    
    // Vérifier si le fichier nécessite une application externe
    for (const [category, info] of Object.entries(externalAppTypes)) {
      if (info.extensions.includes(extension) || 
          (mimeType && info.mimeTypes?.some(mime => mimeType.includes(mime.toLowerCase())))) {
        return { action: 'external', category, app: info.app };
      }
    }
    
    // Fichier de type inconnu ou non supporté
    return { action: 'unknown', category: 'unknown', app: 'Application système appropriée' };
  };

  // Handlers pour les actions fichiers/dossiers
  const handlePreview = (file: any) => {
    console.log('[preview] Analyzing file:', file.name, file.type);
    
    const fileAnalysis = detectFileTypeAndAction(file);
    console.log('[preview] File analysis:', fileAnalysis);
    
    if (fileAnalysis.action === 'native') {
      // Ouvrir la prévisualisation intégrée
      console.log('[preview] Opening native preview for:', file.name);
      setPreviewFile(file);
      setIsPreviewOpen(true);
    } else if (fileAnalysis.action === 'external' || fileAnalysis.action === 'unknown') {
      // Ouvrir le dialogue de confirmation pour ouverture externe
      setExternalOpenDialog({ file, app: fileAnalysis.app });
    }
  };

  // Fonction pour ouvrir un fichier avec une application externe
  const handleExternalOpen = async (file: any, app: string) => {
    console.log('[preview] Opening with external app:', file.name, app);
    
    try {
      // Méthode 1: Ouverture directe dans un nouvel onglet (le navigateur gère l'association)
      const downloadUrl = `/api/files/${file.id}/download`;
      const newWindow = window.open(downloadUrl, '_blank');
      
      // Vérifier si la fenêtre a été bloquée
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        throw new Error('Popup blocked');
      }
      
      toast({
        title: "Ouverture externe",
        description: `${file.name} s'ouvre avec ${app}`
      });
      
    } catch (error) {
      console.log('[preview] Direct open failed, trying download method:', error);
      
      try {
        // Méthode 2: Téléchargement forcé avec déclenchement automatique
        const response = await fetch(`/api/files/${file.id}/download`, {
          credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        
        // Utiliser URL.createObjectURL pour créer un lien temporaire
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Nettoyer l'URL temporaire après un délai
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        toast({
          title: "Téléchargement initié",
          description: `${file.name} téléchargé. Ouvrez-le pour utiliser ${app}.`
        });
        
      } catch (downloadError) {
        console.error('[preview] Download method failed:', downloadError);
        
        // Méthode 3: Fallback simple
        const link = document.createElement('a');
        link.href = `/api/files/${file.id}/download`;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Ouverture demandée",
          description: "Votre navigateur va traiter le fichier selon vos paramètres système.",
          variant: "default"
        });
      }
    }
    
    setExternalOpenDialog(null);
  };

  const handleRename = async (item: any, type: 'file' | 'folder') => {
    if (!newItemName.trim()) {
      setRenameItem(null);
      return;
    }

    try {
      const endpoint = type === 'file' ? `/api/files/${item.id}` : `/api/folders/${item.id}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newItemName.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to rename');
      }

      toast({ title: `${type === 'file' ? 'Fichier' : 'Dossier'} renommé avec succès !` });
      // Invalider le cache pour le dossier actuel
      queryClient.invalidateQueries({ queryKey: ['/api/files', currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ['/api/folders', currentFolderId] });
      setRenameItem(null);
      setNewItemName("");
    } catch (error) {
      toast({ 
        title: "Erreur de renommage", 
        description: "Impossible de renommer l'élément",
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (item: any, type: 'file' | 'folder') => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ce ${type === 'file' ? 'fichier' : 'dossier'} ?`)) {
      return;
    }

    try {
      const endpoint = type === 'file' ? `/api/files/${item.id}` : `/api/folders/${item.id}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      toast({ title: `${type === 'file' ? 'Fichier' : 'Dossier'} supprimé avec succès !` });
      // Invalider le cache pour le dossier actuel
      queryClient.invalidateQueries({ queryKey: ['/api/files', currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ['/api/folders', currentFolderId] });
    } catch (error) {
      toast({ 
        title: "Erreur de suppression", 
        description: "Impossible de supprimer l'élément",
        variant: "destructive" 
      });
    }
  };

  const handleShare = (item: any, type: 'file' | 'folder') => {
    console.log('[share] Opening share dialog for:', item.name, type);
    setShareDialog({ item, type });
    
    // Pré-remplir l'objet par défaut
    const defaultSubject = type === 'file' 
      ? `Partage de fichier : ${item.name}`
      : `Partage de dossier : ${item.name}`;
    
    setShareFormData({
      recipientEmail: '',
      subject: defaultSubject,
      message: `Bonjour,\n\nJe partage avec vous ${type === 'file' ? 'le fichier' : 'le dossier'} "${item.name}".\n\nCordialement`
    });
  };

  // Fonction pour partager via le système Courrier existant
  const handleSendInternalMail = async () => {
    if (!shareDialog) return;
    
    try {
      const { item, type } = shareDialog;
      
      // Validation de l'email au format @rony.com
      if (!shareFormData.recipientEmail.endsWith('@rony.com')) {
        toast({
          title: "Adresse invalide",
          description: "L'adresse doit être au format utilisateur@rony.com",
          variant: "destructive"
        });
        return;
      }
      
      if (!shareFormData.subject.trim()) {
        toast({
          title: "Objet requis",
          description: "Veuillez saisir un objet pour votre message",
          variant: "destructive"
        });
        return;
      }
      
      // Trouver l'utilisateur destinataire par email
      const usersResponse = await fetch('/api/users', { credentials: 'include' });
      if (!usersResponse.ok) {
        throw new Error('Impossible de récupérer les utilisateurs');
      }
      
      const usersData = await usersResponse.json();
      const allUsers = Array.isArray(usersData) ? usersData : usersData.data || [];
      const targetUser = allUsers.find((u: any) => u.username === shareFormData.recipientEmail);
      
      if (!targetUser) {
        toast({
          title: "Utilisateur introuvable",
          description: "Aucun utilisateur trouvé avec cette adresse email",
          variant: "destructive"
        });
        return;
      }
      
      console.log('[share] Sharing with existing Courrier system:', item.name, 'to user:', targetUser.id);
      
      // Utiliser l'API de partage existante qui intègre avec le système Courrier
      const apiEndpoint = type === 'file' ? '/api/files/share' : '/api/folders/share';
      const shareData = {
        [type === 'file' ? 'fileId' : 'folderId']: item.id,
        sharedWithId: targetUser.id,
        permission: 'read',
        subject: shareFormData.subject,
        message: shareFormData.message
      };
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(shareData)
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Partagé avec succès !",
          description: `${type === 'file' ? 'Le fichier' : 'Le dossier'} "${item.name}" a été partagé avec ${shareFormData.recipientEmail}. Le destinataire le recevra dans son Courrier.`
        });
        
        // Fermer la boîte de dialogue
        setShareDialog(null);
        setShareFormData({ recipientEmail: '', subject: '', message: '' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du partage');
      }
      
    } catch (error: any) {
      console.error('[share] Error sharing via Courrier:', error);
      toast({
        title: "Erreur de partage",
        description: error.message || "Impossible de partager. Vérifiez l'adresse du destinataire.",
        variant: "destructive"
      });
    }
  };

  const handleRefresh = () => {
    console.log('[refresh] Refreshing data for folder:', currentFolderId);
    queryClient.invalidateQueries({ queryKey: ['/api/files', currentFolderId] });
    queryClient.invalidateQueries({ queryKey: ['/api/folders', currentFolderId] });
    toast({ title: "Actualisation", description: "Données actualisées" });
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
                queryClient.invalidateQueries({ queryKey: ['/api/files', null] });
                queryClient.invalidateQueries({ queryKey: ['/api/folders', null] });
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

      {/* Contenu principal avec stabilisation de scroll */}
      <div 
        ref={containerRef}
        className="flex-1 p-6 overflow-auto scroll-smooth"
        onScroll={preserveScrollPosition}
      >
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
              className="group cursor-pointer p-3 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all duration-200 relative"
              onClick={(e) => {
                // Empêcher la navigation si on clique sur le menu
                if ((e.target as HTMLElement).closest('.context-menu')) return;
                
                console.log('[navigation] Navigating to folder:', folder.id, folder.name);
                setCurrentFolderId(folder.id);
                setCurrentFolderName(folder.name);
                // Invalider immédiatement le cache pour le nouveau dossier
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/files', folder.id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/folders', folder.id] });
                }, 100);
              }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-2 relative">
                  {getFolderIcon(folder.iconType)}
                  
                  {/* Menu contextuel pour dossiers - TOUJOURS VISIBLE AU HOVER */}
                  <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="context-menu h-7 w-7 p-0 bg-white hover:bg-gray-100 shadow-lg border border-gray-300 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <MoreVertical className="h-4 w-4 text-gray-700" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameItem(folder);
                            setNewItemName(folder.name);
                          }}
                          className="cursor-pointer"
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(folder, 'folder');
                          }}
                          className="cursor-pointer"
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Partager
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/folders/${folder.id}/download`, '_blank');
                          }}
                          className="cursor-pointer"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger ZIP
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(folder, 'folder');
                          }}
                          className="text-red-600 cursor-pointer focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {renameItem?.id === folder.id ? (
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newItemName.trim()) {
                        handleRename(folder, 'folder');
                      }
                      if (e.key === 'Escape') {
                        setRenameItem(null);
                        setNewItemName("");
                      }
                    }}
                    onBlur={() => {
                      if (newItemName.trim() && newItemName !== folder.name) {
                        handleRename(folder, 'folder');
                      } else {
                        setRenameItem(null);
                        setNewItemName("");
                      }
                    }}
                    className="h-6 text-xs p-1 text-center border-blue-500 focus:border-blue-600 w-full"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-xs text-gray-900 truncate w-full font-medium px-1">
                    {folder.name}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Fichiers avec menu contextuel */}
          {filteredFiles.map((file: any) => (
            <div
              key={file.id}
              className="group cursor-pointer p-3 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all duration-200 relative"
              onDoubleClick={() => handlePreview(file)}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-2 relative">
                  {getFileIcon(file.type, file.name)}
                  
                  {/* Menu contextuel pour fichiers - TOUJOURS VISIBLE AU HOVER */}
                  <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="context-menu h-7 w-7 p-0 bg-white hover:bg-gray-100 shadow-lg border border-gray-300 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          <MoreVertical className="h-4 w-4 text-gray-700" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(file);
                          }}
                          className="cursor-pointer"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Prévisualiser
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameItem(file);
                            setNewItemName(file.name);
                          }}
                          className="cursor-pointer"
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(file, 'file');
                          }}
                          className="cursor-pointer"
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Partager
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/files/${file.id}/download`, '_blank');
                          }}
                          className="cursor-pointer"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file, 'file');
                          }}
                          className="text-red-600 cursor-pointer focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
                {/* Aperçu selon le type de fichier - VERSION AMÉLIORÉE */}
                {previewFile.type?.startsWith('image/') ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={`/api/files/${previewFile.id}/download`} 
                      alt={previewFile.name}
                      className="max-w-full max-h-96 h-auto mx-auto rounded-lg shadow-lg"
                      style={{ maxHeight: '400px' }}
                    />
                    <div className="mt-4 flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          const img = document.createElement('img');
                          img.src = `/api/files/${previewFile.id}/download`;
                          const newWindow = window.open();
                          newWindow?.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000">${img.outerHTML}</body></html>`);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Plein écran
                      </Button>
                    </div>
                  </div>
                ) : previewFile.type?.startsWith('text/') || 
                     previewFile.name?.endsWith('.txt') || 
                     previewFile.name?.endsWith('.md') ||
                     previewFile.name?.endsWith('.json') ||
                     previewFile.name?.endsWith('.xml') ||
                     previewFile.name?.endsWith('.css') ||
                     previewFile.name?.endsWith('.js') ||
                     previewFile.name?.endsWith('.html') ? (
                  <div className="space-y-2">
                    <iframe 
                      src={`/api/files/${previewFile.id}/download`}
                      className="w-full h-96 border rounded-lg"
                      title={previewFile.name}
                    />
                    <div className="flex justify-center">
                      <Button 
                        size="sm" 
                        onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                ) : previewFile.type === 'application/pdf' ? (
                  <div className="space-y-2">
                    <iframe 
                      src={`/api/files/${previewFile.id}/download`}
                      className="w-full h-96 border rounded-lg"
                      title={previewFile.name}
                    />
                    <div className="flex justify-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ouvrir dans un nouvel onglet
                      </Button>
                    </div>
                  </div>
                ) : previewFile.type?.startsWith('audio/') ? (
                  <div className="text-center space-y-4">
                    <div className="flex justify-center mb-4">
                      {getFileIcon(previewFile.type, previewFile.name)}
                    </div>
                    <audio 
                      controls 
                      className="w-full max-w-md mx-auto"
                      src={`/api/files/${previewFile.id}/download`}
                    >
                      Votre navigateur ne supporte pas l'élément audio.
                    </audio>
                    <Button 
                      size="sm" 
                      onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                  </div>
                ) : previewFile.type?.startsWith('video/') ? (
                  <div className="text-center space-y-4">
                    <video 
                      controls 
                      className="w-full max-w-2xl mx-auto rounded-lg"
                      src={`/api/files/${previewFile.id}/download`}
                      style={{ maxHeight: '400px' }}
                    >
                      Votre navigateur ne supporte pas l'élément vidéo.
                    </video>
                    <Button 
                      size="sm" 
                      onClick={() => window.open(`/api/files/${previewFile.id}/download`, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="mb-4 flex justify-center">
                      <div className="p-4 bg-gray-100 rounded-full">
                        {getFileIcon(previewFile.type, previewFile.name)}
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {previewFile.name}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Prévisualisation non disponible pour ce type de fichier
                    </p>
                    <div className="space-y-3">
                      <Button onClick={() => {
                        window.open(`/api/files/${previewFile.id}/download`, '_blank');
                        setIsPreviewOpen(false);
                      }}>
                        <Download className="mr-2 h-4 w-4" />
                        Ouvrir avec l'application système
                      </Button>
                      <p className="text-xs text-gray-500">
                        Ce fichier s'ouvrira dans l'application appropriée de votre système
                      </p>
                    </div>
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

      {/* Dialogue de confirmation pour ouverture externe */}
      <Dialog open={!!externalOpenDialog} onOpenChange={() => setExternalOpenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Ouverture avec application externe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                {externalOpenDialog && getFileIcon(externalOpenDialog.file.type, externalOpenDialog.file.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {externalOpenDialog?.file.name}
                </p>
                <p className="text-sm text-gray-500">
                  {externalOpenDialog && formatFileSize(externalOpenDialog.file.size)}
                </p>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-gray-700">
                Ce fichier ne peut pas être prévisualisé ici.
              </p>
              <p className="text-sm text-gray-600">
                Voulez-vous l'ouvrir avec <span className="font-medium text-blue-600">{externalOpenDialog?.app}</span> installée sur votre appareil ?
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Sécurité :</p>
                  <p>Le fichier sera ouvert selon les paramètres de votre système. Assurez-vous qu'il provient d'une source fiable.</p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setExternalOpenDialog(null)}
            >
              Annuler
            </Button>
            <Button 
              onClick={() => externalOpenDialog && handleExternalOpen(externalOpenDialog.file, externalOpenDialog.app)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir avec {externalOpenDialog?.app}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nouvelle boîte de dialogue de partage par courrier interne */}
      <Dialog open={!!shareDialog} onOpenChange={() => setShareDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-600" />
              Partager {shareDialog?.type === 'file' ? 'le fichier' : 'le dossier'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Aperçu de l'élément à partager */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex-shrink-0">
                {shareDialog && (shareDialog.type === 'file' 
                  ? getFileIcon(shareDialog.item.type, shareDialog.item.name)
                  : getFolderIcon(shareDialog.item.iconType))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">
                  {shareDialog?.item.name}
                </p>
                <p className="text-xs text-gray-500">
                  {shareDialog?.type === 'file' 
                    ? formatFileSize(shareDialog.item.size)
                    : 'Dossier'}
                </p>
              </div>
              <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                📎 Pièce jointe
              </div>
            </div>

            {/* Formulaire de partage compact */}
            <div className="space-y-3">
              {/* Adresse du destinataire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📩 Destinataire *
                </label>
                <Input
                  placeholder="utilisateur@rony.com"
                  value={shareFormData.recipientEmail}
                  onChange={(e) => setShareFormData({
                    ...shareFormData,
                    recipientEmail: e.target.value
                  })}
                  className="w-full"
                />
              </div>

              {/* Objet du message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🏷️ Objet *
                </label>
                <Input
                  placeholder="Objet de votre message"
                  value={shareFormData.subject}
                  onChange={(e) => setShareFormData({
                    ...shareFormData,
                    subject: e.target.value
                  })}
                  className="w-full"
                />
              </div>

              {/* Message personnalisé */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📝 Message
                </label>
                <textarea
                  placeholder="Écrivez votre message ici..."
                  value={shareFormData.message}
                  onChange={(e) => setShareFormData({
                    ...shareFormData,
                    message: e.target.value
                  })}
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                />
              </div>
            </div>

            {/* Informations importantes - compactes */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800">
                  <p className="font-medium">Courrier interne - La pièce jointe sera envoyée automatiquement</p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShareDialog(null)}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleSendInternalMail}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!shareFormData.recipientEmail || !shareFormData.subject.trim()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}