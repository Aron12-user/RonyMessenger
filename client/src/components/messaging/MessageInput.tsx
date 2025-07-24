import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, MESSAGE_TYPES } from "@/lib/constants";
import { Message } from "@shared/schema";
import { 
  Send, 
  Paperclip, 
  Image, 
  Mic, 
  X, 
  Reply,
  Smile,
  Bold,
  Italic,
  Code,
  FileText
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MessageInputProps {
  conversationId: number;
  onMessageSent?: () => void;
  replyToMessage?: Message & { sender: { displayName?: string; username: string } };
  onCancelReply?: () => void;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
}

export default function MessageInput({
  conversationId,
  onMessageSent,
  replyToMessage,
  onCancelReply,
  onStartTyping,
  onStopTyping
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Handle typing indicators
  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      onStartTyping?.();
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onStopTyping?.();
    }, 2000);
  };

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    onStopTyping?.();
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: {
      conversationId: number;
      content: string;
      messageType?: string;
      replyToId?: number;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    }) => {
      return apiRequest("POST", "/api/messages", messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES] });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
      setMessage('');
      setSelectedFiles([]);
      onCancelReply?.();
      onMessageSent?.();
      handleTypingStop();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive"
      });
    }
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversationId.toString());
      
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (uploadedFile, file) => {
      // Send message with file attachment
      const messageType = getMessageTypeFromFile(file);
      sendMessageMutation.mutate({
        conversationId,
        content: message || `${file.name}`,
        messageType,
        replyToId: replyToMessage?.id,
        fileUrl: uploadedFile.url,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'uploader le fichier",
        variant: "destructive"
      });
    }
  });

  const getMessageTypeFromFile = (file: File): string => {
    if (file.type.startsWith('image/')) return MESSAGE_TYPES.IMAGE;
    if (file.type.startsWith('video/')) return MESSAGE_TYPES.VIDEO;
    if (file.type.startsWith('audio/')) return MESSAGE_TYPES.AUDIO;
    return MESSAGE_TYPES.FILE;
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage && selectedFiles.length === 0) return;

    if (selectedFiles.length > 0) {
      // Upload files first
      selectedFiles.forEach(file => {
        uploadFileMutation.mutate(file);
      });
    } else {
      // Send text message
      sendMessageMutation.mutate({
        conversationId,
        content: trimmedMessage,
        messageType: MESSAGE_TYPES.TEXT,
        replyToId: replyToMessage?.id
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape' && replyToMessage) {
      onCancelReply?.();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (e.target.value.length > 0) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      console.log("🎤 Tentative d'accès au microphone...");
      
      // Vérification de support robuste
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("L'enregistrement audio n'est pas supporté sur ce navigateur");
      }

      // Configuration audio optimisée
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      
      console.log("✅ Microphone accessible, configuration de l'enregistrement");
      
      // Détection du meilleur format supporté
      const supportedFormats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav'
      ];
      
      let selectedFormat = 'audio/wav'; // Fallback
      for (const format of supportedFormats) {
        if (MediaRecorder.isTypeSupported(format)) {
          selectedFormat = format;
          break;
        }
      }
      
      console.log("🔊 Format audio sélectionné:", selectedFormat);
      
      const recorder = new MediaRecorder(stream, { 
        mimeType: selectedFormat,
        audioBitsPerSecond: 128000
      });
      
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        console.log("📊 Chunk audio reçu:", event.data.size, "bytes");
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        console.log("⏹️ Enregistrement terminé, assemblage:", audioChunks.length, "chunks");
        
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: selectedFormat });
          console.log("🎵 Blob audio créé:", audioBlob.size, "bytes");
          
          // Générer nom de fichier avec extension appropriée
          const extension = selectedFormat.includes('webm') ? 'webm' : 
                           selectedFormat.includes('mp4') ? 'm4a' : 
                           selectedFormat.includes('ogg') ? 'ogg' : 'wav';
          
          const fileName = `message_vocal_${Date.now()}.${extension}`;
          const audioFile = new File([audioBlob], fileName, { type: selectedFormat });
          
          console.log("✅ Fichier audio finalisé:", {
            name: audioFile.name,
            size: audioFile.size,
            type: audioFile.type
          });
          
          // Ajouter le fichier à la liste
          setSelectedFiles(prev => [...prev, audioFile]);
          
          toast({
            title: "Enregistrement réussi",
            description: `Message vocal de ${(audioFile.size / 1024).toFixed(1)} KB créé`
          });
        } else {
          console.warn("⚠️ Aucune donnée audio capturée");
          toast({
            title: "Échec",
            description: "Aucun audio n'a été enregistré",
            variant: "destructive"
          });
        }
        
        // Nettoyer les ressources
        stream.getTracks().forEach(track => {
          track.stop();
          console.log("🔇 Piste audio fermée");
        });
      };

      recorder.onerror = (event) => {
        console.error("❌ Erreur MediaRecorder:", event);
        toast({
          title: "Erreur d'enregistrement",
          description: "Problème technique pendant l'enregistrement",
          variant: "destructive"
        });
        
        // Nettoyer en cas d'erreur
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setMediaRecorder(null);
      };

      // Démarrer l'enregistrement
      recorder.start(100); // Chunks plus fréquents pour plus de données
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      console.log("🎙️ Enregistrement actif");
      toast({
        title: "🎤 Enregistrement en cours",
        description: "Parlez maintenant. Cliquez à nouveau pour arrêter."
      });
      
    } catch (error: any) {
      console.error("💥 Erreur complète:", error);
      
      let errorMessage = "Erreur d'accès au microphone";
      
      switch (error.name) {
        case 'NotAllowedError':
          errorMessage = "Permission refusée. Autorisez l'accès au microphone dans les paramètres du navigateur.";
          break;
        case 'NotFoundError':
          errorMessage = "Aucun microphone détecté. Vérifiez que votre microphone est connecté.";
          break;
        case 'NotSupportedError':
          errorMessage = "Enregistrement audio non supporté sur ce navigateur.";
          break;
        case 'NotReadableError':
          errorMessage = "Microphone déjà utilisé par une autre application.";
          break;
        default:
          errorMessage = error.message || "Erreur technique inconnue";
      }
      
      toast({
        title: "❌ Erreur microphone",
        description: errorMessage,
        variant: "destructive"
      });
      
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const stopRecording = () => {
    console.log("⏹️ Arrêt demandé, état actuel:", mediaRecorder?.state);
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log("🛑 Arrêt de l'enregistrement...");
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      
      toast({
        title: "⏹️ Arrêt enregistrement",
        description: "Traitement du message vocal..."
      });
    } else {
      console.warn("⚠️ Impossible d'arrêter:", mediaRecorder?.state || "pas de recorder");
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const formatText = (format: 'bold' | 'italic' | 'code') => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = message.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        break;
    }

    const newMessage = message.substring(0, start) + formattedText + message.substring(end);
    setMessage(newMessage);
    
    // Restore cursor position
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const newMessage = message.substring(0, start) + emoji + message.substring(start);
    setMessage(newMessage);
    
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const commonEmojis = ['😀', '😂', '😍', '🤔', '😢', '😠', '👍', '👎', '❤️', '🎉'];

  return (
    <div className="border-t bg-white dark:bg-gray-800 p-2">
      {/* Reply indicator */}
      {replyToMessage && (
        <div className="flex items-center justify-between p-1 mb-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
          <div className="flex items-center gap-2 text-sm">
            <Reply className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-300">
              Réponse à {replyToMessage.sender.displayName || replyToMessage.sender.username}:
            </span>
            <span className="truncate max-w-xs">{replyToMessage.content}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelReply}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="max-h-16 overflow-y-auto mb-1 p-1">
          <div className="flex flex-wrap gap-1">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-1 p-1 bg-blue-100 dark:bg-blue-900 rounded text-xs">
                <span className="truncate max-w-24">{file.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFile(index)}
                  className="h-4 w-4 p-0"
                >
                  <X className="h-2 w-2" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message input container */}
      <div className="flex items-end gap-2">
        {/* Formatting tools */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => formatText('bold')}
            className="h-8 w-8 p-0"
            title="Gras"
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => formatText('italic')}
            className="h-8 w-8 p-0"
            title="Italique"
          >
            <Italic className="h-4 w-4" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => formatText('code')}
            className="h-8 w-8 p-0"
            title="Code"
          >
            <Code className="h-4 w-4" />
          </Button>

          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Émoji">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Message input */}
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Tapez votre message..."
            className="pr-12"
            disabled={sendMessageMutation.isPending || uploadFileMutation.isPending}
            maxLength={2000}
          />
          
          {/* Character counter */}
          {message.length > 1800 && (
            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {2000 - message.length}
            </span>
          )}
        </div>

        {/* File attachment menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Paperclip className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" />
              Fichier
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.click();
              }
            }}>
              <Image className="h-4 w-4 mr-2" />
              Image
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={isRecording ? stopRecording : startRecording}>
              <Mic className={`h-4 w-4 mr-2 ${isRecording ? 'text-red-500' : ''}`} />
              {isRecording ? 'Arrêter l\'enregistrement' : 'Enregistrer audio'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Send button */}
        <Button
          onClick={handleSendMessage}
          disabled={(!message.trim() && selectedFiles.length === 0) || sendMessageMutation.isPending || uploadFileMutation.isPending}
          size="sm"
          className="h-8 w-8 p-0"
        >
          <Send className="h-4 w-4" />
        </Button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />
      </div>

      {/* Typing indicator space - réduit */}
      {isTyping && (
        <div className="text-xs text-gray-500 mt-1">
          {user?.displayName || user?.username} est en train d'écrire...
        </div>
      )}
    </div>
  );
}