// Ce fichier s'assure que les polyfills nécessaires sont chargés
// Les polyfills principaux sont maintenant dans index.html pour être chargés avant tout le reste
console.log('Checking polyfills status:', {
  global: typeof (window as any).global !== 'undefined',
  process: typeof (window as any).process !== 'undefined',
  'process.nextTick': typeof (window as any).process?.nextTick !== 'undefined'
});

// Ajouter une interface pour étendre Window avec nos propriétés personnalisées
declare global {
  interface Window {
    __loadBufferPolyfill: () => Promise<any>;
    buffer?: { Buffer: any };
  }
}

// Charger le polyfill Buffer si nécessaire au runtime
export async function ensureBufferLoaded() {
  if (typeof window === 'undefined') return;

  // On utilise la fonction définie dans index.html
  if (typeof window.__loadBufferPolyfill === 'function') {
    try {
      await window.__loadBufferPolyfill();
      return true;
    } catch (error) {
      console.error('Failed to load Buffer polyfill:', error);
      return false;
    }
  } else {
    console.warn('Buffer polyfill loader not found');
    return false;
  }
}

export {};