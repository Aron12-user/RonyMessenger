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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedFiles(prev => [...prev, file]);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au microphone",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
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
    <div className="border-t bg-white dark:bg-gray-800 p-4">
      {/* Reply indicator */}
      {replyToMessage && (
        <div className="flex items-center justify-between p-2 mb-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
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
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <span className="text-sm truncate max-w-xs">{file.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFile(index)}
                className="h-5 w-5 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
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

      {/* Typing indicator space */}
      <div className="h-4 mt-1">
        {isTyping && (
          <span className="text-xs text-gray-500">
            {user?.displayName || user?.username} est en train d'écrire...
          </span>
        )}
      </div>
    </div>
  );
}