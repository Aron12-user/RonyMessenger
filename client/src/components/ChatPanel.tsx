import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, FileText, Smile, Paperclip } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'system' | 'file';
  fileInfo?: {
    name: string;
    size: string;
    type: string;
  };
}

interface ChatPanelProps {
  messages: ChatMessage[];
  newMessage: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
  currentUser?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  newMessage,
  onMessageChange,
  onSendMessage,
  currentUser
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (sender: string) => {
    return sender === currentUser;
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold text-lg">Chat</h3>
        <p className="text-gray-400 text-sm">{messages.length} messages</p>
      </div>

      <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm">
                Aucun message pour le moment
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Soyez le premier à envoyer un message
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`${
                msg.type === 'system' ? 'text-center' : ''
              }`}>
                {msg.type === 'system' ? (
                  <div className="bg-gray-700/30 rounded-lg p-3 mx-4">
                    <p className="text-gray-300 text-sm">{msg.message}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                ) : msg.type === 'file' ? (
                  <div className={`flex ${isOwnMessage(msg.sender) ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md rounded-lg p-3 ${
                      isOwnMessage(msg.sender) 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-200'
                    }`}>
                      <div className="flex items-baseline space-x-2 mb-2">
                        <span className="font-semibold text-sm">{msg.sender}</span>
                        <span className="text-xs opacity-70">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-2 bg-black/20 rounded border">
                        <FileText className="h-8 w-8 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {msg.fileInfo?.name}
                          </p>
                          <p className="text-xs opacity-70">
                            {msg.fileInfo?.size} • {msg.fileInfo?.type}
                          </p>
                        </div>
                      </div>
                      
                      {msg.message && (
                        <p className="mt-2 text-sm break-words">{msg.message}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`flex ${isOwnMessage(msg.sender) ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md rounded-lg p-3 ${
                      isOwnMessage(msg.sender) 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-200'
                    }`}>
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-sm">{msg.sender}</span>
                        <span className="text-xs opacity-70">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Tapez votre message..."
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 pr-20"
              onKeyPress={handleKeyPress}
              maxLength={500}
            />
            
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-600"
              >
                <Smile className="h-4 w-4 text-gray-400" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-600"
              >
                <Paperclip className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
          </div>
          
          <Button 
            size="sm" 
            onClick={onSendMessage}
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 h-10 px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>Appuyez sur Entrée pour envoyer</span>
          <span>{newMessage.length}/500</span>
        </div>
      </div>
    </div>
  );
};