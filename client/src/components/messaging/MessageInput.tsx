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
      // Vérifier si le navigateur supporte l'enregistrement
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Non supporté",
          description: "Votre navigateur ne supporte pas l'enregistrement audio",
          variant: "destructive"
        });
        return;
      }

      console.log("Demande d'accès au microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      console.log("Microphone accessible, démarrage de l'enregistrement");
      
      // Tenter d'utiliser différents formats audio
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        console.log("Données audio reçues:", e.data.size, "bytes");
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        console.log("Arrêt de l'enregistrement, chunks:", chunks.length);
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          const extension = mimeType.includes('webm') ? 'webm' : 
                            mimeType.includes('mp4') ? 'mp4' : 'ogg';
          const file = new File([blob], `vocal-${Date.now()}.${extension}`, { type: mimeType });
          console.log("Fichier audio créé:", file.name, file.size, "bytes");
          setSelectedFiles(prev => [...prev, file]);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.onerror = (e) => {
        console.error("Erreur MediaRecorder:", e);
        toast({
          title: "Erreur d'enregistrement",
          description: "Une erreur est survenue pendant l'enregistrement",
          variant: "destructive"
        });
      };

      recorder.start(1000); // Enregistrer par chunks de 1 seconde
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      toast({
        title: "Enregistrement démarré",
        description: "Parlez maintenant dans votre microphone"
      });
    } catch (error: any) {
      console.error("Erreur accès microphone:", error);
      let message = "Impossible d'accéder au microphone";
      
      if (error.name === 'NotAllowedError') {
        message = "Permission microphone refusée. Autorisez l'accès au microphone dans votre navigateur.";
      } else if (error.name === 'NotFoundError') {
        message = "Aucun microphone détecté sur votre appareil.";
      } else if (error.name === 'NotSupportedError') {
        message = "L'enregistrement audio n'est pas supporté sur ce navigateur.";
      }
      
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    console.log("Arrêt demandé, état:", mediaRecorder?.state);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      
      toast({
        title: "Enregistrement terminé",
        description: "Votre message vocal a été ajouté"
      });
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