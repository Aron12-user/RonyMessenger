import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  setIsMobileOpen: (isOpen: boolean) => void;
}

export default function Header({ setIsMobileOpen }: HeaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleToggleSidebar = () => {
    setIsMobileOpen(true);
  };

  const handleNotificationClick = () => {
    toast({
      title: "Notifications",
      description: "You have 3 unread notifications",
    });
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 md:px-6">
      {/* Mobile Menu Button */}
      <button 
        onClick={handleToggleSidebar}
        className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-2">
        <span className="material-icons">menu</span>
      </button>

      {/* Search Bar */}
      <div className="relative flex-1 max-w-xl">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">
          <span className="material-icons text-lg">search</span>
        </span>
        <input 
          type="text" 
          placeholder="Search messages, files, contacts..." 
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Header Actions */}
      <div className="flex items-center ml-4 space-x-3">
        <button 
          onClick={handleNotificationClick}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative">
          <span className="material-icons">notifications</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
          <span className="material-icons">help_outline</span>
        </button>

        <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
            {user?.displayName?.charAt(0) || user?.username?.charAt(0) || ""}
          </div>
          <span className="hidden md:inline-block font-medium">{user?.displayName || user?.username || "User"}</span>
          <span className="material-icons text-sm">arrow_drop_down</span>
        </button>
      </div>
    </header>
  );
}