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
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(102, 126, 234, 0.2)',
      sidebar: 'rgba(102, 126, 234, 0.08)',
      sidebarActive: 'rgba(102, 126, 234, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.15) 0%, rgba(8, 145, 178, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(45, 212, 191, 0.2)',
      sidebar: 'rgba(45, 212, 191, 0.08)',
      sidebarActive: 'rgba(45, 212, 191, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(168, 85, 247, 0.2)',
      sidebar: 'rgba(168, 85, 247, 0.08)',
      sidebarActive: 'rgba(168, 85, 247, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 142, 83, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(255, 107, 107, 0.2)',
      sidebar: 'rgba(255, 107, 107, 0.08)',
      sidebarActive: 'rgba(255, 107, 107, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(4, 120, 87, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(52, 211, 153, 0.2)',
      sidebar: 'rgba(52, 211, 153, 0.08)',
      sidebarActive: 'rgba(52, 211, 153, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.15) 0%, rgba(190, 24, 93, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(244, 114, 182, 0.2)',
      sidebar: 'rgba(244, 114, 182, 0.08)',
      sidebarActive: 'rgba(244, 114, 182, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(49, 46, 129, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(99, 102, 241, 0.2)',
      sidebar: 'rgba(99, 102, 241, 0.08)',
      sidebarActive: 'rgba(99, 102, 241, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(251, 191, 36, 0.2)',
      sidebar: 'rgba(251, 191, 36, 0.08)',
      sidebarActive: 'rgba(251, 191, 36, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(14, 116, 144, 0.15) 100%)',
      surface: 'rgba(255, 255, 255, 0.85)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(34, 211, 238, 0.2)',
      sidebar: 'rgba(34, 211, 238, 0.08)',
      sidebarActive: 'rgba(34, 211, 238, 0.2)',
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
      background: 'linear-gradient(135deg, rgba(55, 65, 81, 0.2) 0%, rgba(17, 24, 39, 0.2) 100%)',
      surface: 'rgba(248, 250, 252, 0.9)',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: 'rgba(55, 65, 81, 0.2)',
      sidebar: 'rgba(55, 65, 81, 0.08)',
      sidebarActive: 'rgba(55, 65, 81, 0.15)',
    },
    gradient: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
  },
  {
    id: 'pure-white',
    name: 'Blanc Pur',
    colors: {
      primary: '#3B82F6',
      secondary: '#1E40AF',
      accent: '#60A5FA',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#1F2937',
      textMuted: '#6B7280',
      border: '#E5E7EB',
      sidebar: '#FFFFFF',
      sidebarActive: '#F3F4F6',
    },
    gradient: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
  },
  {
    id: 'sky-blue',
    name: 'Bleu Ciel',
    colors: {
      primary: '#0EA5E9',
      secondary: '#0284C7',
      accent: '#38BDF8',
      background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
      surface: 'rgba(255, 255, 255, 0.9)',
      text: '#0F172A',
      textMuted: '#475569',
      border: '#CBD5E1',
      sidebar: 'rgba(255, 255, 255, 0.95)',
      sidebarActive: 'rgba(14, 165, 233, 0.1)',
    },
    gradient: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
  },
];

export const getStoredTheme = (): string => {
  return localStorage.getItem('rony-theme') || 'ocean';
};

export const setStoredTheme = (themeId: string) => {
  localStorage.setItem('rony-theme', themeId);
};

export const getCurrentTheme = (): Theme => {
  const themeId = getStoredTheme();
  return themes.find(t => t.id === themeId) || themes[0];
};

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  
  // Apply CSS custom properties
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  
  // Apply background gradient to body with reduced opacity
  document.body.style.background = theme.colors.background;
  document.body.style.backgroundAttachment = 'fixed';
  
  setStoredTheme(theme.id);
};

export const useTheme = () => {
  return {
    themes,
    getCurrentTheme,
    applyTheme,
    getStoredTheme,
    setStoredTheme,
  };
};