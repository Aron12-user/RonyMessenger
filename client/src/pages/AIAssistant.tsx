import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Globe, 
  Calendar,
  Users,
  FileText,
  MessageCircle,
  Settings
} from "lucide-react";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  functionCall?: {
    name: string;
    args: any;
    result?: any;
  };
}

interface AICapability {
  name: string;
  description: string;
  icon: any;
  examples: string[];
}

const AI_CAPABILITIES: AICapability[] = [
  {
    name: "Gestion des contacts",
    description: "Ajouter, rechercher et organiser vos contacts",
    icon: Users,
    examples: [
      "Ajoute un nouveau contact nommé Jean Dupont",
      "Trouve mes contacts qui travaillent chez Google",
      "Montre-moi tous mes contacts favoris"
    ]
  },
  {
    name: "Planification de réunions",
    description: "Créer et gérer vos réunions virtuelles",
    icon: Calendar,
    examples: [
      "Crée une réunion pour demain à 14h",
      "Planifie un appel d'équipe pour vendredi",
      "Génère un lien de réunion"
    ]
  },
  {
    name: "Gestion de fichiers",
    description: "Organiser et partager vos documents",
    icon: FileText,
    examples: [
      "Crée un dossier pour mes projets 2025",
      "Partage le fichier rapport.pdf avec Marie",
      "Trouve tous mes documents PDF"
    ]
  },
  {
    name: "Messages et conversations",
    description: "Envoyer des messages et gérer les conversations",
    icon: MessageCircle,
    examples: [
      "Envoie un message à Pierre",
      "Trouve ma conversation avec l'équipe marketing",
      "Crée une nouvelle conversation de groupe"
    ]
  },
  {
    name: "Paramètres utilisateur",
    description: "Modifier votre profil et préférences",
    icon: Settings,
    examples: [
      "Change mon thème en mode sombre",
      "Met à jour mon email professionnel",
      "Modifie mon nom d'affichage"
    ]
  },
  {
    name: "Recherche web",
    description: "Rechercher des informations sur internet",
    icon: Globe,
    examples: [
      "Recherche les dernières nouvelles tech",
      "Trouve des informations sur React 18",
      "Quelle est la météo à Paris ?"
    ]
  }
];

export default function AIAssistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: `Bonjour ${user?.displayName || user?.username} ! Je suis votre assistant IA personnel. Je peux vous aider à automatiser vos tâches, gérer vos contacts, planifier des réunions, organiser vos fichiers, et bien plus encore. 

Voici quelques exemples de ce que je peux faire :
• Gérer vos contacts et conversations
• Planifier et créer des réunions
• Organiser vos fichiers et dossiers  
• Modifier vos paramètres utilisateur
• Rechercher des informations sur le web
• Répondre à vos questions

Que puis-je faire pour vous aujourd'hui ?`,
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [showCapabilities, setShowCapabilities] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/ai/chat', {
        message,
        userId: user?.id,
        context: {
          userName: user?.displayName || user?.username,
          userEmail: user?.email,
          capabilities: AI_CAPABILITIES.map(cap => cap.name)
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      const aiMessage: Message = {
        id: Date.now().toString() + "_ai",
        content: data.response,
        isUser: false,
        timestamp: new Date(),
        functionCall: data.functionCall
      };
      setMessages(prev => [...prev, aiMessage]);
      
      if (data.functionCall?.result) {
        toast({
          title: "Action effectuée",
          description: `${data.functionCall.name} exécuté avec succès`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: "Impossible de contacter l'assistant IA",
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: Date.now().toString() + "_error",
        content: "Désolé, je rencontre un problème technique. Veuillez réessayer.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    setShowCapabilities(false);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate(inputValue);
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCapabilityExample = (example: string) => {
    setInputValue(example);
    setShowCapabilities(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* AI Assistant Header */}
      <div 
        className="p-4 border-b"
        style={{ 
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}
          >
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Assistant IA Rony
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-textMuted)' }}>
              Votre assistant intelligent pour automatiser vos tâches
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.isUser ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback
                  style={{ 
                    background: message.isUser ? 'var(--color-primary)' : 'var(--color-secondary)' 
                  }}
                >
                  {message.isUser ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </AvatarFallback>
              </Avatar>
              
              <Card
                className={`max-w-[70%] ${
                  message.isUser ? 'ml-auto' : 'mr-auto'
                }`}
                style={{ 
                  background: message.isUser ? 'var(--color-primary)' : 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <CardContent className="p-3">
                  <div
                    className="text-sm whitespace-pre-wrap"
                    style={{ 
                      color: message.isUser ? 'white' : 'var(--color-text)' 
                    }}
                  >
                    {message.content}
                  </div>
                  
                  {message.functionCall && (
                    <div 
                      className="mt-2 p-2 rounded text-xs"
                      style={{ background: 'var(--color-border)' }}
                    >
                      <div className="font-medium">Action: {message.functionCall.name}</div>
                      {message.functionCall.result && (
                        <div className="mt-1">✓ Exécuté avec succès</div>
                      )}
                    </div>
                  )}
                  
                  <div
                    className="text-xs mt-2"
                    style={{ 
                      color: message.isUser ? 'rgba(255,255,255,0.7)' : 'var(--color-textMuted)' 
                    }}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
          
          {sendMessageMutation.isPending && (
            <div className="flex items-start space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback style={{ background: 'var(--color-secondary)' }}>
                  <Bot className="w-4 h-4 text-white" />
                </AvatarFallback>
              </Avatar>
              <Card style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-text)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                      L'assistant réfléchit...
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Capabilities Section */}
      {showCapabilities && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
            Capacités de l'assistant :
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {AI_CAPABILITIES.map((capability) => {
              const Icon = capability.icon;
              return (
                <Card 
                  key={capability.name}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                      <h4 className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                        {capability.name}
                      </h4>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--color-textMuted)' }}>
                      {capability.description}
                    </p>
                    <div className="space-y-1">
                      {capability.examples.slice(0, 2).map((example, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCapabilityExample(example)}
                          className="block text-xs text-left hover:underline w-full"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          "{example}"
                        </button>
                      ))}
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
        className="p-4 border-t"
        style={{ 
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex space-x-2 max-w-4xl mx-auto">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Tapez votre message ou demandez de l'aide..."
            className="flex-1"
            style={{
              background: 'var(--color-background)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
            style={{ background: 'var(--color-primary)' }}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}