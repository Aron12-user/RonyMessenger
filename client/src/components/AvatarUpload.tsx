import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  userId: number;
  displayName?: string | null;
  username: string;
  onAvatarUpdated: (avatarUrl: string) => void;
}

export default function AvatarUpload({ 
  currentAvatar, 
  userId, 
  displayName, 
  username, 
  onAvatarUpdated 
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('userId', userId.toString());

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Échec du téléchargement de l\'avatar');
      }

      return response.json();
    },
    onSuccess: (data) => {
      onAvatarUpdated(data.avatarUrl);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Avatar mis à jour",
        description: "Votre avatar a été mis à jour avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Format invalide",
        description: "Veuillez sélectionner une image",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Fichier trop volumineux",
        description: "L'image doit faire moins de 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (fileInputRef.current?.files?.[0]) {
      uploadMutation.mutate(fileInputRef.current.files[0]);
    }
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div
          className={`relative ${isDragging ? 'ring-2 ring-blue-500' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
        >
          <Avatar className="w-24 h-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <AvatarImage src={previewUrl || currentAvatar || undefined} />
            <AvatarFallback 
              className="text-white font-semibold text-lg bg-gradient-to-br from-blue-500 to-purple-600"
            >
              {displayName ? getInitials(displayName) : username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
               onClick={() => fileInputRef.current?.click()}>
            <Camera className="w-6 h-6 text-white" />
          </div>
        </div>

        {previewUrl && (
          <Button
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0"
            onClick={cancelPreview}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {previewUrl && (
        <div className="flex space-x-2">
          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadMutation.isPending ? 'Téléchargement...' : 'Confirmer'}
          </Button>
          <Button variant="outline" onClick={cancelPreview}>
            Annuler
          </Button>
        </div>
      )}

      <p className="text-sm text-center" style={{ color: 'var(--color-textMuted)' }}>
        Glissez une image ou cliquez pour changer votre avatar
        <br />
        <span className="text-xs">Formats supportés: JPG, PNG, GIF (max 5MB)</span>
      </p>
    </div>
  );
}