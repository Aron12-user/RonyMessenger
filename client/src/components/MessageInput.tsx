
import { useState, useRef, FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/utils";

interface MessageInputProps {
  onSendMessage: (text: string, file?: File | null) => void;
  onStartCall: (type: "audio" | "video") => void;
  onEndCall: () => void;
  activeCall: { type: "audio" | "video"; user: any } | null;
}

export default function MessageInput({ onSendMessage, onStartCall, onEndCall, activeCall }: MessageInputProps) {
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

  return (
    <div 
      className="p-4 border-t"
      style={{ 
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)'
      }}
    >
      {/* File preview */}
      {selectedFile && (
        <div 
          className="mb-3 p-3 rounded-lg flex items-center gap-3"
          style={{ 
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)'
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span 
                className="material-icons text-sm"
                style={{ color: 'var(--color-primary)' }}
              >
                {selectedFile.type.startsWith('image/') ? 'image' : 
                 selectedFile.type.startsWith('video/') ? 'videocam' : 'description'}
              </span>
              <span 
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {selectedFile.name}
              </span>
            </div>
            <p 
              className="text-xs mt-1"
              style={{ color: 'var(--color-textMuted)' }}
            >
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSelectedFile(null)}
            className="h-8 w-8"
          >
            <span className="material-icons text-sm">close</span>
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Action buttons */}
        <div className="flex items-center gap-1">
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
            className="h-9 w-9"
            style={{ color: 'var(--color-textMuted)' }}
          >
            <span className="material-icons text-lg">
              {isProcessing ? 'hourglass_empty' : 'attach_file'}
            </span>
          </Button>

          <Button
            type="button"
            onClick={() => onStartCall("audio")}
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            style={{ color: 'var(--color-textMuted)' }}
          >
            <span className="material-icons text-lg">call</span>
          </Button>

          <Button
            type="button"
            onClick={() => onStartCall("video")}
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            style={{ color: 'var(--color-textMuted)' }}
          >
            <span className="material-icons text-lg">videocam</span>
          </Button>
        </div>

        {/* Message input */}
        <div className="flex-1 flex items-center gap-2">
          <div 
            className="flex-1 rounded-full px-4 py-2 min-h-[40px] flex items-center"
            style={{ 
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)'
            }}
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tapez un message..."
              className="w-full bg-transparent border-none focus:outline-none text-sm"
              style={{ color: 'var(--color-text)' }}
            />
          </div>

          <Button 
            type="submit" 
            size="icon"
            disabled={!message.trim() && !selectedFile}
            className="h-10 w-10 rounded-full"
            style={{ 
              background: message.trim() || selectedFile ? 'var(--color-primary)' : 'var(--color-textMuted)',
              color: 'white'
            }}
          >
            <span className="material-icons">send</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
