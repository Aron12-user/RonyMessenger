
import { useState } from 'react';
import { decryptFile } from '../lib/encryption';
import { Button } from './ui/button';
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from '@/lib/utils';

interface AttachmentPreviewProps {
  fileUrl: string;
  encryptionKey: string;
  fileName: string;
  fileType: string;
  timestamp: Date;
  senderId: number;
  currentUserId: number;
}

export default function AttachmentPreview({ 
  fileUrl, 
  encryptionKey, 
  fileName, 
  fileType,
  timestamp,
  senderId,
  currentUserId
}: AttachmentPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const isImage = fileType.startsWith('image/');
  const isVideo = fileType.startsWith('video/');
  const isPdf = fileType === 'application/pdf';
  
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      toast({
        title: "Téléchargement",
        description: "Récupération et déchiffrement du fichier..."
      });

      // Télécharger le fichier chiffré
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erreur lors du téléchargement');
      
      const encryptedData = await response.arrayBuffer();
      
      // Déchiffrer le fichier
      const decryptedData = await decryptFile(encryptedData, encryptionKey);
      
      // Créer un blob et le télécharger
      const blob = new Blob([decryptedData], { type: fileType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Succès",
        description: "Fichier téléchargé avec succès"
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le fichier",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="attachment-preview rounded-lg overflow-hidden border dark:border-gray-700">
      <div 
        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        onClick={handleDownload}
      >
        <div className="flex-shrink-0">
          <span className="material-icons text-2xl text-gray-500 dark:text-gray-400">
            {isImage ? 'image' : isVideo ? 'videocam' : isPdf ? 'picture_as_pdf' : 'insert_drive_file'}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate dark:text-gray-200">
            {fileName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span>{formatFileSize(parseInt(fileUrl.split('size=')[1] || '0'))}</span>
            <span>•</span>
            <span>{isDownloading ? 'Téléchargement...' : 'Cliquez pour télécharger'}</span>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon"
          className="flex-shrink-0"
          disabled={isDownloading}
        >
          <span className="material-icons">
            {isDownloading ? 'hourglass_empty' : 'download'}
          </span>
        </Button>
      </div>
    </div>
  );
}
