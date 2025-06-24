import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  Monitor,
  ArrowLeft
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

  // Requêtes pour les dossiers et fichiers avec gestion d'erreurs améliorée
  const { data: folders = [], isLoading: foldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: async () => {
      const response = await fetch(`/api/folders?parentId=${currentFolderId || 'null'}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch folders');
      }
      return response.json();
    },
    retry: 3,
    retryDelay: 1000,
  });

  const { data: files = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ["files", currentFolderId],
    queryFn: async () => {
      const response = await fetch(`/api/files?folderId=${currentFolderId || 'null'}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch files');
      }
      return response.json();
    },
    retry: 3,
    retryDelay: 1000,
  });

  // Query pour récupérer tous les dossiers (pour la navigation)
  const { data: allFolders = [] } = useQuery({
    queryKey: ["all-folders"],
    queryFn: async () => {
      console.log('[query] Fetching all folders for navigation');
      const response = await fetch(`/api/folders/all`, {
        credentials: 'include'
      });
      if (!response.ok) {
        console.warn('[query] Failed to fetch all folders:', response.status, response.statusText);
        return [];
      }
      const folders = await response.json();
      console.log('[query] All folders received:', folders.length, 'folders');
      return folders;
    },
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Mutations améliorées avec gestion d'erreurs robuste
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId: number | null; iconType: string }) => {
      if (!folderData.name.trim()) {
        throw new Error("Le nom du dossier ne peut pas être vide");
      }
      if (folderData.name.length > 255) {
        throw new Error("Le nom du dossier est trop long (maximum 255 caractères)");
      }
      
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(folderData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create folder';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
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
      console.error('Create folder error:', error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      console.log('[upload] Starting upload mutation with', files.length, 'files');
      
      if (!files || files.length === 0) {
        console.error('[upload] No files provided to upload mutation');
        throw new Error("Aucun fichier sélectionné");
      }

      const formData = new FormData();
      
      // Log each file being added
      Array.from(files).forEach((file, index) => {
        console.log(`[upload] Adding file ${index + 1}/${files.length}:`, file.name, 'type:', file.type, 'size:', file.size);
        
        if (file.size > 100 * 1024 * 1024) { // 100MB limit
          throw new Error(`Le fichier ${file.name} est trop volumineux (maximum 100MB)`);
        }
        formData.append('files', file);
      });
      
      if (currentFolderId) {
        console.log('[upload] Setting folderId to:', currentFolderId);
        formData.append('folderId', currentFolderId.toString());
      }

      console.log('[upload] Sending request to /api/upload');
      console.log('[upload] FormData entries:');
      for (let pair of formData.entries()) {
        console.log('[upload] FormData entry:', pair[0], typeof pair[1] === 'object' ? 'File object' : pair[1]);
        if (pair[1] instanceof File) {
          console.log('[upload] File details:', pair[1].name, pair[1].size, pair[1].type);
        }
      }
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('[upload] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[upload] Server error:', response.status, errorText);
        let errorMessage = 'Upload failed';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[upload] Upload successful:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[upload] Upload mutation completed successfully');
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["all-folders"] });
      setUploadProgress(0);
      setTotalFiles(0);
      setUploadingFiles(0);
      toast({ 
        title: "Upload terminé", 
        description: `${data.files?.length || data.filesCreated || 0} fichiers uploadés avec succès.` 
      });
    },
    onError: (error: Error) => {
      console.error('[upload] Upload mutation failed:', error);
      setUploadProgress(0);
      setTotalFiles(0);
      setUploadingFiles(0);
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
    }
  });

  const uploadFolderMutation = useMutation({
    mutationFn: async (files: FileList) => {
      console.log('[folder-upload] Starting folder upload mutation with', files.length, 'files');
      
      if (!files || files.length === 0) {
        console.error('[folder-upload] No files provided to folder upload mutation');
        throw new Error("Aucun fichier sélectionné");
      }

      setUploadingFiles(files.length);
      setTotalFiles(files.length);

      const formData = new FormData();
      const filePaths: string[] = [];

      // Log each file being added
      Array.from(files).forEach((file, index) => {
        console.log(`[folder-upload] Adding file ${index + 1}/${files.length}:`, file.name, 'webkitRelativePath:', file.webkitRelativePath, 'type:', file.type, 'size:', file.size);
        
        if (file.size > 100 * 1024 * 1024) {
          throw new Error(`Le fichier ${file.name} est trop volumineux (maximum 100MB)`);
        }
        const relativePath = file.webkitRelativePath || file.name;
        formData.append('files', file);
        filePaths.push(relativePath);
      });

      // Send file paths as JSON array
      formData.append('filePaths', JSON.stringify(filePaths));

      if (currentFolderId) {
        console.log('[folder-upload] Setting folderId to:', currentFolderId);
        formData.append('folderId', currentFolderId.toString());
      }

      console.log('[folder-upload] Sending request to /api/upload');
      console.log('[folder-upload] FormData entries:');
      for (let pair of formData.entries()) {
        console.log('[folder-upload] FormData entry:', pair[0], typeof pair[1] === 'object' ? 'File object' : pair[1]);
        if (pair[1] instanceof File) {
          console.log('[folder-upload] File details:', pair[1].name, pair[1].size, pair[1].type);
        }
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('[folder-upload] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[folder-upload] Server error:', response.status, errorText);
        throw new Error(errorText || 'Folder upload failed');
      }

      const result = await response.json();
      console.log('[folder-upload] Folder upload successful:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setUploadProgress(0);
      setTotalFiles(0);
      setUploadingFiles(0);
      toast({ title: "Upload terminé", description: "Le dossier a été uploadé avec succès." });
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      setTotalFiles(0);
      setUploadingFiles(0);
      console.error('Folder upload error:', error);
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
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
              reject(new Error('Erreur de réseau lors de la synchronisation'));
            });

            xhr.open('POST', '/api/upload');
            xhr.setRequestHeader('credentials', 'include');
            xhr.send(formData);

          } catch (error) {
            reject(error);
          }
        };

        input.click();
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setSyncProgress(100);
      setIsSyncing(false);
      
      // Réinitialiser après 2 secondes
      setTimeout(() => {
        setSyncProgress(0);
      }, 2000);
    },
    onError: (error: Error) => {
      setSyncProgress(0);
      setIsSyncing(false);
      console.error('Sync error:', error);
      toast({ 
        title: "Erreur de synchronisation", 
        description: error.message, 
        variant: "destructive" 
      });
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
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim() })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Rename response error:', response.status, errorText);
        throw new Error(errorText || 'Failed to rename');
      }
      
      // Vérifier si la réponse est du JSON valide
      const responseText = await response.text();
      if (!responseText) {
        return { success: true };
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error in rename:', parseError, 'Response:', responseText);
        // Si ce n'est pas du JSON, traiter comme succès si status OK
        return { success: true, message: responseText };
      }
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
      console.error('Rename error:', error);
      toast({ title: "Erreur de renommage", description: error.message, variant: "destructive" });
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
      console.log('[share] Starting share process for', isFolder ? 'folder' : 'file', fileId, 'with', email);
      
      // Get user by email/username with proper validation
      const userRes = await fetch(`/api/users?email=${encodeURIComponent(email)}`, { credentials: 'include' });
      if (!userRes.ok) {
        const errorText = await userRes.text();
        console.error('User lookup error:', userRes.status, errorText);
        throw new Error("Adresse Rony introuvable");
      }
      
      const users = await userRes.json();
      console.log('[share] User lookup result:', users);
      
      // Vérification stricte de l'existence de l'utilisateur
      if (!users.data || users.data.length === 0) {
        throw new Error("Adresse Rony introuvable - aucun utilisateur trouvé avec cette adresse");
      }

      // Vérifier que l'utilisateur trouvé correspond exactement à l'email recherché
      const targetUser = users.data.find(u => u.username === email || u.email === email);
      if (!targetUser) {
        throw new Error("Adresse Rony introuvable - correspondance exacte requise");
      }

      const sharedWithId = targetUser.id;
      console.log('[share] Found target user ID:', sharedWithId, 'for email:', email);

      // Share the file/folder
      const endpoint = isFolder ? "/api/folders/share" : "/api/files/share";
      const payload = {
        [isFolder ? "folderId" : "fileId"]: fileId,
        sharedWithId,
        permission: permission || 'read',
        subject: subject || '',
        message: message || ''
      };

      console.log('[share] Sending share request to', endpoint, 'with payload:', payload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Share response error:', response.status, errorText);
        throw new Error(errorText || "Échec du partage");
      }
      
      const result = await response.json();
      console.log('[share] Share successful:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[share] Share mutation successful:', data);
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      setIsShareDialogOpen(false);
      setItemToShare(null);
      setShareEmail("");
      setShareSubject("");
      setShareMessage("");
      toast({ title: "Partage réussi", description: "Le fichier a été partagé avec succès" });
    },
    onError: (error: Error) => {
      console.error('Share error:', error);
      toast({ title: "Erreur lors du partage", description: error.message, variant: "destructive" });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: number; isFolder: boolean }) => {
      const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete response error:', response.status, errorText);
        throw new Error(errorText || 'Failed to delete');
      }
      
      const responseText = await response.text();
      if (!responseText) {
        return { success: true };
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error in delete:', parseError, 'Response:', responseText);
        // Si ce n'est pas du JSON, traiter comme succès si status OK
        return { success: true, message: responseText };
      }
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
      console.error('Delete error:', error);
      toast({ title: "Erreur de suppression", description: error.message, variant: "destructive" });
    }
  });

  // Fonctions de gestion des fichiers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[ui] File input change event triggered');
    const files = event.target.files;
    console.log('[ui] Files from input:', files ? files.length : 0, 'files');
    console.log('[ui] Event target:', event.target);
    console.log('[ui] Files object:', files);
    
    if (files && files.length > 0) {
      console.log('[ui] Starting file upload for', files.length, 'files');
      Array.from(files).forEach((file, index) => {
        console.log(`[ui] File ${index + 1}:`, file.name, file.type, file.size);
      });
      
      // Convert FileList to Array for better handling
      const fileArray = Array.from(files);
      console.log('[ui] File array created:', fileArray.length, 'files');
      
      // Create a new FileList-like object that works with FormData
      const dt = new DataTransfer();
      fileArray.forEach(file => dt.items.add(file));
      const newFileList = dt.files;
      
      console.log('[ui] New FileList created:', newFileList.length, 'files');
      uploadMutation.mutate(newFileList);
    } else {
      console.warn('[ui] No files selected or files is null');
      console.warn('[ui] Event.target.files:', event.target.files);
    }
    
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[ui] Folder input change event triggered');
    const files = event.target.files;
    console.log('[ui] Folder files from input:', files ? files.length : 0, 'files');
    console.log('[ui] Folder event target:', event.target);
    console.log('[ui] Folder files object:', files);
    
    if (files && files.length > 0) {
      console.log('[ui] Starting folder upload for', files.length, 'files');
      Array.from(files).forEach((file, index) => {
        console.log(`[ui] Folder file ${index + 1}:`, file.name, file.webkitRelativePath, file.type, file.size);
      });
      
      // Convert FileList to Array for better handling
      const fileArray = Array.from(files);
      console.log('[ui] Folder file array created:', fileArray.length, 'files');
      
      // Create a new FileList-like object that works with FormData
      const dt = new DataTransfer();
      fileArray.forEach(file => dt.items.add(file));
      const newFileList = dt.files;
      
      console.log('[ui] New folder FileList created:', newFileList.length, 'files');
      uploadFolderMutation.mutate(newFileList);
    } else {
      console.warn('[ui] No folder files selected or files is null');
      console.warn('[ui] Folder event.target.files:', event.target.files);
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

  const triggerFileInput = () => {
    console.log('[ui] Triggering file input click');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('[ui] File input ref is null');
    }
  };

  const triggerFolderInput = () => {
    folderInputRef.current?.click();
  };

  // Fonction pour formater la taille des fichiers
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Fonction pour obtenir l'icône d'un fichier
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

  // Fonction pour obtenir l'icône d'un dossier
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

  // Filtrage des données
  const filteredFolders = folders.filter((folder: Folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter((file: File) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: '100vh' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex-1 flex flex-col" style={{ minHeight: 0, height: 'calc(100vh - 100px)' }}>
        <div className="max-w-7xl mx-auto flex flex-col h-full" style={{ minHeight: 0 }}>
          {/* Header avec titre et actions principales */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              {currentFolderId && (
                <button
                  onClick={() => {
                    console.log('[navigation] Going back from folder:', currentFolderId);
                    console.log('[navigation] Available folders:', allFolders.length);
                    // Find parent folder ID for hierarchical navigation
                    const currentFolder = allFolders.find(f => f.id === currentFolderId);
                    console.log('[navigation] Current folder found:', currentFolder);
                    const parentId = currentFolder?.parentId || null;
                    console.log('[navigation] Navigating to parent folder:', parentId);
                    setCurrentFolderId(parentId);
                  }}
                  className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="Retour"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Retour</span>
                </button>
              )}
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {currentFolderId ? 
                  folders.find(f => f.id === currentFolderId)?.name || allFolders.find(f => f.id === currentFolderId)?.name || 'Dossier' : 
                  'Cloud'
                }
              </h2>
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
                <input 
                  type="file" 
                  ref={folderInputRef} 
                  onChange={handleFolderUpload} 
                  className="hidden" 
                  {...({ webkitdirectory: "", directory: "" } as any)}
                  multiple 
                  accept="*/*"
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
                  <span>Nouveau Dossier</span>
                </Button>
                <Button
                  onClick={() => syncDesktopMutation.mutate()}
                  variant="outline"
                  className="flex items-center space-x-2"
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Synchronisation...' : 'Sync Bureau'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Barres de progression */}
          {uploadMutation.isPending && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Upload en cours...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {isSyncing && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Synchronisation du bureau...</span>
                <span className="text-sm text-gray-500">{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="w-full" />
            </div>
          )}

          {/* Barre de recherche et filtres */}
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

          {/* Contenu principal avec défilement vertical optimisé */}
          <div 
            className="flex-1 overflow-y-auto" 
            style={{ 
              minHeight: 0, 
              maxHeight: 'calc(100vh - 280px)',
              overflowY: 'auto',
              scrollBehavior: 'smooth'
            }}
          >
            <div className="space-y-6 pb-24">
              {/* Grille des dossiers */}
              {filteredFolders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Dossiers ({filteredFolders.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {filteredFolders.map((folder: Folder) => (
                      <div 
                        key={folder.id} 
                        className="group relative border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 cursor-pointer bg-white dark:bg-gray-800"
                        onClick={() => {
                          console.log('[folder-navigation] Entering folder:', folder.id, folder.name);
                          setCurrentFolderId(folder.id);
                        }}
                      >
                        <div className="flex flex-col items-center text-center space-y-1">
                          <div className="h-12 w-12 flex items-center justify-center">
                            {getFolderIcon(folder.iconType)}
                          </div>
                          <div className="w-full">
                            <p className="font-medium text-xs truncate" title={folder.name}>
                              {folder.name}
                            </p>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs text-gray-500">Dossier</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const link = document.createElement('a');
                                        link.href = `/api/folders/${folder.id}/download`;
                                        link.download = `${folder.name}.zip`;
                                        link.target = '_blank';
                                        link.rel = 'noopener noreferrer';
                                        link.style.display = 'none';
                                        document.body.appendChild(link);
                                        link.click();
                                        
                                        setTimeout(() => {
                                          document.body.removeChild(link);
                                        }, 100);
                                        
                                        toast({ 
                                          title: "Téléchargement", 
                                          description: `Téléchargement du dossier ${folder.name} démarré` 
                                        });
                                      } catch (error) {
                                        console.error('Download error:', error);
                                        toast({ 
                                          title: "Erreur", 
                                          description: "Impossible de télécharger le dossier", 
                                          variant: "destructive" 
                                        });
                                      }
                                    }}
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Télécharger
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grille des fichiers */}
              {filteredFiles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Fichiers ({filteredFiles.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {filteredFiles.map((file: File) => (
                      <div 
                        key={file.id} 
                        className="group relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 bg-white dark:bg-gray-800"
                      >
                        <div className="h-16 bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-2">
                          {file.type.startsWith('image/') ? (
                            <img src={file.url} alt={file.name} className="h-12 w-12 object-cover rounded" />
                          ) : (
                            <div className="w-8 h-8">
                              {getFileIcon(file.type, file.name)}
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-medium text-xs truncate flex-1 mr-1" title={file.name}>{file.name}</h4>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="ml-1">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Prévisualisation du fichier
                                    if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/')) {
                                      window.open(file.url, '_blank');
                                    } else {
                                      toast({ 
                                        title: "Prévisualisation", 
                                        description: "Ce type de fichier ne peut pas être prévisualisé", 
                                        variant: "destructive" 
                                      });
                                    }
                                  }}
                                >
                                  <Image className="mr-2 h-4 w-4" />
                                  Prévisualiser
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      // Méthode de téléchargement améliorée
                                      const link = document.createElement('a');
                                      link.href = file.url;
                                      link.download = file.name;
                                      link.target = '_blank';
                                      link.rel = 'noopener noreferrer';
                                      link.style.display = 'none';
                                      document.body.appendChild(link);
                                      link.click();
                                      
                                      // Nettoyer après un délai
                                      setTimeout(() => {
                                        document.body.removeChild(link);
                                      }, 100);
                                      
                                      toast({ 
                                        title: "Téléchargement", 
                                        description: `Téléchargement de ${file.name} démarré` 
                                      });
                                    } catch (error) {
                                      console.error('Download error:', error);
                                      toast({ 
                                        title: "Erreur", 
                                        description: "Impossible de télécharger le fichier", 
                                        variant: "destructive" 
                                      });
                                    }
                                  }}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Télécharger
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
                          <p className="text-xs text-gray-500 truncate">
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
            >
              {createFolderMutation.isPending ? "Création..." : "Créer"}
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
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : shareEmail ? (
                        <span className="text-red-500 text-xs">✗</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium w-8 text-gray-700">Objet:</span>
                  <div className="flex-1">
                    <Input
                      value={shareSubject}
                      onChange={(e) => setShareSubject(e.target.value)}
                      placeholder="Sujet du message"
                      className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Message:</label>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500 resize-none"
                  placeholder="Votre message..."
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={() => setIsShareDialogOpen(false)} className="text-sm">
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    if (shareEmail.trim() && shareSubject.trim() && itemToShare) {
                      shareMutation.mutate({
                        fileId: itemToShare.id,
                        email: shareEmail.trim(),
                        permission: sharePermission,
                        subject: shareSubject.trim(),
                        message: shareMessage.trim(),
                        isFolder: itemToShare.isFolder
                      });
                    }
                  }}
                  disabled={!shareEmail.trim() || !shareSubject.trim() || shareMutation.isPending}
                  className="text-sm bg-blue-500 hover:bg-blue-600"
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
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer "{itemToDelete?.name}" ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}