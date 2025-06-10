export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    sidebar: string;
    sidebarActive: string;
  };
  gradient: string;
}

export const themes: Theme[] = [
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: '#3B82F6',
      secondary: '#1E40AF',
      accent: '#60A5FA',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'teal',
    name: 'Teal Gradient',
    colors: {
      primary: '#14B8A6',
      secondary: '#0D9488',
      accent: '#5EEAD4',
      background: 'linear-gradient(135deg, #2DD4BF 0%, #0891B2 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #2DD4BF 0%, #0891B2 100%)',
  },
  {
    id: 'purple',
    name: 'Purple Dream',
    colors: {
      primary: '#8B5CF6',
      secondary: '#7C3AED',
      accent: '#A78BFA',
      background: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    colors: {
      primary: '#F97316',
      secondary: '#EA580C',
      accent: '#FB923C',
      background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    colors: {
      primary: '#10B981',
      secondary: '#059669',
      accent: '#6EE7B7',
      background: 'linear-gradient(135deg, #34D399 0%, #047857 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #34D399 0%, #047857 100%)',
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    colors: {
      primary: '#F43F5E',
      secondary: '#E11D48',
      accent: '#FB7185',
      background: 'linear-gradient(135deg, #F472B6 0%, #BE185D 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #F472B6 0%, #BE185D 100%)',
  },
  {
    id: 'indigo',
    name: 'Indigo Night',
    colors: {
      primary: '#6366F1',
      secondary: '#4F46E5',
      accent: '#818CF8',
      background: 'linear-gradient(135deg, #6366F1 0%, #312E81 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #6366F1 0%, #312E81 100%)',
  },
  {
    id: 'amber',
    name: 'Golden Hour',
    colors: {
      primary: '#F59E0B',
      secondary: '#D97706',
      accent: '#FCD34D',
      background: 'linear-gradient(135deg, #FBBF24 0%, #B45309 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #FBBF24 0%, #B45309 100%)',
  },
  {
    id: 'cyan',
    name: 'Arctic Blue',
    colors: {
      primary: '#06B6D4',
      secondary: '#0891B2',
      accent: '#67E8F9',
      background: 'linear-gradient(135deg, #22D3EE 0%, #0E7490 100%)',
      surface: 'rgba(255, 255, 255, 0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.2)',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarActive: 'rgba(255, 255, 255, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #22D3EE 0%, #0E7490 100%)',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    colors: {
      primary: '#6B7280',
      secondary: '#4B5563',
      accent: '#9CA3AF',
      background: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: '#F9FAFB',
      textMuted: 'rgba(249, 250, 251, 0.7)',
      border: 'rgba(255, 255, 255, 0.1)',
      sidebar: 'rgba(255, 255, 255, 0.03)',
      sidebarActive: 'rgba(255, 255, 255, 0.1)',
    },
    gradient: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
  },
];

export const useTheme = () => {
  const getStoredTheme = (): string => {
    return localStorage.getItem('rony-theme') || 'ocean';
  };

  const setStoredTheme = (themeId: string) => {
    localStorage.setItem('rony-theme', themeId);
  };

  const getCurrentTheme = (): Theme => {
    const themeId = getStoredTheme();
    return themes.find(t => t.id === themeId) || themes[0];
  };

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Apply background gradient to body
    document.body.style.background = theme.gradient;
    document.body.style.backgroundAttachment = 'fixed';
    
    setStoredTheme(theme.id);
  };

  return {
    themes,
    getCurrentTheme,
    applyTheme,
    getStoredTheme,
    setStoredTheme,
  };
};