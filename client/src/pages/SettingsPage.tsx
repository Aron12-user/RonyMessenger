import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, themes, applyTheme } from "@/lib/themes";
import AvatarUpload from "@/components/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette, User, Bell, Shield } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { getCurrentTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    title: user?.title || '',
  });

  const currentTheme = getCurrentTheme();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('PATCH', '/api/user/profile', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées avec succès",
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

  const updateThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const response = await apiRequest('PATCH', '/api/user/theme', { theme: themeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Thème mis à jour",
        description: "Votre thème a été changé avec succès",
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

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleThemeChange = (themeId: string) => {
    const newTheme = themes.find(t => t.id === themeId);
    if (newTheme) {
      applyTheme(newTheme);
      updateThemeMutation.mutate(themeId);
    }
  };

  const handleAvatarUpdated = (avatarUrl: string) => {
    queryClient.setQueryData(['/api/user'], (oldData: any) => ({
      ...oldData,
      avatar: avatarUrl
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Paramètres
          </h1>
          <p style={{ color: 'var(--color-textMuted)' }}>
            Gérez votre profil, vos préférences et la sécurité de votre compte
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" style={{ color: 'var(--color-text)' }}>
                  <User className="w-5 h-5" />
                  <span>Informations personnelles</span>
                </CardTitle>
                <CardDescription style={{ color: 'var(--color-textMuted)' }}>
                  Mettez à jour vos informations de profil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName" style={{ color: 'var(--color-text)' }}>
                      Nom d'affichage
                    </Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => handleInputChange('displayName', e.target.value)}
                      placeholder="Votre nom d'affichage"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" style={{ color: 'var(--color-text)' }}>
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="votre@email.com"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" style={{ color: 'var(--color-text)' }}>
                      Téléphone
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+33 1 23 45 67 89"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title" style={{ color: 'var(--color-text)' }}>
                      Titre / Poste
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Votre titre professionnel"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>
                </div>
                
                <Button
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  className="mt-4"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>

            {/* Theme Selection */}
            <Card style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2" style={{ color: 'var(--color-text)' }}>
                  <Palette className="w-5 h-5" />
                  <span>Thèmes</span>
                </CardTitle>
                <CardDescription style={{ color: 'var(--color-textMuted)' }}>
                  Personnalisez l'apparence de votre interface
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeChange(theme.id)}
                      className={`
                        p-4 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-lg
                        ${currentTheme.id === theme.id ? 'ring-2 ring-white/50' : 'border-transparent'}
                      `}
                      style={{
                        background: theme.gradient,
                        borderColor: currentTheme.id === theme.id ? 'var(--color-primary)' : 'transparent',
                      }}
                    >
                      <div className="text-sm font-medium text-white text-center">
                        {theme.name}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Avatar Section */}
          <div className="space-y-6">
            <Card style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <CardHeader>
                <CardTitle style={{ color: 'var(--color-text)' }}>Avatar</CardTitle>
                <CardDescription style={{ color: 'var(--color-textMuted)' }}>
                  Personnalisez votre photo de profil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarUpload
                  currentAvatar={user?.avatar}
                  userId={user?.id || 0}
                  displayName={user?.displayName}
                  username={user?.username || ''}
                  onAvatarUpdated={handleAvatarUpdated}
                />
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <CardHeader>
                <CardTitle style={{ color: 'var(--color-text)' }}>Informations du compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label style={{ color: 'var(--color-textMuted)' }}>Nom d'utilisateur</Label>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    @{user?.username}
                  </p>
                </div>
                <Separator style={{ background: 'var(--color-border)' }} />
                <div>
                  <Label style={{ color: 'var(--color-textMuted)' }}>Statut</Label>
                  <p className="font-medium text-green-400">
                    En ligne
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}