import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
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
  Edit,
  CheckCircle,
  RefreshCw,
  Monitor
} from "lucide-react";

// Import des icônes personnalisées et de l'arrière-plan
import folderOrangeIcon from "@assets/icons8-dossier-mac-94_1750386744627.png";
import folderBlueIcon from "@assets/icons8-dossier-mac-64_1750386753922.png";
import folderArchiveIcon from "@assets/icons8-dossier-mac-48_1750386762042.png";


// Import des icônes de fichiers
import imageIcon from "@assets/icons8-image-50_1750773959798.png";
import excelIcon from "@assets/icons8-microsoft-excel-2019-50_1750774269876.png";
import powerpointIcon from "@assets/icons8-ms-powerpoint-50_1750774279717.png";
import csvIcon from "@assets/icons8-fichier-csv-50_1750774291865.png";
import audioIcon from "@assets/icons8-fichier-audio-50_1750774307203.png";
import videoIcon from "@assets/icons8-fichier-vidéo-64_1750774317888.png";

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
  const folderInputRef = useRef<HTMLInputElement>(null);

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
  const [shareSubject, setShareSubject] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedFiles, setSyncedFiles] = useState<Set<string>>(new Set());

  // Charger la liste des fichiers synchronisés au démarrage
  useEffect(() => {
    const stored = localStorage.getItem('syncedFiles');
    if (stored) {
      try {
        const parsedFiles = JSON.parse(stored);
        setSyncedFiles(new Set(parsedFiles));
      } catch (e) {
        console.error('Error loading synced files:', e);
      }
    }
  }, []);

  // Requêtes
  const { data: folders = [], isLoading: foldersLoading, error: foldersError } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: async () => {
      const res = await fetch(`/api/folders?parentId=${currentFolderId || 'null'}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    },
    enabled: !!user
  });

  const { data: files = [], isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ["files", currentFolderId],
    queryFn: async () => {
      const res = await fetch(`/api/files?folderId=${currentFolderId || 'null'}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    enabled: !!user
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId: number | null; iconType: string }) => {
      const res = await apiRequest("POST", "/api/folders", folderData);
      if (!res.ok) throw new Error("Failed to create folder");
      return res.json();
    },
    onSuccess: (data) => {
      console.log('Folder created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
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
        credentials: 'include'
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Failed to upload files');
      }
      return res.json();
    },
    onSuccess: (data) => {
      console.log('Files uploaded successfully:', data);
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast({ 
        title: "Upload réussi", 
        description: data.message || "Fichiers uploadés avec succès" 
      });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      toast({ 
        title: "Erreur lors de l'upload", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const uploadFolderMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setTotalFiles(files.length);
      setUploadingFiles(0);
      setUploadProgress(0);

      const formData = new FormData();
      const folderStructure: { [key: string]: string[] } = {};
      const filePaths: string[] = [];

      // Traitement rapide des fichiers
      Array.from(files).forEach((file, index) => {
        const relativePath = file.webkitRelativePath || file.name;
        const pathParts = relativePath.split('/');
        const folderPath = pathParts.slice(0, -1).join('/');

        formData.append('files', file);
        filePaths.push(relativePath);

        if (folderPath && !folderStructure[folderPath]) {
          folderStructure[folderPath] = [];
        }
        if (folderPath) {
          folderStructure[folderPath].push(relativePath);
        }
      });

      filePaths.forEach(path => {
        formData.append('filePaths', path);
      });

      formData.append('folderId', currentFolderId?.toString() || 'null');
      formData.append('folderStructure', JSON.stringify(folderStructure));

      // Créer un XMLHttpRequest pour suivre la progression
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || 'Upload failed'));
            } catch (e) {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', '/api/upload-folder');
        xhr.send(formData);
      });
    },
    onSuccess: (data: any) => {
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });

      const message = `Upload terminé! ${data.foldersCreated || 0} dossier(s), ${data.filesUploaded || 0} fichier(s)`;
      toast({ title: message });

      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }

      // Reset progress après 2 secondes
      setTimeout(() => {
        setUploadProgress(0);
        setTotalFiles(0);
        setUploadingFiles(0);
      }, 2000);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      setTotalFiles(0);
      setUploadingFiles(0);
      toast({ 
        title: "Erreur d'upload", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Mutation pour la synchronisation du bureau
  const syncDesktopMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      setSyncProgress(0);

      // Créer un input pour sélectionner les fichiers du bureau
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.webkitdirectory = true;

      return new Promise((resolve, reject) => {
        input.onchange = async (event) => {
          const files = (event.target as HTMLInputElement).files;
          if (!files || files.length === 0) {
            reject(new Error('Aucun fichier sélectionné'));
            return;
          }

          try {
            // Récupérer la liste des fichiers déjà synchronisés
            const existingFilesResponse = await fetch('/api/sync/files');
            const existingFiles = existingFilesResponse.ok ? await existingFilesResponse.json() : [];

            // Créer une carte des fichiers existants avec nom et taille pour éviter les doublons
            const existingFileMap = new Map();
            existingFiles.forEach((f: any) => {
              const key = `${f.name}_${f.size}`;
              existingFileMap.set(key, f);
            });

            // Filtrer les nouveaux fichiers uniquement (basé sur nom + taille)
            const newFiles = Array.from(files).filter(file => {
              const key = `${file.name}_${file.size}`;
              return !existingFileMap.has(key) && !syncedFiles.has(file.name);
            });

            if (newFiles.length === 0) {
              toast({ title: "Synchronisation terminée", description: "Aucun nouveau fichier à synchroniser" });
              resolve({ message: 'No new files', filesUploaded: 0 });
              return;
            }

            // Créer le FormData pour l'upload
            const formData = new FormData();
            const filePaths: string[] = [];

            newFiles.forEach((file) => {
              const relativePath = file.webkitRelativePath || file.name;
              formData.append('files', file);
              filePaths.push(relativePath);
            });

            filePaths.forEach(path => {
              formData.append('filePaths', path);
            });

            formData.append('folderId', 'sync');
            formData.append('isSync', 'true');

            // Upload avec suivi de progression
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                setSyncProgress(progress);
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  // Marquer les fichiers comme synchronisés
                  const newSyncedFiles = new Set([...syncedFiles, ...newFiles.map(f => f.name)]);
                  setSyncedFiles(newSyncedFiles);
                  localStorage.setItem('syncedFiles', JSON.stringify([...newSyncedFiles]));
                  resolve(data);
                } catch (e) {
                  reject(new Error('Erreur de parsing de la réponse'));
                }
              } else {
                reject(new Error('Échec de la synchronisation'));
              }
            });

            xhr.addEventListener('error', () => {
              reject(new Error('Erreur réseau lors de la synchronisation'));
            });

            xhr.open('POST', '/api/upload-folder');
            xhr.send(formData);

          } catch (error) {
            reject(error);
          }
        };

        input.click();
      });
    },
    onSuccess: (data: any) => {
      setSyncProgress(100);
      setIsSyncing(false);
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });

      const message = `Synchronisation terminée! ${data.filesUploaded || 0} nouveau(x) fichier(s) synchronisé(s)`;
      toast({ title: message });

      setTimeout(() => {
        setSyncProgress(0);
      }, 2000);
    },
    onError: (error: Error) => {
      setSyncProgress(0);
      setIsSyncing(false);
      toast({ 
        title: "Erreur de synchronisation", 
        description: error.message, 
        variant: "destructive" 
      });
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
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
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
    mutationFn: async ({ fileId, email, permission, subject, message, isFolder }: { 
      fileId: number; 
      email: string; 
      permission: string; 
      subject: string; 
      message: string;
      isFolder: boolean;
    }) => {
      // Get user by email/username
      const userRes = await fetch(`/api/users?email=${email}`);
      if (!userRes.ok) throw new Error("Adresse Rony introuvable");
      const users = await userRes.json();
      if (!users.data || users.data.length === 0) throw new Error("Adresse Rony introuvable");

      const sharedWithId = users.data[0].id;

      // Share the file/folder
      const endpoint = isFolder ? "/api/folders/share" : "/api/files/share";
      const res = await apiRequest("POST", endpoint, {
        [isFolder ? "folderId" : "fileId"]: fileId,
        sharedWithId,
        permission,
        subject,
        message
      });
      if (!res.ok) throw new Error("Échec du partage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      setIsShareDialogOpen(false);
      setItemToShare(null);
      setShareEmail("");
      setShareSubject("");
      setShareMessage("");
      toast({ title: "Envoyé avec succès dans le Courrier du destinataire" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de l'envoi", description: error.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast({ title: "Élément supprimé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur lors de la suppression", description: error.message, variant: "destructive" });
    }
  });

  // Fonctions utilitaires
  const getFileIcon = (type: string, fileName: string) => {
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

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Vérifier que les fichiers ont des chemins relatifs (webkitRelativePath)
      const hasValidPaths = Array.from(files).some(file => file.webkitRelativePath);

      if (!hasValidPaths) {
        toast({ 
          title: "Erreur de sélection", 
          description: "Veuillez sélectionner un dossier entier, pas des fichiers individuels", 
          variant: "destructive" 
        });
        return;
      }

      console.log(`Uploading folder with ${files.length} files`);
      uploadFolderMutation.mutate(files);
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
    setShareSubject(`Partage ${isFolder ? 'de dossier' : 'de fichier'} : ${name}`);
    setShareMessage(`Bonjour,\n\nJe partage avec vous ${isFolder ? 'le dossier' : 'le fichier'} "${name}".\n\nCordialement,`);
    setIsShareDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteItemMutation.mutate({ 
        id: itemToDelete.id, 
        isFolder: itemToDelete.isFolder 
      });
    }
  };

  const handleConfirmRename = () => {
    if (itemToRename && newItemName.trim() && newItemName.trim() !== itemToRename.name) {
      renameMutation.mutate({ 
        id: itemToRename.id, 
        name: newItemName.trim(), 
        isFolder: itemToRename.isFolder 
      });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerFolderInput = () => {
    folderInputRef.current?.click();
  };

  // Filtrage des données
  const filteredFolders = folders.filter((folder: Folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter((file: File) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex-1 flex flex-col overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
          {/* Header avec titre et actions principales */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Cloud</h2>
            <div className="flex flex-col space-y-3">
              <div className="flex space-x-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  multiple 
                />
                <input 
                  type="file" 
                  ref={folderInputRef} 
                  onChange={handleFolderUpload} 
                  className="hidden" 
                  {...({ webkitdirectory: "", directory: "" } as any)}
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
                  onClick={triggerFolderInput}
                  variant="outline"
                  className="flex items-center space-x-2"
                  disabled={uploadFolderMutation.isPending}
                >
                  <Upload className="h-4 w-4" />
                  <span>{uploadFolderMutation.isPending ? `Uploading... ${uploadProgress}%` : 'Upload Folder'}</span>
                </Button>
                <Button
                  onClick={() => setIsCreateFolderDialogOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>New Folder</span>
                </Button>
                <Button
                  onClick={() => syncDesktopMutation.mutate()}
                  variant="default"
                  className="flex items-center space-x-2"
                  disabled={isSyncing}
                >
                  {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}
                  <span>{isSyncing ? `Synchronisation... ${syncProgress}%` : 'Sync Bureau'}</span>
                </Button>
              </div>

              {/* Barre de progression pour l'upload */}
              {uploadFolderMutation.isPending && totalFiles > 0 && (
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Upload en cours...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1" />
                  <div className="text-xs text-gray-500 mt-1">
                    {totalFiles} fichier(s) à traiter
                  </div>
                </div>
              )}

              {/* Barre de progression pour la synchronisation */}
              {isSyncing && (
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-sm text-blue-600 mb-1">
                    <span>Synchronisation bureau...</span>
                    <span>{syncProgress}%</span>
                  </div>
                  <Progress value={syncProgress} className="h-1" />
                  <div className="text-xs text-blue-500 mt-1">
                    Analyse des nouveaux fichiers...
                  </div>
                </div>
              )}
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
```text
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
            {/* Indicateurs de statut (plus discrets) */}
            {(foldersLoading || filesLoading) && (
              <div className="text-sm text-blue-600 mb-2">Chargement...</div>
            )}
            {(foldersError || filesError) && (
              <div className="text-sm text-red-600 mb-2">Erreur de chargement</div>
            )}

            {/* Grille des dossiers */}
            {filteredFolders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Dossiers ({filteredFolders.length})</h3>
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
                      <div className="h-16 bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-2">
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} className="h-8 w-8 object-cover rounded" />
                        ) : (
                          getFileIcon(file.type, file.name)
                        )}
                      </div>
                      <div className="p-2">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-sm truncate flex-1 mr-1" title={file.name}>{file.name}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 flex-shrink-0"
                              >
                                <MoreVertical className="h-3 w-3" />
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
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    const link = document.createElement('a');
                                    link.href = file.url;
                                    link.download = file.name;
                                    link.style.display = 'none';
                                    document.body.appendChild(link);
                                    link.click();
                                    setTimeout(() => {
                                      document.body.removeChild(link);
                                    }, 100);
                                    toast({ title: "Téléchargement", description: `Téléchargement de ${file.name} démarré` });
                                  } catch (error) {
                                    console.error('Download error:', error);
                                    toast({ title: "Erreur", description: "Impossible de télécharger le fichier", variant: "destructive" });
                                  }
                                }}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Télécharger
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
                  handleConfirmRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!newItemName.trim() || renameMutation.isPending}
            >
              {renameMutation.isPending ? "Renommage..." : "Renommer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de partage moderne */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          {/* Header moderne avec fond bleu */}
          <div className="bg-blue-500 text-white px-4 py-3 -mx-6 -mt-6 mb-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Nouveau Message</h2>
              <Button variant="ghost" size="sm" className="text-white hover:bg-blue-600 p-1 rounded-full" onClick={() => setIsShareDialogOpen(false)}>
                <span className="text-lg">✕</span>
              </Button>
            </div>
          </div>

          {/* Contenu moderne amélioré */}
          <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium w-8 text-gray-700">À:</span>
                  <div className="flex-1 relative">
                    <Input
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="Destinataire (ex: nom@rony.com)"
                      className="text-sm pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      {shareEmail && shareEmail.includes('@') && shareEmail.includes('rony.com') ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ) : shareEmail && shareEmail.includes('@') ? (
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
                {shareEmail && shareEmail.includes('@') && (
                  <div className="ml-10 text-xs flex items-center space-x-1">
                    {shareEmail.includes('rony.com') ? (
                      <>
                        <span className="text-green-600">✓</span>
                        <span className="text-green-600">Adresse Rony valide</span>
                      </>
                    ) : (
                      <>
                        <span className="text-orange-600">⚠</span>
                        <span className="text-orange-600">Utilisez une adresse @rony.com</span>
                      </>
                    )}
                  </div>
                )}
              </div>

            {/* Options de priorité simplifiées */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium w-8 text-gray-700">Type:</span>
              <div className="flex space-x-1">
                <button
                  onClick={() => setSharePermission("read")}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    sharePermission === "read" 
                      ? "bg-blue-100 text-blue-700" 
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setSharePermission("admin")}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    sharePermission === "admin" 
                      ? "bg-red-100 text-red-700" 
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Urgent
                </button>
              </div>
            </div>

            {/* Champ objet avec compteur */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium w-8 text-gray-700">Obj:</span>
                <div className="flex-1 relative">
                  <Input
                    value={shareSubject}
                    onChange={(e) => setShareSubject(e.target.value)}
                    placeholder="Objet du message"
                    className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="ml-10 text-xs text-gray-400">
                {shareSubject.length}/100 caractères
              </div>
            </div>

            {/* Zone de message */}
            <div>
              <textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder="Votre message..."
                className="w-full h-20 p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                maxLength={300}
              />
              <div className="text-xs text-gray-400 mt-1">{shareMessage.length}/300</div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsShareDialogOpen(false)}
                className="text-xs px-3 py-1"
              >
                Annuler
              </Button>
              <Button 
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1"
                onClick={() => {
                  if (shareEmail.trim() && shareSubject.trim() && itemToShare) {
                    const endpoint = itemToShare.isFolder ? "/api/folders/share-message" : "/api/files/share-message";
                    const payload = itemToShare.isFolder ? {
                      folderId: itemToShare.id,
                      recipientEmail: shareEmail.trim(),
                      permission: sharePermission,
                      subject: shareSubject.trim(),
                      message: shareMessage.trim()
                    } : {
                      fileId: itemToShare.id,
                      recipientEmail: shareEmail.trim(),
                      permission: sharePermission,
                      subject: shareSubject.trim(),  
                      message: shareMessage.trim()
                    };

                    apiRequest("POST", endpoint, payload).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
                      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
                      setIsShareDialogOpen(false);
                      setItemToShare(null);
                      setShareEmail("");
                      setShareSubject("");
                      setShareMessage("");
                      toast({ 
                        title: "Message envoyé avec succès", 
                        description: "Le destinataire recevra votre message dans son Courrier"
                      });
                    }).catch((error) => {
                      toast({ 
                        title: "Erreur lors de l'envoi", 
                        description: error.message, 
                        variant: "destructive" 
                      });
                    });
                  }
                }}
                disabled={!shareEmail.trim() || !shareSubject.trim() || shareMutation.isPending}
              >
                {shareMutation.isPending ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </div>

          {/* Information sur la pièce jointe */}
          {itemToShare && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg border">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-xs">
                  {itemToShare.isFolder ? "📁" : "📄"}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-900">
                    {itemToShare.isFolder ? "Dossier" : "Fichier"} : {itemToShare.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Sera envoyé vers le Courrier
                  </p>
                </div>
              </div>
            </div>
          )}
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
              onClick={handleConfirmDelete}
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