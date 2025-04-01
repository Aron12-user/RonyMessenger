import { useState } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useLocation } from "wouter";
import StatusIndicator from "./StatusIndicator";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { generateInitials } from "@/lib/utils";
import { USER_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  currentSection: string;
  setCurrentSection: (section: string) => void;
}

export default function Sidebar({ 
  isDarkMode, 
  setIsDarkMode, 
  isMobileOpen, 
  setIsMobileOpen, 
  currentSection, 
  setCurrentSection 
}: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleNavClick = (section: string) => {
    setCurrentSection(section);
    if (window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("Déconnexion en cours...");
      await logout();
      // Force un rafraîchissement de la page pour réinitialiser l'état de l'application
      window.location.href = '/auth';
      toast({
        title: "Déconnecté",
        description: "Vous avez été déconnecté avec succès"
      });
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      toast({
        title: "Erreur",
        description: "Impossible de vous déconnecter",
        variant: "destructive"
      });
    }
  };

  const navigationItems = [
    { name: "Messages", icon: "chat", target: "messages" },
    { name: "Calls", icon: "call", target: "calls" },
    { name: "Meetings", icon: "videocam", target: "meetings" },
    { name: "Files", icon: "folder", target: "files" },
    { name: "Cloud Storage", icon: "cloud", target: "cloud" },
    { name: "Contacts", icon: "people", target: "contacts" },
    { name: "Settings", icon: "settings", target: "settings" },
  ];

  const mobileClass = isMobileOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <aside 
      className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full flex-shrink-0 fixed md:relative z-30 transition-transform duration-300 ease-in-out ${mobileClass} md:translate-x-0`}
    >
      <div className="flex flex-col h-full">
        {/* App Logo and Name */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="material-icons text-white">chat</span>
          </div>
          <h1 className="text-xl font-bold ml-2">Rony</h1>
        </div>
        
        {/* User Profile Section */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {user ? (
            <div className="flex flex-col space-y-3">
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    {generateInitials(user.displayName || user.username)}
                  </div>
                  <StatusIndicator status={user.status as any} />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <div className="font-medium truncate">{user.displayName || user.username}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    <span className={`w-2 h-2 rounded-full bg-status-${user.status} inline-block mr-1`}></span>
                    {user.status === USER_STATUSES.ONLINE ? 'En ligne' : 
                     user.status === USER_STATUSES.AWAY ? 'Absent' : 
                     user.status === USER_STATUSES.BUSY ? 'Occupé' : 'Hors ligne'}
                  </div>
                </div>
                <button 
                  onClick={() => setCurrentSection('settings')}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <span className="material-icons text-xl">settings</span>
                </button>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center justify-center" 
                onClick={handleLogout}
              >
                <span className="material-icons text-sm mr-2">logout</span>
                Déconnexion
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setLocation('/auth')}
              >
                Connexion
              </Button>
            </div>
          )}
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-2">
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.target}
                onClick={() => handleNavClick(item.target)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  currentSection === item.target
                    ? "bg-primary-light dark:bg-primary-dark text-white"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <span className="material-icons">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </nav>
        
        {/* Theme Toggle */}
        <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
      </div>
    </aside>
  );
}
