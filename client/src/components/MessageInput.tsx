import { useState, useRef, FormEvent } from "react";

interface MessageInputProps {
  onSendMessage: (text: string, file?: File | null) => void;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (message.trim() || selectedFile) {
      onSendMessage(message, selectedFile);
      setMessage("");
      setSelectedFile(null);
    }
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Vérifier la taille du fichier (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "Erreur",
          description: "Le fichier est trop volumineux (max 50MB)",
          variant: "destructive"
        });
        return;
      }

      try {
        toast({
          title: "Préparation",
          description: "Compression et chiffrement du fichier en cours...",
        });
        
        // Compression du fichier si c'est une image
        let processedFile = file;
        if (file.type.startsWith('image/')) {
          // Logique de compression d'image ici si nécessaire
          processedFile = file; // Pour l'instant on garde l'original
        }
        
        // Chiffrement du fichier
        const { encryptedData, key } = await encryptFile(processedFile);
        
        // Créer un nouveau File object avec les données chiffrées
        const encryptedFile = new File(
          [encryptedData],
          file.name,
          { type: file.type }
        );
        
        setSelectedFile({
          file: encryptedFile,
          originalName: file.name,
          type: file.type,
          size: file.size,
          encryptionKey: key
        });
        
        toast({
          title: "Succès",
          description: "Fichier prêt à être envoyé",
        });
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: "Erreur",
          description: "Impossible de préparer le fichier",
          variant: "destructive"
        });
        setSelectedFile(null);
      }
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button 
          type="button" 
          onClick={handleFileButtonClick}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
        >
          <span className="material-icons">attach_file</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden" 
        />
        
        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
          <input 
            type="text" 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..." 
            className="w-full bg-transparent border-none focus:outline-none dark:text-white" 
          />
        </div>
        
        <button 
          type="submit" 
          className="p-2 bg-primary hover:bg-primary-dark text-white rounded-full flex items-center justify-center"
        >
          <span className="material-icons">send</span>
        </button>
      </form>
    </div>
  );
}
