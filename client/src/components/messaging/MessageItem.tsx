import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageReaction, User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, EMOJI_REACTIONS, MESSAGE_TYPES } from "@/lib/constants";
import { 
  MoreVertical, 
  Reply, 
  Edit3, 
  Trash2, 
  Pin, 
  PinOff,
  Download,
  Eye,
  Copy,
  MessageSquare,
  Heart,
  ThumbsUp,
  Smile
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import UserAvatar from '../UserAvatar';

interface MessageItemProps {
  message: Message & {
    reactions?: (MessageReaction & { user: User })[];
    replyTo?: Message & { sender: User };
    sender: User;
  };
  currentUser: User;
  users: Record<number, User>;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  isThread?: boolean;
  showThread?: boolean;
  onToggleThread?: (messageId: number) => void;
}

export default function MessageItem({
  message,
  currentUser,
  users,
  onReply,
  onEdit,
  isThread = false,
  showThread = false,
  onToggleThread
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showReactions, setShowReactions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editInputRef = useRef<HTMLInputElement>(null);

  const isOwnMessage = message.senderId === currentUser.id;
  const messageTime = formatDistanceToNow(new Date(message.timestamp), { 
    addSuffix: true, 
    locale: fr 
  });

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  // Mutations
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      return apiRequest("PUT", `/api/messages/${messageId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES] });
      setIsEditing(false);
      toast({ title: "Message modifié", description: "Le message a été mis à jour avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le message", variant: "destructive" });
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest("DELETE", `/api/messages/${messageId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES] });
      toast({ title: "Message supprimé", description: "Le message a été supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le message", variant: "destructive" });
    }
  });

  const pinMessageMutation = useMutation({
    mutationFn: async ({ messageId, isPinned }: { messageId: number; isPinned: boolean }) => {
      return apiRequest("PUT", `/api/messages/${messageId}/pin`, { isPinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES] });
      toast({ 
        title: message.isPinned ? "Message dépinglé" : "Message épinglé",
        description: message.isPinned ? "Le message n'est plus épinglé" : "Le message a été épinglé"
      });
    }
  });

  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      return apiRequest("POST", `/api/messages/${messageId}/reactions`, { emoji });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES] });
      setShowReactions(false);
    }
  });

  // Event handlers
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editContent.trim() !== message.content) {
        editMessageMutation.mutate({ messageId: message.id, content: editContent.trim() });
      } else {
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleReaction = (emoji: string) => {
    addReactionMutation.mutate({ messageId: message.id, emoji });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copié", description: "Le message a été copié dans le presse-papiers" });
    });
  };

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFilePreview = () => {
    if (message.messageType !== MESSAGE_TYPES.FILE && !message.fileUrl) return null;

    const isImage = message.fileType?.startsWith('image/');
    const isVideo = message.fileType?.startsWith('video/');
    const isAudio = message.fileType?.startsWith('audio/');

    return (
      <div className="mt-2 max-w-sm">
        {isImage && message.fileUrl && (
          <img 
            src={message.fileUrl} 
            alt={message.fileName || 'Image'} 
            className="rounded-lg max-h-48 object-cover cursor-pointer"
            onClick={() => window.open(message.fileUrl!, '_blank')}
          />
        )}
        
        {isVideo && message.fileUrl && (
          <video 
            src={message.fileUrl} 
            controls 
            className="rounded-lg max-h-48"
            preload="metadata"
          />
        )}
        
        {isAudio && message.fileUrl && (
          <audio 
            src={message.fileUrl} 
            controls 
            className="w-full max-w-sm"
          />
        )}
        
        {!isImage && !isVideo && !isAudio && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {message.fileType?.split('/')[1]?.substring(0, 3).toUpperCase() || 'FILE'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName}</p>
              {message.fileSize && (
                <p className="text-xs text-gray-500">
                  {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => downloadFile(message.fileUrl!, message.fileName || 'file')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const reactionGroups = message.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {} as Record<string, (MessageReaction & { user: User })[]>);

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {Object.entries(reactionGroups).map(([emoji, reactions]) => {
          const hasUserReacted = reactions.some(r => r.userId === currentUser.id);
          return (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                hasUserReacted 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={reactions.map(r => r.user.displayName || r.user.username).join(', ')}
            >
              <span>{emoji}</span>
              <span>{reactions.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`group relative ${isThread ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      {/* Message épinglé indicator */}
      {message.isPinned && (
        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 mb-1">
          <Pin className="h-3 w-3" />
          <span>Message épinglé</span>
        </div>
      )}

      {/* Reply to message */}
      {message.replyTo && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 pl-10">
          <Reply className="h-3 w-3" />
          <span>Réponse à {message.replyTo.sender.displayName || message.replyTo.sender.username}:</span>
          <span className="truncate">{message.replyTo.content}</span>
        </div>
      )}

      <div className={`flex gap-3 items-end ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
        {/* Avatar - seulement pour les autres utilisateurs */}
        {!isOwnMessage && (
          <div className="flex-shrink-0 mb-1">
            <UserAvatar 
              initials={`${message.sender.username.charAt(0)}${message.sender.username.charAt(Math.min(1, message.sender.username.length - 1))}`.toUpperCase()} 
              color="blue"
            />
          </div>
        )}

        {/* Message content */}
        <div className={`flex-1 max-w-lg ${isOwnMessage ? 'text-right' : ''}`}>
          {/* Sender name and timestamp - seulement si pas notre message */}
          {!isOwnMessage && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {message.sender.displayName || message.sender.username}
              </span>
              <span className="text-xs text-gray-500">{messageTime}</span>
              {message.isEdited && (
                <span className="text-xs text-gray-400">(modifié)</span>
              )}
            </div>
          )}

          {/* Message bubble - design professionnel */}
          <div className={`relative inline-block p-3 rounded-2xl shadow-sm max-w-fit ${
            isOwnMessage 
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-auto rounded-br-md' 
              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-md'
          }`}>
            {isEditing ? (
              <Input
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={() => {
                  if (editContent === message.content) {
                    setIsEditing(false);
                  }
                }}
                className="bg-transparent border-none p-0 text-inherit"
                disabled={editMessageMutation.isPending}
              />
            ) : (
              <>
                {message.isDeleted ? (
                  <span className="italic text-gray-400">Ce message a été supprimé</span>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </>
            )}

            {/* File preview */}
            {renderFilePreview()}
          </div>

          {/* Timestamp pour nos messages */}
          {isOwnMessage && (
            <div className="flex items-center gap-2 mt-1 justify-end">
              <span className="text-xs text-gray-500">{messageTime}</span>
              {message.isEdited && (
                <span className="text-xs text-gray-400">(modifié)</span>
              )}
            </div>
          )}

          {/* Reactions */}
          {renderReactions()}
        </div>
        
        {/* Message actions - côte à côte avec le message */}
        <div className={`flex-shrink-0 ${isOwnMessage ? 'order-first mr-2' : 'order-last ml-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-1">
            {/* Reaction button */}
            <Popover open={showReactions} onOpenChange={setShowReactions}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Reply button */}
            {onReply && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => onReply(message)}
              >
                <Reply className="h-4 w-4" />
              </Button>
            )}

            {/* Thread button */}
            {onToggleThread && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => onToggleThread(message.id)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}

            {/* More actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => copyToClipboard(message.content)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copier le message
                </DropdownMenuItem>

                {isOwnMessage && !message.isDeleted && (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => pinMessageMutation.mutate({ 
                        messageId: message.id, 
                        isPinned: !message.isPinned 
                      })}
                    >
                      {message.isPinned ? (
                        <>
                          <PinOff className="h-4 w-4 mr-2" />
                          Dépingler
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4 mr-2" />
                          Épingler
                        </>
                      )}
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => deleteMessageMutation.mutate(message.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </>
                )}

                {message.fileUrl && (
                  <DropdownMenuItem 
                    onClick={() => downloadFile(message.fileUrl!, message.fileName || 'file')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}