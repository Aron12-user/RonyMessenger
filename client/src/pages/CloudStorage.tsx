import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Folder, File } from "@shared/schema";
import { 
  Upload, 
  FolderPlus, 
  MoreVertical, 
  Download, 
  Share2, 
  Trash2, 
  Edit3, 
  Eye, 
  FileText, 
  Image, 
  Music, 
  Video, 
  Archive,
  ChevronRight,
  Search,
  Grid3X3,
  List,
  SortAsc,
  Filter,
  Settings,
  Home
} from "lucide-react";

// Import des icônes personnalisées des dossiers
import folderOrangeIcon from "@assets/icons8-dossier-mac-94_1750386744627.png";
import folderArchiveIcon from "@assets/icons8-dossier-mac-64_1750386753922.png";
import folderBlueIcon from "@assets/icons8-dossier-mac-48_1750386762042.png";

export default function CloudStorage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: number | null; name: string }[]>([{ id: null, name: "Root" }]);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameItemId, setRenameItemId] = useState<number | null>(null);
  const [isFolder, setIsFolder] = useState(false);
  const [newName, setNewName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [id: number]: boolean }>({});
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareRecipient, setShareRecipient] = useState("");
  const [sharePermission, setSharePermission] = useState("read");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; name: string; isFolder: boolean } | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  // États pour les icônes personnalisées des dossiers
  const [selectedFolderIcon, setSelectedFolderIcon] = useState<"orange" | "blue" | "archive">("orange");
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [folderToUpdateIcon, setFolderToUpdateIcon] = useState<number | null>(null);
  
  // Pagination et défilement
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Utility functions
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

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSelectFile = (fileId: number) => {
    setSelectedFiles(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = files.every(file => selectedFiles[file.id]);
    if (allSelected) {
      setSelectedFiles({});
    } else {
      const newSelection: { [id: number]: boolean } = {};
      files.forEach(file => {
        newSelection[file.id] = true;
      });
      setSelectedFiles(newSelection);
    }
  };

  const getSelectedFileIds = () => {
    return Object.entries(selectedFiles)
      .filter(([_, selected]) => selected)
      .map(([id]) => parseInt(id));
  };

  // Fetch folders for current parent
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["folders", currentFolderId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/folders?parentId=${currentFolderId || "null"}`);
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    }
  });

  // Fetch files for current folder
  const { data: files = [] } = useQuery<File[]>({
    queryKey: ["files", currentFolderId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/files?folderId=${currentFolderId || "null"}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    }
  });

  // Fetch storage stats
  const { data: storageStats = { usedSpace: 0, totalSpace: 1024 * 1024 * 1024 * 1024 } } = useQuery({
    queryKey: ["storage-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/storage/stats`);
      if (!res.ok) throw new Error("Failed to fetch storage stats");
      return res.json();
    }
  });

  // Calculate storage statistics
  const usedSpaceGB = storageStats.usedSpace / (1024 * 1024 * 1024);
  const totalSpaceGB = storageStats.totalSpace / (1024 * 1024 * 1024);
  const usagePercentage = (usedSpaceGB / totalSpaceGB) * 100;

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/folders", {
        name: newFolderName,
        parentId: currentFolderId,
        path: folderStack.map(f => f.name).join("/") + "/" + newFolderName,
        iconType: selectedFolderIcon
      });
      if (!res.ok) throw new Error("Failed to create folder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      setIsCreateFolderDialogOpen(false);
      setNewFolderName("");
      toast({
        title: "Folder created",
        description: "The folder has been created successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating folder",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update folder icon mutation
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
      toast({
        title: "Icône mise à jour",
        description: "L'icône du dossier a été mise à jour avec succès."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur lors de la mise à jour",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Rename item mutation
  const renameItemMutation = useMutation({
    mutationFn: async () => {
      if (isFolder) {
        const res = await apiRequest("PATCH", `/api/folders/${renameItemId}`, { name: newName });
        if (!res.ok) throw new Error("Failed to rename folder");
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/files/${renameItemId}`, { name: newName });
        if (!res.ok) throw new Error("Failed to rename file");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      setIsRenameDialogOpen(false);
      setNewName("");
      toast({
        title: `${isFolder ? "Folder" : "File"} renamed`,
        description: `The ${isFolder ? "folder" : "file"} has been renamed successfully.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: `Error renaming ${isFolder ? "folder" : "file"}`,
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async ({ id, isFolder }: { id: number; isFolder: boolean }) => {
      const res = await apiRequest("DELETE", isFolder ? `/api/folders/${id}` : `/api/files/${id}`);
      if (!res.ok) throw new Error(`Failed to delete ${isFolder ? "folder" : "file"}`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["folders", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
      toast({
        title: `${variables.isFolder ? "Folder" : "File"} deleted`,
        description: `The ${variables.isFolder ? "folder" : "file"} has been deleted successfully.`
      });
      setSelectedFiles({});
    },
    onError: (error: Error, variables) => {
      toast({
        title: `Error deleting ${variables.isFolder ? "folder" : "file"}`,
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: Blob) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderId", currentFolderId ? currentFolderId.toString() : "null");
      
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Enhanced share files mutation with permission support
  const shareFilesMutation = useMutation({
    mutationFn: async () => {
      const fileIds = getSelectedFileIds();
      
      if (fileIds.length === 0) {
        throw new Error("No files selected for sharing");
      }

      const res = await apiRequest("POST", "/api/files/share", {
        fileIds,
        recipient: shareRecipient,
        permission: sharePermission
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to share files");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsShareDialogOpen(false);
      setShareRecipient("");
      setSharePermission("read");
      setSelectedFiles({});
      toast({
        title: "Files shared successfully",
        description: `${data.length} file(s) shared with ${shareRecipient}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sharing files",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Filter and sort files based on current settings
  const filteredAndSortedFiles = files
    .filter(file => {
      if (!searchQuery) return true;
      return file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             file.type.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Filter folders based on search
  const filteredFolders = folders.filter(folder => {
    if (!searchQuery) return true;
    return folder.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleNewFolder = () => {
    setIsCreateFolderDialogOpen(true);
  };

  const handleRenameItem = (id: number, isFolder: boolean, currentName: string) => {
    setRenameItemId(id);
    setIsFolder(isFolder);
    setNewName(currentName);
    setIsRenameDialogOpen(true);
  };

  const handleDeleteItem = (id: number, name: string, isFolder: boolean) => {
    setItemToDelete({ id, name, isFolder });
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItemMutation.mutate({ id: itemToDelete.id, isFolder: itemToDelete.isFolder });
      setShowDeleteDialog(false);
      setItemToDelete(null);
    }
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    setCurrentFolderId(newStack[newStack.length - 1].id);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Upload each file
      Array.from(files).forEach(file => {
        uploadFileMutation.mutate(file as any);
      });
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const toggleFileSelection = (id: number) => {
    setSelectedFiles(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleShareSelected = () => {
    const selectedCount = Object.values(selectedFiles).filter(Boolean).length;
    if (selectedCount === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to share.",
        variant: "destructive"
      });
      return;
    }
    setIsShareDialogOpen(true);
  };

  // Calculate storage categories for the chart
  const filesByType = files.reduce((acc: {[key: string]: {count: number, size: number}}, file) => {
    const type = file.type.split('/')[0] || 'other';
    if (!acc[type]) {
      acc[type] = { count: 0, size: 0 };
    }
    acc[type].count += 1;
    acc[type].size += file.size;
    return acc;
  }, {});

  const categories = Object.entries(filesByType).map(([type, stats]) => {
    let icon = 'insert_drive_file';
    let color = 'gray';
    
    switch(type) {
      case 'image': icon = 'image'; color = 'green'; break;
      case 'video': icon = 'videocam'; color = 'purple'; break;
      case 'audio': icon = 'audiotrack'; color = 'yellow'; break;
      case 'application': icon = 'description'; color = 'blue'; break;
      case 'text': icon = 'article'; color = 'red'; break;
    }
    
    return {
      name: type.charAt(0).toUpperCase() + type.slice(1),
      icon,
      count: stats.count,
      size: formatFileSize(stats.size),
      color
    };
  });

  // Sort files by uploaded date for "recent files" section
  const recentFiles = [...files]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 6);

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          {/* Header with title and primary actions */}
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
                onClick={handleNewFolder}
                className="flex items-center space-x-2"
              >
                <FolderPlus className="h-4 w-4" />
                <span>New Folder</span>
              </Button>
            </div>
          </div>

          {/* Storage usage bar */}
          <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Storage Usage</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {usedSpaceGB.toFixed(2)} GB of {totalSpaceGB.toFixed(0)} GB used
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
          </div>

          {/* Advanced toolbar with search, filtering, and view options */}
          <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search files and folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                
                {/* Sort options */}
                <Select value={sortBy} onValueChange={(value: "name" | "date" | "size" | "type") => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  <SortAsc className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                {/* Selection info */}
                {getSelectedFileIds().length > 0 && (
                  <Badge variant="secondary">
                    {getSelectedFileIds().length} selected
                  </Badge>
                )}
                
                {/* Bulk actions */}
                {getSelectedFileIds().length > 0 && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareSelected}
                    >
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const fileIds = getSelectedFileIds();
                        if (fileIds.length > 0) {
                          handleDeleteItem(fileIds[0], "Multiple files", false);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
                
                {/* View mode toggle */}
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {/* Breadcrumb navigation */}
          <div className="mb-6">
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
          </div>
          
          {/* Action buttons */}
          {Object.values(selectedFiles).some(Boolean) && (
            <div className="flex space-x-2 mb-4">
              <Button onClick={handleShareSelected} variant="outline" size="sm">
                <span className="material-icons mr-1 text-sm">share</span>
                Share Selected
              </Button>
              <Button 
                onClick={() => {
                  const fileIds = Object.entries(selectedFiles)
                    .filter(([_, selected]) => selected)
                    .map(([id]) => parseInt(id));
                  
                  if (fileIds.length && confirm("Are you sure you want to delete the selected files?")) {
                    fileIds.forEach(id => deleteItemMutation.mutate({ id, isFolder: false }));
                  }
                }} 
                variant="destructive" 
                size="sm"
              >
                <span className="material-icons mr-1 text-sm">delete</span>
                Delete Selected
              </Button>
            </div>
          )}
          
          {/* Folders grid */}
          {folders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Folders</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {folders.map((folder) => (
                  <div 
                    key={folder.id} 
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center">
                      <div 
                        className="w-12 h-12 flex items-center justify-center mr-3 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderToUpdateIcon(folder.id);
                          setIsIconSelectorOpen(true);
                        }}
                        title="Cliquez pour changer l'icône"
                      >
                        {getFolderIcon(folder.iconType || "orange")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate" onClick={() => handleFolderClick(folder)}>
                          {folder.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Created {new Date(folder.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="ml-2 flex">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent folder navigation
                            handleRenameItem(folder.id, true, folder.name);
                          }}
                          className="text-gray-500 hover:text-primary p-1"
                        >
                          <span className="material-icons text-sm">edit</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent folder navigation
                            handleDeleteItem(folder.id, folder.name, true);
                          }}
                          className="text-gray-500 hover:text-red-500 p-1"
                        >
                          <span className="material-icons text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Files grid */}
          {files.length > 0 ? (
            <div>
              <h3 className="text-lg font-medium mb-3">Files</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((file) => {
                  const fileType = file.type.split('/')[0] || 'other';
                  let icon = 'insert_drive_file';
                  
                  switch(fileType) {
                    case 'image': icon = 'image'; break;
                    case 'video': icon = 'videocam'; break;
                    case 'audio': icon = 'audiotrack'; break;
                    case 'application': 
                      if (file.type.includes('pdf')) icon = 'picture_as_pdf';
                      else icon = 'description'; 
                      break;
                    case 'text': icon = 'article'; break;
                  }
                  
                  return (
                    <div 
                      key={file.id} 
                      className={`border ${selectedFiles[file.id] ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'} rounded-lg overflow-hidden hover:shadow-md transition-shadow`}
                    >
                      <div className="h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative">
                        <input
                          type="checkbox"
                          checked={!!selectedFiles[file.id]}
                          onChange={() => toggleFileSelection(file.id)}
                          className="absolute top-2 left-2 z-10"
                        />
                        {fileType === 'image' ? (
                          <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="material-icons text-4xl text-gray-400">{icon}</span>
                        )}
                        {file.isShared && (
                          <div className="absolute bottom-2 right-2 bg-primary text-white rounded-full p-1" title="Shared">
                            <span className="material-icons text-sm">share</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium truncate flex-1">{file.name}</h4>
                          <div className="flex">
                            <button 
                              onClick={() => handleRenameItem(file.id, false, file.name)}
                              className="text-gray-500 hover:text-primary p-1"
                            >
                              <span className="material-icons text-sm">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteItem(file.id, file.name, false)}
                              className="text-gray-500 hover:text-red-500 p-1"
                            >
                              <span className="material-icons text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : files.length === 0 && folders.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-icons text-6xl text-gray-300 dark:text-gray-600 mb-4">cloud_upload</span>
              <h3 className="text-xl font-medium mb-2">No files or folders yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Upload files or create folders to get started</p>
              <div className="flex justify-center space-x-4">
                <Button onClick={triggerFileInput}>
                  <span className="material-icons mr-2">upload_file</span>
                  Upload Files
                </Button>
                <Button onClick={handleNewFolder} variant="outline">
                  <span className="material-icons mr-2">create_new_folder</span>
                  New Folder
                </Button>
              </div>
            </div>
          ) : null}
          
          {/* Recent Files Section */}
          {recentFiles.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Recent Files</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {recentFiles.map((file) => {
                  const fileType = file.type.split('/')[0] || 'other';
                  let icon = 'insert_drive_file';
                  
                  switch(fileType) {
                    case 'image': icon = 'image'; break;
                    case 'video': icon = 'videocam'; break;
                    case 'audio': icon = 'audiotrack'; break;
                    case 'application': 
                      if (file.type.includes('pdf')) icon = 'picture_as_pdf';
                      else icon = 'description'; 
                      break;
                    case 'text': icon = 'article'; break;
                  }
                  
                  return (
                    <div key={file.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-24 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        {fileType === 'image' ? (
                          <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="material-icons text-3xl text-gray-400">{icon}</span>
                        )}
                      </div>
                      <div className="p-2">
                        <h4 className="font-medium text-sm truncate">{file.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
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
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate()}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Création..." : "Créer le dossier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {isFolder ? "Folder" : "File"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">New Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter new ${isFolder ? "folder" : "file"} name`}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => renameItemMutation.mutate()}
              disabled={!newName.trim() || renameItemMutation.isPending}
            >
              {renameItemMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Enhanced Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Files</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Recipient Username</label>
              <Input
                value={shareRecipient}
                onChange={(e) => setShareRecipient(e.target.value)}
                placeholder="Enter username to share with"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Permission Level</label>
              <Select value={sharePermission} onValueChange={setSharePermission}>
                <SelectTrigger>
                  <SelectValue placeholder="Select permission level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="write">Read & Write</SelectItem>
                  <SelectItem value="admin">Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Sharing {getSelectedFileIds().length} file(s) with {sharePermission} permissions
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => shareFilesMutation.mutate()}
              disabled={!shareRecipient.trim() || shareFilesMutation.isPending}
            >
              {shareFilesMutation.isPending ? "Sharing..." : "Share Files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Icon Selector Dialog */}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.isFolder ? "Folder" : "File"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? 
              {itemToDelete?.isFolder && " This will also delete all files and subfolders inside it."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
