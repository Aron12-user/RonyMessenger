import { Menu, Bell, HelpCircle, CheckCheck, Sun, Moon, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rony-theme') || 'light';
    }
    return 'light';
  });
  const queryClient = useQueryClient();

  // ✅ INITIALISATION DES THÈMES AU CHARGEMENT
  useEffect(() => {
    // Application du thème stocké au chargement
    const savedTheme = localStorage.getItem('rony-theme') || 'light';
    applyTheme(savedTheme);
  }, []);

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

  // ✅ SYSTÈME DE THÈME AVEC TROIS MODES
  const applyTheme = (theme: string) => {
    const body = document.body;
    const html = document.documentElement;
    
    // Supprimer toutes les classes de thème
    body.classList.remove('theme-light', 'theme-dark', 'theme-sky');
    html.classList.remove('theme-light', 'theme-dark', 'theme-sky');
    
    // Appliquer le nouveau thème
    body.classList.add(`theme-${theme}`);
    html.classList.add(`theme-${theme}`);
    
    // Sauvegarder le thème
    localStorage.setItem('rony-theme', theme);
    setCurrentTheme(theme);
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'sky'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    applyTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'dark': return <Moon className="h-4 w-4" />;
      case 'sky': return <Cloud className="h-4 w-4" />;
      default: return <Sun className="h-4 w-4" />;
    }
  };

  const getThemeLabel = () => {
    switch (currentTheme) {
      case 'dark': return 'Mode Sombre';
      case 'sky': return 'Mode Grille Ciel';
      default: return 'Mode Clair';
    }
  };
  
  // Grouper les notifications par type pour l'affichage COMPLET
  const notificationsByType = {
    message: notifications.filter(n => n.type === 'message'),
    courrier: notifications.filter(n => n.type === 'courrier'),
    planning: notifications.filter(n => n.type === 'planning'),
    meeting: notifications.filter(n => n.type === 'meeting'),
    system: notifications.filter(n => n.type === 'system'),
    contact_request: notifications.filter(n => n.type === 'contact_request'),
    file_upload: notifications.filter(n => n.type === 'file_upload')
  };

  // ✅ FONCTIONS POUR MARQUER COMME LU
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include'
      });
      // Invalider le cache pour rafraîchir
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/all'] });
    } catch (error) {
      console.error('Erreur marquer comme lu:', error);
    }
  };

  const markAllAsRead = async () => {
    if (isMarkingAllRead) return;
    
    setIsMarkingAllRead(true);
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${result.markedCount} notifications marquées comme lues`);
        
        // Invalider le cache ET forcer un refetch immédiat
        await queryClient.invalidateQueries({ queryKey: ['/api/notifications/all'] });
        await queryClient.refetchQueries({ queryKey: ['/api/notifications/all'] });
        
        console.log('✅ Cache des notifications rafraîchi');
      } else {
        console.error('Erreur réponse:', response.status);
      }
    } catch (error) {
      console.error('Erreur marquer tout comme lu:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
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
        {/* ✅ SYSTÈME DE THÈME D'APPARENCE */}
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 hover:bg-white/10 transition-colors"
          onClick={cycleTheme}
          title={getThemeLabel()}
        >
          {getThemeIcon()}
        </Button>

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
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <DropdownMenuLabel className="font-semibold">
              Notifications ({totalNotifications})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* ✅ AFFICHAGE AVANCÉ DE TOUTES LES NOTIFICATIONS PAR TYPE */}
            {notifications.length > 0 ? (
              <>
                {/* En-tête avec bouton "Tout marquer comme lu" */}
                {totalNotifications > 0 && (
                  <>
                    <DropdownMenuItem 
                      onClick={markAllAsRead} 
                      className="p-3 hover:bg-muted/50 cursor-pointer"
                      disabled={isMarkingAllRead}
                    >
                      <div className="flex items-center space-x-2 w-full">
                        <CheckCheck className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600">
                          {isMarkingAllRead ? "Marquage en cours..." : "Tout marquer comme lu"}
                        </span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Résumé par type avec compteurs */}
                <div className="p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {notificationsByType.message.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>💬 {notificationsByType.message.length} messages</span>
                      </div>
                    )}
                    {notificationsByType.courrier.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>📧 {notificationsByType.courrier.length} courriers</span>
                      </div>
                    )}
                    {notificationsByType.planning.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>📅 {notificationsByType.planning.length} événements</span>
                      </div>
                    )}
                    {notificationsByType.meeting.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span>📞 {notificationsByType.meeting.length} réunions</span>
                      </div>
                    )}
                    {notificationsByType.system.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>🔧 {notificationsByType.system.length} système</span>
                      </div>
                    )}
                    {notificationsByType.contact_request.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>👥 {notificationsByType.contact_request.length} contacts</span>
                      </div>
                    )}
                    {notificationsByType.file_upload.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                        <span>📁 {notificationsByType.file_upload.length} uploads</span>
                      </div>
                    )}
                  </div>
                </div>

                <DropdownMenuSeparator />
                
                {/* Notifications détaillées avec actions */}
                <div className="max-h-96 overflow-y-auto">
                  {notifications.slice(0, 10).map((notification) => (
                    <DropdownMenuItem 
                      key={notification.id} 
                      className="p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        markAsRead(notification.id);
                        // Navigation optionnelle
                        if (notification.actionUrl) {
                          window.location.href = notification.actionUrl;
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3 w-full">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          notification.type === 'message' ? 'bg-purple-500' :
                          notification.type === 'courrier' ? 'bg-blue-500' :
                          notification.type === 'planning' ? 'bg-green-500' :
                          notification.type === 'meeting' ? 'bg-orange-500' :
                          notification.type === 'system' ? 'bg-red-500' :
                          notification.type === 'contact_request' ? 'bg-yellow-500' :
                          'bg-cyan-500'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{notification.title}</p>
                            {notification.priority === 'high' && (
                              <span className="text-xs bg-red-100 text-red-600 px-1 rounded">!</span>
                            )}
                            {notification.priority === 'urgent' && (
                              <span className="text-xs bg-red-500 text-white px-1 rounded">!!</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              {new Date(notification.timestamp).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>

                {notifications.length > 10 && (
                  <DropdownMenuItem className="p-3 text-center text-sm text-muted-foreground">
                    +{notifications.length - 10} autres notifications...
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <DropdownMenuItem className="p-3 text-center text-muted-foreground">
                <div className="flex flex-col items-center space-y-2">
                  <Bell className="h-8 w-8 text-muted-foreground/50" />
                  <span>Aucune notification</span>
                </div>
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