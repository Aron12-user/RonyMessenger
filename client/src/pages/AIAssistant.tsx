import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles,
  MessageSquare,
  Calendar,
  Users,
  FileText,
  Settings,
  Search
} from "lucide-react";

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean;
}

const SUGGESTED_PROMPTS = [
  {
    icon: Calendar,
    title: "Planifier une réunion",
    prompt: "Peux-tu m'aider à planifier une réunion pour demain à 14h avec l'équipe marketing ?"
  },
  {
    icon: Users,
    title: "Gérer mes contacts",
    prompt: "Affiche-moi la liste de mes contacts et aide-moi à organiser mes groupes"
  },
  {
    icon: FileText,
    title: "Organiser mes fichiers",
    prompt: "Comment puis-je mieux organiser mes fichiers et dossiers ?"
  },
  {
    icon: Settings,
    title: "Paramètres du profil",
    prompt: "Aide-moi à mettre à jour mon profil utilisateur"
  }
];

export default function AIAssistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: `Bonjour ${user?.displayName || user?.username} ! Je suis votre assistant IA. Comment puis-je vous aider aujourd'hui ?`,
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // Alternative si le scrollIntoView ne fonctionne pas
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    // Utiliser un petit délai pour s'assurer que le DOM est mis à jour
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/ai-chat', {
        message,
        userId: user?.id,
        context: {
          userId: user?.id,
          userName: user?.displayName || user?.username
        }
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? { ...msg, content: data.response, isLoading: false } : msg
      ));
      setIsTyping(false);
    },
    onError: (error: any) => {
      console.error('AI Chat error:', error);
      const errorMessage = error?.message || "Impossible de communiquer avec l'assistant IA";
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
      });
      
      // Remplacer le message de chargement par un message d'erreur
      setMessages(prev => prev.map(msg => 
        msg.isLoading 
          ? { ...msg, content: "Désolé, je rencontre un problème technique. Veuillez réessayer.", isLoading: false }
          : msg
      ));
      setIsTyping(false);
    }
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      content: "L'assistant réfléchit...",
      sender: 'assistant',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsTyping(true);
    
    chatMutation.mutate(inputMessage);
    setInputMessage("");
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div 
        className="p-6 border-b"
        style={{ 
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center space-x-4">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}
          >
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Assistant IA
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-textMuted)' }}>
              Votre assistant intelligent personnel
            </p>
          </div>
          <div className="ml-auto">
            <Badge 
              variant="secondary"
              className="flex items-center gap-1"
              style={{ background: 'var(--color-background)', color: 'var(--color-text)' }}
            >
              <Sparkles className="w-3 h-3" />
              En ligne
            </Badge>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-6 h-full overflow-y-auto">
          <div className="space-y-4 min-h-full pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  {message.sender === 'user' ? (
                    <>
                      <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback 
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                      >
                        {user?.displayName?.[0] || user?.username?.[0] || <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback 
                      style={{ background: 'var(--color-secondary)', color: 'white' }}
                    >
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  )}
                </Avatar>

                <div 
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.sender === 'user' 
                      ? 'rounded-br-none' 
                      : 'rounded-bl-none'
                  } ${message.isLoading ? 'animate-pulse' : ''}`}
                  style={{
                    background: message.sender === 'user' 
                      ? 'var(--color-primary)' 
                      : 'var(--color-surface)',
                    color: message.sender === 'user' 
                      ? 'white' 
                      : 'var(--color-text)',
                    border: message.sender === 'assistant' 
                      ? '1px solid var(--color-border)' 
                      : 'none'
                  }}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <p 
                    className={`text-xs mt-1 ${
                      message.sender === 'user' 
                        ? 'text-white/70' 
                        : 'opacity-50'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Suggested Prompts */}
        {messages.length <= 1 && (
          <div className="px-6 py-4">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
              Suggestions pour commencer :
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SUGGESTED_PROMPTS.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <Card 
                    key={index}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
                    style={{ 
                      background: 'var(--color-surface)', 
                      borderColor: 'var(--color-border)' 
                    }}
                    onClick={() => handleSuggestedPrompt(suggestion.prompt)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: 'var(--color-primary)/10' }}
                        >
                          <Icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                            {suggestion.title}
                          </h4>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-textMuted)' }}>
                            {suggestion.prompt.length > 50 
                              ? `${suggestion.prompt.substring(0, 50)}...` 
                              : suggestion.prompt
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div 
          className="p-6 border-t"
          style={{ 
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Tapez votre message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isTyping}
                className="pr-12"
                style={{
                  background: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              {inputMessage && (
                <Button
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={handleSendMessage}
                  disabled={isTyping}
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Send className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          {isTyping && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="flex space-x-1">
                <div 
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ 
                    background: 'var(--color-primary)',
                    animationDelay: '0ms'
                  }}
                />
                <div 
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ 
                    background: 'var(--color-primary)',
                    animationDelay: '150ms'
                  }}
                />
                <div 
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ 
                    background: 'var(--color-primary)',
                    animationDelay: '300ms'
                  }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--color-textMuted)' }}>
                L'assistant tape...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}