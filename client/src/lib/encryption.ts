
import CryptoJS from 'crypto-js';

export async function encryptFile(file: File): Promise<{ encryptedData: string; key: string }> {
  const key = CryptoJS.lib.WordArray.random(256/8).toString();
  const arrayBuffer = await file.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
  const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString();
  
  return {
    encryptedData: encrypted,
    key
  };
}

export function decryptFile(encryptedData: string, key: string): ArrayBuffer {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
  return decrypted.toArrayBuffer();
}
