
import CryptoJS from 'crypto-js';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

export async function encryptFile(file: File): Promise<{ encryptedData: string; key: string }> {
  const key = CryptoJS.lib.WordArray.random(256/8).toString();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wordArray = CryptoJS.lib.WordArray.create(e.target?.result as ArrayBuffer);
        const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString();
        resolve({ encryptedData: encrypted, key });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function decryptFile(encryptedData: string, key: string): ArrayBuffer {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    return decrypted.toArrayBuffer();
  } catch (error) {
    throw new Error('Failed to decrypt file');
  }
}
