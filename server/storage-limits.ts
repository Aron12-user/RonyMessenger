// Configuration des limites de stockage
// ✅ LIMITES CONFIRMÉES selon spécifications utilisateur

export const STORAGE_LIMITS = {
  // Limite par fichier individuel
  MAX_FILE_SIZE: 10 * 1024 * 1024 * 1024, // 10 Go

  // Limite par dossier complet
  MAX_FOLDER_SIZE: 2 * 1024 * 1024 * 1024 * 1024, // 2 To

  // Limite totale de stockage Cloud par utilisateur
  MAX_TOTAL_CLOUD_STORAGE: 10 * 1024 * 1024 * 1024 * 1024, // 10 To

  // Autres limites techniques
  MAX_FILES_PER_UPLOAD: 50,
  MAX_FOLDER_DEPTH: 10
} as const;

// Fonctions utilitaires pour le formatage des tailles
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Validation des limites
export function validateFileSize(fileSize: number): { valid: boolean; error?: string } {
  if (fileSize > STORAGE_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Fichier trop volumineux (maximum ${formatFileSize(STORAGE_LIMITS.MAX_FILE_SIZE)})`
    };
  }
  return { valid: true };
}

export function validateFolderSize(totalSize: number): { valid: boolean; error?: string } {
  if (totalSize > STORAGE_LIMITS.MAX_FOLDER_SIZE) {
    return {
      valid: false,
      error: `Dossier trop volumineux (maximum ${formatFileSize(STORAGE_LIMITS.MAX_FOLDER_SIZE)})`
    };
  }
  return { valid: true };
}

export function validateTotalStorage(currentUsage: number, additionalSize: number): { valid: boolean; error?: string } {
  const totalAfterUpload = currentUsage + additionalSize;
  if (totalAfterUpload > STORAGE_LIMITS.MAX_TOTAL_CLOUD_STORAGE) {
    return {
      valid: false,
      error: `Espace de stockage insuffisant (maximum ${formatFileSize(STORAGE_LIMITS.MAX_TOTAL_CLOUD_STORAGE)})`
    };
  }
  return { valid: true };
}