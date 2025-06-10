import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Upload, 
  FolderPlus, 
  Grid3X3,
  List,
  ArrowUpDown,
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File as FileIcon,
  Download,
  Share2,
  Trash2,
  Eye,
  MoreVertical,
  ChevronRight,
  Home
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileItem {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploaderId: number;
  folderId: number | null;
  uploadedAt: string;
  updatedAt: string;
  isShared: boolean | null;
}

interface FolderItem {
  id: number;
  name: string;
  userId: number;
  ownerId: number;
  path: string;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  isShared: boolean | null;
}

type FileType = "all" | "images" | "documents" | "videos" | "audio";
type ViewMode = "grid" | "list";

const FILE_TYPE_FILTERS: { value: FileType; label: string; color: string }[] = [
  { value: "all", label: "Tous", color: "bg-purple-500" },
  { value: "images", label: "Images", color: "bg-blue-500" },
  { value: "documents", label: "Documents", color: "bg-green-500" },
  { value: "videos", label: "Vidéos", color: "bg-red-500" },
  { value: "audio", label: "Audio", color: "bg-yellow-500" },
];

export default function FilesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FileType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Simulation de données pour l'interface
  const mockFiles: FileItem[] = [
    {
      id: 1,
      name: "Document_Important.pdf",
      type: "application/pdf",
      size: 2048576,
      url: "/files/doc1.pdf",
      uploaderId: user?.id || 1,
      folderId: null,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isShared: false
    },
    {
      id: 2,
      name: "Photo_Vacances.jpg",
      type: "image/jpeg",
      size: 1048576,
      url: "/files/photo1.jpg",
      uploaderId: user?.id || 1,
      folderId: null,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isShared: true
    },
    {
      id: 3,
      name: "Presentation_Projet.pptx",
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 5242880,
      url: "/files/pres1.pptx",
      uploaderId: user?.id || 1,
      folderId: null,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isShared: false
    }
  ];

  const mockFolders: FolderItem[] = [
    {
      id: 1,
      name: "Documents",
      userId: user?.id || 1,
      ownerId: user?.id || 1,
      path: "/Documents",
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isShared: false
    },
    {
      id: 2,
      name: "Images",
      userId: user?.id || 1,
      ownerId: user?.id || 1,
      path: "/Images",
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isShared: false
    }
  ];

  // Upload de fichier
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (currentFolderId) {
        formData.append('folderId', currentFolderId.toString());
      }
      
      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'upload');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Fichier uploadé avec succès" });
    },
    onError: () => {
      toast({ 
        title: "Erreur d'upload", 
        description: "Impossible d'uploader le fichier",
        variant: "destructive" 
      });
    },
  });

  // Création de dossier
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/folders', {
        name,
        parentId: currentFolderId,
      });
    },
    onSuccess: () => {
      toast({ title: "Dossier créé avec succès" });
    },
    onError: () => {
      toast({ 
        title: "Erreur", 
        description: "Impossible de créer le dossier",
        variant: "destructive" 
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate(file);
    }
  };

  const handleCreateFolder = () => {
    const name = prompt("Nom du nouveau dossier:");
    if (name?.trim()) {
      createFolderMutation.mutate(name.trim());
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    if (type.includes('pdf') || type.includes('document') || type.includes('presentation')) return FileText;
    return FileIcon;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = mockFiles.filter((file: FileItem) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || 
      (activeFilter === "images" && file.type.startsWith('image/')) ||
      (activeFilter === "documents" && (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('presentation'))) ||
      (activeFilter === "videos" && file.type.startsWith('video/')) ||
      (activeFilter === "audio" && file.type.startsWith('audio/'));
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header avec navigation */}
      <div 
        className="p-6 border-b"
        style={{ 
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 mb-4">
          <Home className="w-4 h-4" style={{ color: 'var(--color-textMuted)' }} />
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-textMuted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Mes fichiers
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Barre de recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
              style={{ color: 'var(--color-textMuted)' }} />
            <Input
              placeholder="Rechercher dans les fichiers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              style={{
                background: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
              style={{ background: 'var(--color-primary)' }}
              disabled={uploadFileMutation.isPending}
            >
              <Upload className="w-4 h-4" />
              {uploadFileMutation.isPending ? 'Upload...' : 'Importer'}
            </Button>
            
            <Button
              onClick={handleCreateFolder}
              variant="outline"
              className="flex items-center gap-2"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              disabled={createFolderMutation.isPending}
            >
              <FolderPlus className="w-4 h-4" />
              Nouveau dossier
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
          </div>
        </div>
      </div>

      {/* Filtres par type */}
      <div 
        className="px-6 py-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex gap-2 overflow-x-auto">
          {FILE_TYPE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              variant={activeFilter === filter.value ? "default" : "outline"}
              size="sm"
              className={`flex-shrink-0 ${
                activeFilter === filter.value ? '' : 'bg-transparent'
              }`}
              style={{
                background: activeFilter === filter.value ? filter.color : 'transparent',
                borderColor: activeFilter === filter.value ? filter.color : 'var(--color-border)',
                color: activeFilter === filter.value ? 'white' : 'var(--color-text)',
              }}
            >
              {filter.label}
              {activeFilter === filter.value && (
                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                  {filteredFiles.length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Contenu principal */}
        <div className="flex-1 p-6">
          {/* Dossiers rapides */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Accès rapide
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {mockFolders.map((folder) => (
                <Card 
                  key={folder.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
                  style={{ 
                    background: 'var(--color-surface)', 
                    borderColor: 'var(--color-border)',
                    border: '2px solid var(--color-border)'
                  }}
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-center space-x-3">
                      <Folder className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
                      <div>
                        <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>
                          {folder.name}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--color-textMuted)' }}>
                          {mockFiles.filter(f => f.folderId === folder.id).length} fichiers
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* En-tête des fichiers */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Fichiers récents
              </h2>
              <Badge variant="outline" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                {filteredFiles.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              >
                {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Trier
              </Button>
            </div>
          </div>

          {/* Liste des fichiers */}
          <div 
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {/* En-tête du tableau */}
            <div 
              className="grid grid-cols-12 gap-4 p-4 font-medium text-sm border-b"
              style={{ 
                background: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
            >
              <div className="col-span-6">Nom</div>
              <div className="col-span-2">Taille</div>
              <div className="col-span-3">Modifié</div>
              <div className="col-span-1">Actions</div>
            </div>
            
            {/* Contenu */}
            <ScrollArea className="max-h-96 min-h-48">
              {filteredFiles.length === 0 ? (
                <div className="p-8 text-center">
                  <FileIcon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-textMuted)' }} />
                  <p style={{ color: 'var(--color-textMuted)' }}>
                    {searchQuery ? 'Aucun fichier trouvé pour cette recherche' : 'Aucun fichier dans ce dossier'}
                  </p>
                </div>
              ) : (
                filteredFiles.map((file: FileItem) => {
                  const Icon = getFileIcon(file.type);
                  return (
                    <div 
                      key={file.id}
                      className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50/5 transition-colors border-b last:border-b-0"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="col-span-6 flex items-center space-x-3">
                        <Icon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        <div className="flex-1 min-w-0">
                          <span 
                            className="font-medium truncate block"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {file.name}
                          </span>
                          {file.isShared && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Partagé
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center" style={{ color: 'var(--color-textMuted)' }}>
                        {formatFileSize(file.size)}
                      </div>
                      <div className="col-span-3 flex items-center" style={{ color: 'var(--color-textMuted)' }}>
                        {new Date(file.updatedAt).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="col-span-1 flex items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Prévisualiser
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share2 className="w-4 h-4 mr-2" />
                              Partager
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}