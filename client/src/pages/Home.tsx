import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Messages from "@/pages/Messages";
import Calls from "@/pages/Calls";
import Meetings from "@/pages/Meetings";
import Files from "@/pages/Files";
import CloudStorage from "@/pages/CloudStorage";
import Contacts from "@/pages/Contacts";
import Settings from "@/pages/Settings";
import { API_ENDPOINTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export default function Home({ isDarkMode, setIsDarkMode }: HomeProps) {
  const [, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("messages");
  const { toast } = useToast();

  // Query current user
  const { data: currentUser, isLoading, error } = useQuery({
    queryKey: [API_ENDPOINTS.USER],
    retry: false,
  });

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (error) {
      console.log("Authentication error, redirecting to auth page");
      navigate("/auth");
    }
  }, [error, navigate]);

  // Handle sidebar overlay clicks
  const handleOverlayClick = () => {
    setIsMobileOpen(false);
  };

  // Render appropriate content section
  const renderSection = () => {
    switch (currentSection) {
      case "messages":
        return <Messages />;
      case "calls":
        return <Calls />;
      case "meetings":
        return <Meetings />;
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

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
