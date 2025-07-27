import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/themes";
import { 
  MessageCircle, 
  Phone, 
  Monitor, 
  FolderOpen, 
  Users, 
  Bot,
  Settings,
  LogOut,
  Plus,
  X,
  Palette,
  ChevronLeft,
  ChevronRight,
  Menu,
  Mail,
  Inbox,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ModernSidebarProps {
  currentSection: string;
  setCurrentSection: (section: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

export default function ModernSidebar({ 
  currentSection, 
  setCurrentSection, 
  isMobileOpen, 
  setIsMobileOpen,
  isCollapsed = false,
  setIsCollapsed
}: ModernSidebarProps) {
  const { user, logoutMutation } = useAuth();
  const { themes, getCurrentTheme, applyTheme } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  const currentTheme = getCurrentTheme();

  const menuItems = [
    { id: "messages", label: "Messages", icon: MessageCircle, active: true },
    { id: "assistant", label: "Assistant IA", icon: Bot },
    { id: "meetings", label: "Réunions", icon: Monitor },
    { id: "files", label: "Cloud", icon: FolderOpen },
    { id: "mail", label: "Courrier", icon: Mail },
    { id: "internal-mail", label: "Courrier Interne", icon: Inbox },
    { id: "planning", label: "Planification", icon: Calendar },
    { id: "contacts", label: "Contacts", icon: Users },
  ];

  const handleSectionChange = (sectionId: string) => {
    setCurrentSection(sectionId);
    setIsMobileOpen(false);
  };

  const handleThemeChange = (themeId: string) => {
    const newTheme = themes.find(t => t.id === themeId);
    if (newTheme) {
      applyTheme(newTheme);
      setShowThemeSelector(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-50 
          transform transition-all duration-500 ease-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-16' : 'md:w-80'}
          w-80
        `}
        style={{
          background: 'var(--color-sidebar)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: '0 0 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className={`flex items-center space-x-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              {!isCollapsed && (
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                  Rony
                </h1>
              )}
            </div>
            
            <div className={`flex items-center space-x-2 ${isCollapsed ? 'hidden' : ''}`}>
              {/* Collapse Toggle Button */}
              {setIsCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 hover:bg-white/10"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text)' }} />
                  ) : (
                    <ChevronLeft className="w-4 h-4" style={{ color: 'var(--color-text)' }} />
                  )}
                </Button>
              )}

              {/* Theme Selector */}
              <DropdownMenu open={showThemeSelector} onOpenChange={setShowThemeSelector}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="p-2 hover:bg-white/10"
                  >
                    <Palette className="w-4 h-4" style={{ color: 'var(--color-text)' }} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-56 bg-black/90 backdrop-blur-xl border-white/20"
                  style={{ 
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="p-2">
                    <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                      Choisir un thème
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {themes.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className={`
                            p-3 rounded-lg border text-left transition-all
                            hover:scale-105 hover:shadow-lg
                            ${currentTheme.id === theme.id ? 'ring-2 ring-white/50' : ''}
                          `}
                          style={{
                            background: theme.gradient,
                            borderColor: 'var(--color-border)',
                          }}
                        >
                          <div className="text-xs font-medium text-white">
                            {theme.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Close button for mobile */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2 hover:bg-white/10"
                onClick={() => setIsMobileOpen(false)}
              >
                <X className="w-4 h-4" style={{ color: 'var(--color-text)' }} />
              </Button>
            </div>
            
            {/* Collapse button when collapsed */}
            {isCollapsed && setIsCollapsed && (
              <div className="absolute top-6 -right-3 hidden md:block">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white shadow-lg border"
                  onClick={() => setIsCollapsed(false)}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-text)' }} />
                </Button>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <div className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={`
                    w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-xl
                    transition-all duration-300 ease-out text-left group
                    ${isActive 
                      ? 'text-white shadow-lg transform scale-[1.02]' 
                      : 'hover:bg-white/10 hover:backdrop-blur-sm hover:transform hover:scale-[1.01]'
                    }
                  `}
                  style={{
                    background: isActive ? 'var(--color-sidebarActive)' : 'transparent',
                    color: isActive ? 'var(--color-text)' : 'var(--color-textMuted)',
                    fontWeight: isActive ? '500' : '300',
                  }}
                >
                  <Icon className={`w-5 h-5 transition-all duration-300`} style={{ color: isActive ? 'var(--color-text)' : 'var(--color-textMuted)' }} />
                  {!isCollapsed && (
                    <span className={`font-light transition-all duration-300`} style={{ 
                      color: isActive ? 'var(--color-text)' : 'var(--color-textMuted)',
                      fontWeight: isActive ? '500' : '300'
                    }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* User Profile Section */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-3 rounded-xl hover:bg-white/5 transition-colors`}>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user?.avatar || undefined} />
                    <AvatarFallback 
                      className="text-white font-semibold"
                      style={{ background: 'var(--color-primary)' }}
                    >
                      {user?.displayName ? getInitials(user.displayName) : user?.username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 text-left">
                      <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {user?.displayName || user?.username}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--color-textMuted)' }}>
                        {user?.email}
                      </div>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-56 mb-2 ml-4"
                style={{ 
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <DropdownMenuItem
                  onClick={() => handleSectionChange('settings')}
                  className="cursor-pointer hover:bg-white/10"
                  style={{ color: 'var(--color-text)' }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuSeparator style={{ background: 'var(--color-border)' }} />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="cursor-pointer hover:bg-red-500/20 text-red-400"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
}