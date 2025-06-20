import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { 
  Home, 
  MessageCircle, 
  Users, 
  Video, 
  Cloud, 
  Settings, 
  Bot,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface CollapsibleSidebarProps {
  currentSection: string;
  setCurrentSection: (section: string) => void;
}

export default function CollapsibleSidebar({ currentSection, setCurrentSection }: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logoutMutation } = useAuth();

  const menuItems = [
    { id: "home", label: "Accueil", icon: Home },
    { id: "messages", label: "Messages", icon: MessageCircle },
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "meetings", label: "Réunions", icon: Video },
    { id: "cloud", label: "Cloud", icon: Cloud },
    { id: "assistant", label: "Assistant IA", icon: Bot },
    { id: "settings", label: "Paramètres", icon: Settings },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div 
      className={`bg-blue-600 text-white flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header avec toggle */}
      <div className="flex items-center justify-between p-4 border-b border-blue-500">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-lg">Rony</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white hover:bg-blue-500 p-2"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
      </div>

      {/* Menu items */}
      <nav className="flex-1 py-4">
        <div className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentSection(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
                  isActive 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-blue-100 hover:bg-blue-500/50 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-blue-500 p-4">
        {!isCollapsed && (
          <div className="mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center">
                <span className="text-blue-800 font-semibold text-sm">
                  {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.displayName || user?.username}
                </p>
                <p className="text-xs text-blue-200 truncate">
                  {user?.username}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className={`text-blue-100 hover:bg-blue-500/50 hover:text-white ${
            isCollapsed ? 'w-full px-2' : 'w-full'
          }`}
          title={isCollapsed ? 'Déconnexion' : undefined}
        >
          {isCollapsed ? (
            <span className="text-lg">⏻</span>
          ) : (
            'Déconnexion'
          )}
        </Button>
      </div>
    </div>
  );
}