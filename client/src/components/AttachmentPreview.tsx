
import { useEffect, useState } from 'react';
import { decryptFile } from '../lib/encryption';
import { Button } from './ui/button';
import { toast } from "@/hooks/use-toast";

interface AttachmentPreviewProps {
  fileUrl: string;
  encryptionKey: string;
  fileName: string;
  fileType: string;
}

export default function AttachmentPreview({ fileUrl, encryptionKey, fileName, fileType }: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFile = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(fileUrl);
        const encryptedData = await response.text();
        const decryptedData = decryptFile(encryptedData, encryptionKey);
        
        const blob = new Blob([decryptedData], { type: fileType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setIsLoading(false);
        
        return () => URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error decrypting file:', error);
        setIsLoading(false);
        toast({
          title: "Erreur",
          description: "Impossible de décrypter le fichier",
          variant: "destructive"
        });
      }
    };
    
    loadFile();
  }, [fileUrl, encryptionKey, fileType]);

  const handleDownload = async () => {
    if (previewUrl) {
      try {
        toast({
          title: "Téléchargement",
          description: "Début du téléchargement du fichier...",
        });
        
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Succès",
          description: "Fichier téléchargé et déchiffré avec succès",
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Impossible de télécharger le fichier",
          variant: "destructive"
        });
      }
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-4">Chargement...</div>;

  if (!previewUrl) return null;

  return (
    <div className="relative group animate-in fade-in duration-200">
      {fileType.startsWith('image/') ? (
        <div className="relative cursor-pointer" onClick={handleDownload}>
          <img 
            src={previewUrl} 
            alt={fileName}
            className="max-w-[200px] rounded-lg hover:opacity-90 transition-opacity"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
            <span className="material-icons text-white">download</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <span className="material-icons">attachment</span>
          <span className="flex-1 truncate">{fileName}</span>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <span className="material-icons">download</span>
          </Button>
        </div>
      )}
    </div>
  );
}
