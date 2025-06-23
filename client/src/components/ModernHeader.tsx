import { Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ModernHeaderProps {
  setIsMobileOpen: (open: boolean) => void;
  currentSection: string;
}

export default function ModernHeader({ setIsMobileOpen, currentSection }: ModernHeaderProps) {
  const getSectionTitle = (section: string) => {
    switch (section) {
      case "messages": return "Conversations";
      case "assistant": return "Assistant IA";
      case "calls": return "Appels";
      case "meetings": return "Réunions";
      case "files": return "Fichiers";
      case "contacts": return "Contacts";
      case "settings": return "Paramètres";
      default: return "Conversations";
    }
  };

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
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
                 style={{ color: 'var(--color-textMuted)' }} />
          <Input
            placeholder="Rechercher..."
            className="pl-10 w-64 bg-white/5 border-white/20 text-white placeholder:text-white/50"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* Add new button */}
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
          style={{
            background: 'var(--color-primary)',
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">
            {currentSection === "messages" && "Nouvelle conversation"}
            {currentSection === "meetings" && "Nouvelle réunion"}
            {currentSection === "files" && "Nouveau fichier"}
            {currentSection === "contacts" && "Nouveau contact"}
            {!["messages", "meetings", "files", "contacts"].includes(currentSection) && "Nouveau"}
          </span>
          <span className="sm:hidden">+</span>
        </Button>
      </div>
    </div>
  );
}