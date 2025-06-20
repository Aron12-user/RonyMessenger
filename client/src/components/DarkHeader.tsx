import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Search, Menu } from 'lucide-react';

interface DarkHeaderProps {
  currentSection: string;
  onMenuToggle?: () => void;
}

export default function DarkHeader({ currentSection, onMenuToggle }: DarkHeaderProps) {
  const { user } = useAuth();

  const getSectionTitle = (section: string) => {
    switch (section) {
      case 'messages': return 'Messages';
      case 'contacts': return 'Contacts';
      case 'meetings': return 'Réunions';
      case 'cloud': return 'Cloud Storage';
      case 'assistant': return 'Assistant IA';
      case 'settings': return 'Paramètres';
      default: return 'Accueil';
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuToggle}
            className="text-gray-300 hover:text-white hover:bg-gray-700 md:hidden"
          >
            <Menu size={20} />
          </Button>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Rechercher..."
                className="pl-10 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500 w-64"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-gray-300 text-sm">
            {user?.displayName || user?.username}
          </div>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}