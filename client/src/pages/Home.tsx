import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/themes";
import ModernSidebar from "@/components/ModernSidebar";
import ModernHeader from "@/components/ModernHeader";
import MainContent from "@/components/MainContent";
import WelcomeContent from "@/components/WelcomeContent";
import Messages from "@/pages/Messages";
import MeetingsNew from "@/pages/MeetingsNew";
import Files from "@/pages/Files";
import CloudStorage from "@/pages/CloudStorage";
import Contacts from "@/pages/Contacts";
import Settings from "@/pages/Settings";
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
        return currentSection === "messages" ? <WelcomeContent onNewConversation={() => toast({ title: "Nouvelle conversation" })} /> : <Messages />;
      case "assistant":
        return <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Assistant IA</h2>
            <p style={{ color: 'var(--color-textMuted)' }}>Fonctionnalité en cours de développement</p>
          </div>
        </div>;
      case "calls":
        return <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Appels</h2>
            <p style={{ color: 'var(--color-textMuted)' }}>Fonctionnalité en cours de développement</p>
          </div>
        </div>;
      case "meetings":
        return <MeetingsNew />;
      case "files":
        return <Files />;
      case "cloud":
        return <CloudStorage />;
      case "contacts":
        return <Contacts />;
      case "settings":
        return <Settings />;
      default:
        return <WelcomeContent onNewConversation={() => toast({ title: "Nouvelle conversation" })} />;
    }
  };

  return (
    <div 
      className="h-screen flex overflow-hidden"
      style={{ 
        background: 'var(--color-background)',
        minHeight: '100vh',
      }}
    >
      {/* Modern Sidebar */}
      <ModernSidebar
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
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
