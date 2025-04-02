import { useState, useRef, FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/utils";
import { encryptFile } from "@/lib/encryption";

interface MessageInputProps {
  onSendMessage: (text: string, file?: File | null) => void;
  onStartCall: (type: "audio" | "video") => void;
}

export default function MessageInput({ onSendMessage, onStartCall }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !selectedFile) return;

    try {
      onSendMessage(message, selectedFile);
      setMessage("");
      setSelectedFile(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive"
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    setIsProcessing(true);

    try {
      // Vérifier la taille (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("Fichier trop volumineux (max 50MB)");
      }

      // Vérifier le type
      const allowedTypes = ['image/', 'video/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'];
      if (!allowedTypes.some(type => file.type.startsWith(type))) {
        throw new Error("Type de fichier non supporté");
      }

      let processedFile = file;
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file);
        if (compressed) processedFile = compressed;
      }

      setSelectedFile(processedFile);
      toast({
        title: "Succès",
        description: "Fichier prêt à être envoyé"
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const onStartCall = (type: 'audio' | 'video') => {
    console.log(`Starting ${type} call`);
    // Implement call logic here
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
          />

          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="icon"
            disabled={isProcessing}
          >
            <span className="material-icons">
              {isProcessing ? 'hourglass_empty' : 'attach_file'}
            </span>
          </Button>

          <Button
            type="button"
            onClick={() => onStartCall("audio")}
            variant="ghost"
            size="icon"
          >
            <span className="material-icons">call</span>
          </Button>

          <Button
            type="button"
            onClick={() => onStartCall("video")}
            variant="ghost"
            size="icon"
          >
            <span className="material-icons">videocam</span>
          </Button>

          <div className="flex-1 min-w-[200px] bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Écrivez un message..."
              className="w-full bg-transparent border-none focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {selectedFile && (
          <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded flex items-center gap-2">
            <span className="text-sm truncate">{selectedFile?.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
            >
              <span className="material-icons text-sm">close</span>
            </Button>
          </div>
        )}

        <Button type="submit" variant="default" size="icon">
          <span className="material-icons">send</span>
        </Button>
      </form>
    </div>
  );
}