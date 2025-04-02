import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from 'uuid';

export async function compressImage(file: File): Promise<File | null> {
  try {
    if (!file.type.startsWith('image/')) return file;

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.src = URL.createObjectURL(file);
    await new Promise(resolve => img.onload = resolve);

    const maxWidth = 1920;
    const maxHeight = 1080;
    let width = img.width;
    let height = img.height;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width *= ratio;
      height *= ratio;
    }

    canvas.width = width;
    canvas.height = height;
    ctx?.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, file.type, 0.8);
    });

    if (!blob) return null; // Handle case where blob creation fails
    return new File([blob], file.name, { type: file.type });
  } catch (error) {
    console.error('Error compressing image:', error);
    return null; // Handle any other errors during compression
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRandomMeetingId(): string {
  // Générer un UUID et prendre les 12 premiers caractères pour un ID plus court et plus facile à partager
  return uuidv4().substring(0, 12);
}

export function formatTimestamp(timestamp: Date | string | number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(timestamp: Date | string | number): string {
  const date = new Date(timestamp);
  const today = new Date();

  // If today
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  // If yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // If in the last week
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (date > weekAgo) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }

  // Otherwise
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function generateInitials(name: string): string {
  if (!name) return '';

  const parts = name.split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(userId: number): string {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length];
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}