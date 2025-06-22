import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/themes";
import ModernSidebar from "@/components/ModernSidebar";
import ModernHeader from "@/components/ModernHeader";
import MainContent from "@/components/MainContent";
import WelcomeContent from "@/components/WelcomeContent";
import AIAssistant from "@/pages/AIAssistant";
import Messages from "@/pages/Messages";
import MeetingsNew from "@/pages/MeetingsNew";
import FilesManager from "@/pages/FilesManager";
import CloudStorage from "@/pages/CloudStorage";
import Contacts from "@/pages/Contacts";
import SettingsPage from "@/pages/SettingsPage";
import MailPage from "@/pages/MailPage";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export default function Home({ isDarkMode, setIsDarkMode }: HomeProps) {
  const { user } = useAuth();
  const { getCurrentTheme, applyTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("messages");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toast } = useToast();

  // Apply theme on component mount and when user theme changes
  useEffect(() => {
    const theme = getCurrentTheme();
    applyTheme(theme);
  }, [user?.theme]);

  // Render appropriate content section
  const renderSection = () => {
    switch (currentSection) {
      case "messages":
        return <Messages />;
      case "assistant":
        return <AIAssistant />;
      case "meetings":
        return <MeetingsNew />;
      case "files":
        return <CloudStorage />;
      case "cloud":
        return <CloudStorage />;
      case "mail":
        return <MailPage />;
      case "contacts":
        return <Contacts />;
      case "settings":
        return <SettingsPage />;
      case "home":
      default:
        return <WelcomeContent onNewConversation={() => toast({ title: "Nouvelle conversation" })} />;
    }
  };

  return (
    <div 
      className="h-screen flex overflow-hidden transition-all duration-500 ease-out"
      style={{ 
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
        minHeight: '100vh',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Modern Sidebar */}
      <ModernSidebar
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <ModernHeader 
          setIsMobileOpen={setIsMobileOpen}
          currentSection={currentSection}
        />
        
        <MainContent>
          {renderSection()}
        </MainContent>
      </div>
    </div>
  );
}
