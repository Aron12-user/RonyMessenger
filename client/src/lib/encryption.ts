
import CryptoJS from 'crypto-js';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

export async function encryptFile(file: File): Promise<{ encryptedData: string; key: string }> {
  const key = CryptoJS.lib.WordArray.random(256/8).toString();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Compress if file is larger than 1MB
        let data = e.target?.result as ArrayBuffer;
        if (file.size > 1024 * 1024) {
          const compressedArray = await compressData(new Uint8Array(data));
          data = compressedArray.buffer;
        }
        
        const wordArray = CryptoJS.lib.WordArray.create(data);
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

async function compressData(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('gzip');
  const compressedStream = new Blob([data]).stream().pipeThrough(stream);
  const compressedData = await new Response(compressedStream).arrayBuffer();
  return new Uint8Array(compressedData);
}

export function decryptFile(encryptedData: string, key: string): ArrayBuffer {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    return decrypted.toArrayBuffer();
  } catch (error) {
    throw new Error('Failed to decrypt file');
  }
}
