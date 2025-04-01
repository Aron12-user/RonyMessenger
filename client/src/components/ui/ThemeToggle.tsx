import { useState, useEffect } from "react";

interface ThemeToggleProps {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
}

export default function ThemeToggle({ isDarkMode, setIsDarkMode }: ThemeToggleProps) {
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center">
        <span className="material-icons text-gray-500 dark:text-gray-400">light_mode</span>
        <label className="relative inline-flex items-center cursor-pointer mx-2">
          <input 
            type="checkbox" 
            checked={isDarkMode} 
            onChange={toggleTheme}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
        <span className="material-icons text-gray-500 dark:text-gray-400">dark_mode</span>
      </div>
    </div>
  );
}
