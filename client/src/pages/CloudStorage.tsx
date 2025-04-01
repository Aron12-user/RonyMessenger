import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatFileSize } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Folder, File } from "@shared/schema";

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
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/folders", {
        name,
        parentId: currentFolderId,
        path: folderStack.map(f => f.name).join("/") + "/" + name
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

  // Share files mutation
  const shareFilesMutation = useMutation({
    mutationFn: async () => {
      const fileIds = Object.entries(selectedFiles)
        .filter(([_, selected]) => selected)
        .map(([id]) => parseInt(id));

      const res = await apiRequest("POST", "/api/files/share", {
        fileIds,
        recipient: shareRecipient,
        permission: "read"
      });
      
      if (!res.ok) throw new Error("Failed to share files");
      return res.json();
    },
    onSuccess: () => {
      setIsShareDialogOpen(false);
      setShareRecipient("");
      setSelectedFiles({});
      toast({
        title: "Files shared",
        description: "The selected files have been shared successfully."
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

  const handleNewFolder = () => {
    setIsCreateFolderDialogOpen(true);
  };

  const handleRenameItem = (id: number, isFolder: boolean, currentName: string) => {
    setRenameItemId(id);
    setIsFolder(isFolder);
    setNewName(currentName);
    setIsRenameDialogOpen(true);
  };

  const handleDeleteItem = (id: number, isFolder: boolean) => {
    if (confirm(`Are you sure you want to delete this ${isFolder ? "folder" : "file"}?`)) {
      deleteItemMutation.mutate({ id, isFolder });
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
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Cloud Storage</h2>
            <div className="flex space-x-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                multiple 
              />
              <Button
                onClick={triggerFileInput}
                className="bg-secondary hover:bg-secondary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2"
              >
                <span className="material-icons">upload_file</span>
                <span>Upload Files</span>
              </Button>
              <Button 
                onClick={handleNewFolder}
                className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2"
              >
                <span className="material-icons">create_new_folder</span>
                <span>New Folder</span>
              </Button>
            </div>
          </div>
          
          <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Storage Usage</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{usedSpaceGB.toFixed(2)} GB of {totalSpaceGB.toFixed(0)} GB</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full" style={{ width: `${usagePercentage}%` }}></div>
            </div>
          </div>
          
          {/* Breadcrumbs navigation */}
          <div className="flex items-center mb-6 text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded-lg overflow-x-auto">
            <span className="material-icons text-gray-500 mr-1">folder</span>
            {folderStack.map((folder, index) => (
              <div key={index} className="flex items-center">
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="hover:text-primary transition-colors"
                >
                  {folder.name}
                </button>
                {index < folderStack.length - 1 && (
                  <span className="mx-2 text-gray-500">/</span>
                )}
              </div>
            ))}
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
                      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mr-3">
                        <span className="material-icons">folder</span>
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
                            handleDeleteItem(folder.id, true);
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
                              onClick={() => handleDeleteItem(file.id, false)}
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
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Folder Name</label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate(newFolderName)}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
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
      
      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Files</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Recipient Username</label>
            <Input
              value={shareRecipient}
              onChange={(e) => setShareRecipient(e.target.value)}
              placeholder="Enter username to share with"
              className="w-full"
            />
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
    </section>
  );
}
