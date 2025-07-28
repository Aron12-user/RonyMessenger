import { useState, useEffect } from 'react';

// ✅ HOOK DE GESTION GLOBALE DE LANGUE AVEC SYNCHRONISATION
export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('rony-language');
      if (savedLang) return savedLang;
      
      // Détection automatique de la langue de l'appareil
      const deviceLang = navigator.language || navigator.languages?.[0] || 'fr';
      const langCode = deviceLang.split('-')[0].toLowerCase();
      return langCode;
    }
    return 'fr';
  });

  // Synchroniser avec localStorage et document.lang
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rony-language', currentLanguage);
      document.documentElement.lang = currentLanguage;
      
      // Déclencher un événement personnalisé pour synchroniser tous les composants
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: currentLanguage }));
    }
  }, [currentLanguage]);

  // Écouter les changements de langue depuis d'autres composants
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLanguage(event.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('languageChanged', handleLanguageChange as EventListener);
      return () => {
        window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
      };
    }
  }, []);

  const changeLanguage = (newLanguage: string) => {
    setCurrentLanguage(newLanguage);
  };

  return { currentLanguage, changeLanguage };
}