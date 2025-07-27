import { Menu, Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModernHeaderProps {
  setIsMobileOpen: (open: boolean) => void;
  currentSection: string;
}

export default function ModernHeader({ setIsMobileOpen, currentSection }: ModernHeaderProps) {
  const [showHelp, setShowHelp] = useState(false);

  const getSectionTitle = (section: string) => {
    switch (section) {
      case "messages": return "Conversations";
      case "assistant": return "Assistant IA";
      case "calls": return "Appels";
      case "meetings": return "Réunions";
      case "files": return "Fichiers";
      case "contacts": return "Contacts";
      case "settings": return "Paramètres";
      case "planning": return "Planification";
      case "cloud": return "Cloud";
      case "courrier": return "Courrier";
      default: return "Conversations";
    }
  };

  // ✅ SYSTÈME DE NOTIFICATION CENTRALISÉ
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 5 * 60 * 1000,
  });

  // ✅ RÉCUPÉRER TOUTES LES NOTIFICATIONS DE L'APPLICATION
  const { data: notificationsData } = useQuery<{
    notifications: any[];
    totalCount: number;
    unreadCount: number;
  }>({
    queryKey: ['/api/notifications/all'],
    enabled: !!user,
    refetchInterval: 5000, // Vérification toutes les 5 secondes
    staleTime: 0, // Always fetch fresh data
  });

  const notifications = notificationsData?.notifications || [];
  const totalNotifications = notificationsData?.unreadCount || 0;
  
  // Grouper les notifications par type pour l'affichage
  const notificationsByType = {
    courrier: notifications.filter(n => n.type === 'courrier'),
    planning: notifications.filter(n => n.type === 'planning'),
    meeting: notifications.filter(n => n.type === 'meeting'),
    message: notifications.filter(n => n.type === 'message')
  };

  // ✅ DONNÉES D'AIDE POUR CHAQUE MODULE
  const helpSections = [
    {
      title: "💬 Conversations",
      content: "Envoyez des messages instantanés, partagez des fichiers et enregistrez des messages vocaux. Ajoutez des contacts pour commencer une conversation."
    },
    {
      title: "📅 Planification",
      content: "Créez des événements, invitez des participants avec leur adresse @rony.com. Les invités reçoivent automatiquement les événements dans leur planification."
    },
    {
      title: "☁️ Cloud",
      content: "Stockez vos fichiers (max 10GB par fichier), organisez en dossiers (max 2TB), partagez avec d'autres utilisateurs. Stockage total: 10TB."
    },
    {
      title: "📧 Courrier",
      content: "Recevez les fichiers et dossiers partagés, répondez et transférez. Les partages de fichiers apparaissent automatiquement ici."
    },
    {
      title: "🤖 Assistant IA",
      content: "Posez vos questions à l'assistant intelligent pour l'aide sur vos tâches quotidiennes."
    },
    {
      title: "📞 Appels",
      content: "Passez des appels audio et vidéo avec vos contacts en temps réel."
    },
    {
      title: "🏢 Réunions",
      content: "Créez et rejoignez des réunions vidéo avec room codes personnalisés. Intégration Jitsi Meet."
    }
  ];

  return (
    <div 
      className="flex items-center justify-between p-4 border-b backdrop-blur-xl transition-all duration-300 ease-out"
      style={{ 
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
      }}
    >
      <div className="flex items-center space-x-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden p-2 hover:bg-white/10"
          onClick={() => setIsMobileOpen(true)}
        >
          <Menu className="w-5 h-5" style={{ color: 'var(--color-text)' }} />
        </Button>

        <h2 className="text-xl font-light tracking-wide transition-all duration-300" style={{ color: 'var(--color-text)' }}>
          {getSectionTitle(currentSection)}
        </h2>
      </div>

      <div className="flex items-center space-x-3">
        {/* ✅ SYSTÈME DE NOTIFICATION CENTRALISÉ */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2 hover:bg-white/10 transition-colors"
            >
              <Bell className="w-5 h-5" style={{ color: 'var(--color-text)' }} />
              {totalNotifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {totalNotifications > 99 ? '99+' : totalNotifications}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-semibold">
              Notifications ({totalNotifications})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* ✅ AFFICHAGE DE TOUTES LES NOTIFICATIONS PAR TYPE */}
            {notifications.length > 0 ? (
              <>
                {notificationsByType.message.length > 0 && (
                  <DropdownMenuItem className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium">💬 Nouveaux messages</p>
                        <p className="text-sm text-muted-foreground">
                          {notificationsByType.message.length} conversation{notificationsByType.message.length > 1 ? 's' : ''} non lues
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                )}

                {notificationsByType.courrier.length > 0 && (
                  <DropdownMenuItem className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium">📧 Nouveaux courriers</p>
                        <p className="text-sm text-muted-foreground">
                          {notificationsByType.courrier.length} fichier{notificationsByType.courrier.length > 1 ? 's' : ''} partagé{notificationsByType.courrier.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                )}

                {notificationsByType.planning.length > 0 && (
                  <DropdownMenuItem className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium">📅 Événements à venir</p>
                        <p className="text-sm text-muted-foreground">
                          {notificationsByType.planning.length} événement{notificationsByType.planning.length > 1 ? 's' : ''} prochainement
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                )}

                {notificationsByType.meeting.length > 0 && (
                  <DropdownMenuItem className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium">📞 Réunions imminentes</p>
                        <p className="text-sm text-muted-foreground">
                          {notificationsByType.meeting.length} réunion{notificationsByType.meeting.length > 1 ? 's' : ''} dans 30 min
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                
                {/* Afficher les dernières notifications détaillées */}
                {notifications.slice(0, 3).map((notification, index) => (
                  <DropdownMenuItem key={notification.id} className="p-3 hover:bg-muted/50">
                    <div className="flex items-start space-x-3 w-full">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        notification.type === 'message' ? 'bg-purple-500' :
                        notification.type === 'courrier' ? 'bg-blue-500' :
                        notification.type === 'planning' ? 'bg-green-500' :
                        'bg-orange-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.timestamp).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            ) : (
              <DropdownMenuItem className="p-3 text-center text-muted-foreground">
                Aucune notification
              </DropdownMenuItem>
            )}

            {totalNotifications === 0 && (
              <DropdownMenuItem className="p-3 text-center text-muted-foreground">
                Aucune notification
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ✅ ICÔNE D'AIDE */}
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-2 hover:bg-white/10 transition-colors"
            >
              <HelpCircle className="w-5 h-5" style={{ color: 'var(--color-text)' }} />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold mb-4">
                🚀 Guide d'utilisation - Rony
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {helpSections.map((section, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                ))}
                
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <h3 className="font-semibold text-lg mb-2">💡 Conseils d'utilisation</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Utilisez uniquement des adresses @rony.com pour les invitations</li>
                    <li>• Les fichiers sont limités à 10GB, les dossiers à 2TB</li>
                    <li>• Le partage automatique fonctionne en temps réel</li>
                    <li>• Les notifications apparaissent dans la cloche en haut</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}