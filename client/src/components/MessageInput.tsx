import { useState, useRef, FormEvent } from "react";

interface MessageInputProps {
  onSendMessage: (text: string, file?: File | null) => void;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (message.trim() || selectedFile) {
      // Encrypt message before sending
      const encryptedMessage = message.trim() ? await encryptText(message) : "";
      
      onSendMessage(encryptedMessage, selectedFile);
      setMessage("");
      setSelectedFile(null);
      
      // Clear typing indicator
      sendMessage(WS_EVENTS.USER_TYPING, { isTyping: false });
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    // Send typing indicator
    sendMessage(WS_EVENTS.USER_TYPING, { isTyping: true });
    
    // Clear typing indicator after delay
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      sendMessage(WS_EVENTS.USER_TYPING, { isTyping: false });
    }, 2000);
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
        // Vérifier le type de fichier
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword'];
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Erreur",
            description: "Type de fichier non supporté",
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Préparation",
          description: "Traitement du fichier en cours...",
        });

        // Compression d'image si nécessaire
        if (file.type.startsWith('image/')) {
          const compressedFile = await compressImage(file);
          if (compressedFile) {
            file = compressedFile;
          }
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

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => onStartCall("audio")}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <span className="material-icons">call</span>
          </button>
          <button 
            type="button"
            onClick={() => onStartCall("video")} 
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <span className="material-icons">videocam</span>
          </button>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..." 
              className="w-full bg-transparent border-none focus:outline-none dark:text-white" 
            />
          </div>
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