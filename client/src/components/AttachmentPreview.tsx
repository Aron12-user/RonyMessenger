
import { useEffect, useState } from 'react';
import { decryptFile } from '../lib/encryption';
import { Button } from './ui/button';

interface AttachmentPreviewProps {
  fileUrl: string;
  encryptionKey: string;
  fileName: string;
  fileType: string;
}

export default function AttachmentPreview({ fileUrl, encryptionKey, fileName, fileType }: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadFile = async () => {
      try {
        const response = await fetch(fileUrl);
        const encryptedData = await response.text();
        const decryptedData = decryptFile(encryptedData, encryptionKey);
        
        const blob = new Blob([decryptedData], { type: fileType });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        return () => URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error decrypting file:', error);
      }
    };
    
    loadFile();
  }, [fileUrl, encryptionKey, fileType]);

  const handleDownload = async () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = fileName;
      link.click();
    }
  };

  if (!previewUrl) return <div>Loading attachment...</div>;

  return (
    <div className="relative group">
      {fileType.startsWith('image/') ? (
        <img 
          src={previewUrl} 
          alt={fileName}
          className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
          onClick={handleDownload}
        />
      ) : (
        <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
