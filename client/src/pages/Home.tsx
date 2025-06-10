import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("messages");
  const { toast } = useToast();

  // Handle sidebar overlay clicks
  const handleOverlayClick = () => {
    setIsMobileOpen(false);
  };

  // Render appropriate content section
  const renderSection = () => {
    switch (currentSection) {
      case "messages":
        return <Messages />;
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
        return <Messages />;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex h-full">
        {/* Sidebar Overlay (Mobile) */}
        {isMobileOpen && (
          <div 
            onClick={handleOverlayClick}
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          ></div>
        )}
        
        {/* Sidebar */}
        <Sidebar 
          isDarkMode={isDarkMode} 
          setIsDarkMode={setIsDarkMode}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
        />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900 transition-all duration-200">
          {/* App Header */}
          <Header setIsMobileOpen={setIsMobileOpen} />
          
          {/* Content Sections */}
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
