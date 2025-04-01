
import { useEffect, useState } from 'react';
import { decryptFile } from '../lib/encryption';
import { Button } from './ui/button';
import { useToast } from "@/hooks/use-toast";

interface AttachmentPreviewProps {
  fileUrl: string;
  encryptionKey: string;
  fileName: string;
  fileType: string;
}

export default function AttachmentPreview({ fileUrl, encryptionKey, fileName, fileType }: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      
      toast({
        title: "Téléchargement",
        description: "Récupération et déchiffrement du fichier..."
      });

      const response = await fetch(fileUrl);
      const encryptedData = await response.text();
      const decryptedData = decryptFile(encryptedData, encryptionKey);
      
      // Créer un blob et le télécharger
      const blob = new Blob([decryptedData], { type: fileType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      
      // Nettoyage
      link.remove();
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

  // Générer l'aperçu pour les images seulement
  useEffect(() => {
    if (!fileType.startsWith('image/')) return;

    const loadPreview = async () => {
      try {
        const response = await fetch(fileUrl);
        const encryptedData = await response.text();
        const decryptedData = decryptFile(encryptedData, encryptionKey);
        
        const blob = new Blob([decryptedData], { type: fileType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        return () => URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error generating preview:', error);
      }
    };
    
    loadPreview();
  }, [fileUrl, encryptionKey, fileType]);

  return (
    <div className="attachment-preview">
      {fileType.startsWith('image/') ? (
        <div className="relative group cursor-pointer" onClick={handleDownload}>
          {previewUrl && (
            <img 
              src={previewUrl} 
              alt={fileName}
              className="w-full rounded-lg hover:opacity-90 transition-opacity"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
            <span className="material-icons text-white text-2xl">download</span>
          </div>
        </div>
      ) : (
        <div 
          onClick={handleDownload}
          className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <span className="material-icons text-2xl">
            {fileType.includes('pdf') ? 'picture_as_pdf' : 
             fileType.includes('video') ? 'movie' :
             fileType.includes('audio') ? 'audiotrack' : 
             'insert_drive_file'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{fileName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Cliquez pour télécharger
            </div>
          </div>
          <span className="material-icons">download</span>
        </div>
      )}
    </div>
  );
}
