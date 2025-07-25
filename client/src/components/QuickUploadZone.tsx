import { useRef, useState, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface QuickUploadZoneProps {
  onUpload: (files: FileList) => Promise<void>;
  currentFolderId: number | null;
  className?: string;
}

export default function QuickUploadZone({ onUpload, currentFolderId, className = '' }: QuickUploadZoneProps) {
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(files);
        toast({
          title: 'Upload réussi',
          description: `${files.length} fichier(s) uploadé(s) avec succès`,
        });
      } catch (error) {
        toast({
          title: 'Erreur d\'upload',
          description: 'Une erreur est survenue lors de l\'upload',
          variant: 'destructive'
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
  }, [onUpload, toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(files);
        toast({
          title: 'Upload réussi',
          description: `${files.length} fichier(s) uploadé(s) avec succès`,
        });
      } catch (error) {
        toast({
          title: 'Erreur d\'upload',
          description: 'Une erreur est survenue lors de l\'upload',
          variant: 'destructive'
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload, toast]);

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
        isDragOver 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      } ${className}`}
      onDrag={handleDrag}
      onDragStart={handleDrag}
      onDragEnd={handleDrag}
      onDragOver={handleDragIn}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
      />

      {isUploading ? (
        <div className="text-center space-y-4">
          <div className="animate-spin mx-auto">
            <Upload className="h-8 w-8 text-blue-500" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Upload en cours...
            </p>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Upload className={`h-12 w-12 mx-auto ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
          <div className="space-y-2">
            <p className={`text-lg font-medium ${isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {isDragOver ? 'Relâchez pour uploader' : 'Glissez vos fichiers ici'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ou
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mx-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Sélectionner des fichiers
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}