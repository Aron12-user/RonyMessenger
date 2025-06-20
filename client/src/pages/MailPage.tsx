import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  Download, 
  Eye, 
  Search, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  FolderOpen,
  User,
  Calendar,
  FileIcon
} from "lucide-react";

interface SharedFile {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploaderId: number;
  sharedWithId: number;
  uploadedAt: string;
  isShared: boolean;
  permission: 'read' | 'write' | 'admin';
  sharedBy?: {
    id: number;
    username: string;
    displayName: string;
  };
}

export default function MailPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  // Récupérer les fichiers partagés avec l'utilisateur
  const { data: sharedFiles = [], isLoading, error } = useQuery({
    queryKey: ["shared-files"],
    queryFn: async () => {
      const res = await fetch('/api/files/shared');
      if (!res.ok) throw new Error("Failed to fetch shared files");
      return res.json();
    }
  });

  // Filtrer les fichiers par recherche
  const filteredFiles = sharedFiles.filter((file: SharedFile) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-6 w-6 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="h-6 w-6 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="h-6 w-6 text-green-500" />;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) 
      return <FileText className="h-6 w-6 text-gray-500" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) 
      return <Archive className="h-6 w-6 text-yellow-500" />;
    return <FileIcon className="h-6 w-6 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownload = (file: SharedFile) => {
    window.open(file.url, '_blank');
    toast({ title: `Téléchargement de ${file.name}` });
  };

  const handlePreview = (file: SharedFile) => {
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      window.open(file.url, '_blank');
    } else {
      toast({ 
        title: "Aperçu non disponible", 
        description: "Ce type de fichier ne peut pas être prévisualisé" 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Chargement du courrier...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-600">Erreur lors du chargement du courrier</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <Mail className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Courrier</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Fichiers et dossiers partagés avec vous
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {filteredFiles.length} élément(s)
          </Badge>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher dans le courrier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Liste des fichiers partagés */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-medium text-gray-600 mb-2">
                  Aucun fichier partagé
                </h3>
                <p className="text-gray-500">
                  {searchQuery 
                    ? "Aucun fichier ne correspond à votre recherche" 
                    : "Vous n'avez pas encore reçu de fichiers partagés"
                  }
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFiles.map((file: SharedFile) => (
                  <Card key={file.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {getFileIcon(file.type)}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                              {file.name}
                            </CardTitle>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={file.permission === 'admin' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {file.permission}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      {/* Informations de partage */}
                      <div className="flex items-center space-x-2 mb-3 text-xs text-gray-600">
                        <User className="h-3 w-3" />
                        <span>
                          Partagé par {file.sharedBy?.displayName || file.sharedBy?.username || 'Utilisateur'}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 mb-4 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(file.uploadedAt)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(file)}
                          className="flex-1"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Aperçu
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Télécharger
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}