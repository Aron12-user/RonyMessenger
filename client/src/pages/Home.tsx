import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/themes";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import DarkHeader from "@/components/DarkHeader";
import WelcomeContent from "@/components/WelcomeContent";
import AIAssistant from "@/pages/AIAssistant";
import MessagesSimple from "@/pages/MessagesSimple";
import MeetingsNew from "@/pages/MeetingsNew";
import FilesManager from "@/pages/FilesManager";
import CloudStorage from "@/pages/CloudStorage";
import Contacts from "@/pages/Contacts";
import SettingsPage from "@/pages/SettingsPage";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export default function Home({ isDarkMode, setIsDarkMode }: HomeProps) {
  const { user } = useAuth();
  const { getCurrentTheme, applyTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("home");
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
    <div className="h-screen flex overflow-hidden bg-gray-900">
      {/* Collapsible Blue Sidebar */}
      <CollapsibleSidebar
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <DarkHeader 
          currentSection={currentSection}
          onMenuToggle={() => setIsMobileOpen(!isMobileOpen)}
        />
        
        <div className="flex-1 overflow-auto bg-gray-900 text-gray-100">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
