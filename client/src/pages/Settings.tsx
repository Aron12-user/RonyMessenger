import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type LanguageOption = "fr" | "en";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    title: user?.title || "",
    bio: "",
  });
  
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>("en");
  const [notifications, setNotifications] = useState({
    messages: true,
    calls: true,
    meetings: true,
  });
  const [privacy, setPrivacy] = useState({
    showStatus: true,
    showLastSeen: true,
    readReceipts: true,
  });
  
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const res = await apiRequest("PATCH", `/api/user/profile`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profil mis à jour",
        description: "Vos informations de profil ont été mises à jour avec succès.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: `Impossible de mettre à jour le profil: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };
  
  const changeLanguage = (language: LanguageOption) => {
    setSelectedLanguage(language);
    // En production, nous changerions la langue de l'application ici
    toast({
      title: language === "fr" ? "Langue modifiée" : "Language changed",
      description: language === "fr" 
        ? "L'application est maintenant en français." 
        : "The application is now in English.",
    });
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Paramètres</h1>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="appearance">Apparence</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Confidentialité</TabsTrigger>
          </TabsList>
          
          {/* Onglet Profil */}
          <TabsContent value="profile">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Informations de profil</h2>
              <form onSubmit={handleProfileSubmit}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="displayName">Nom d'affichage</Label>
                    <Input
                      id="displayName"
                      name="displayName"
                      value={profileData.displayName}
                      onChange={handleProfileChange}
                      placeholder="Votre nom d'affichage"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      placeholder="votre@email.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="title">Titre / Poste</Label>
                    <Input
                      id="title"
                      name="title"
                      value={profileData.title}
                      onChange={handleProfileChange}
                      placeholder="Ex: Développeur, Marketing Manager..."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={profileData.bio}
                      onChange={handleProfileChange}
                      placeholder="Quelques mots sur vous..."
                      rows={4}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Mise à jour..." : "Enregistrer les modifications"}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
          
          {/* Onglet Apparence */}
          <TabsContent value="appearance">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Apparence et langue</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Langue</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={selectedLanguage === "en" ? "default" : "outline"}
                      onClick={() => changeLanguage("en")}
                      className="justify-start"
                    >
                      🇬🇧 English
                    </Button>
                    <Button
                      variant={selectedLanguage === "fr" ? "default" : "outline"}
                      onClick={() => changeLanguage("fr")}
                      className="justify-start"
                    >
                      🇫🇷 Français
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Thème de l'application</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Vous pouvez changer le thème de l'application en utilisant le bouton dans la barre latérale.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Onglet Notifications */}
          <TabsContent value="notifications">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Notifications</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="messages-notif" className="font-medium">Messages</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notifications pour les nouveaux messages
                    </p>
                  </div>
                  <Switch
                    id="messages-notif"
                    checked={notifications.messages}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, messages: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="calls-notif" className="font-medium">Appels</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Notifications pour les appels entrants
                    </p>
                  </div>
                  <Switch
                    id="calls-notif"
                    checked={notifications.calls}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, calls: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="meetings-notif" className="font-medium">Réunions</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Rappels pour les réunions programmées
                    </p>
                  </div>
                  <Switch
                    id="meetings-notif"
                    checked={notifications.meetings}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, meetings: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Onglet Confidentialité */}
          <TabsContent value="privacy">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Confidentialité</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="show-status" className="font-medium">Statut en ligne</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Montrer si vous êtes en ligne
                    </p>
                  </div>
                  <Switch
                    id="show-status"
                    checked={privacy.showStatus}
                    onCheckedChange={(checked) => 
                      setPrivacy(prev => ({ ...prev, showStatus: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="show-last-seen" className="font-medium">Dernière connexion</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Montrer votre dernière heure de connexion
                    </p>
                  </div>
                  <Switch
                    id="show-last-seen"
                    checked={privacy.showLastSeen}
                    onCheckedChange={(checked) => 
                      setPrivacy(prev => ({ ...prev, showLastSeen: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="read-receipts" className="font-medium">Accusés de lecture</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Permettre aux autres de voir quand vous avez lu leurs messages
                    </p>
                  </div>
                  <Switch
                    id="read-receipts"
                    checked={privacy.readReceipts}
                    onCheckedChange={(checked) => 
                      setPrivacy(prev => ({ ...prev, readReceipts: checked }))
                    }
                  />
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Sécurité du compte</h3>
                  <Button variant="outline" className="mt-2">
                    Changer le mot de passe
                  </Button>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2 text-destructive">Zone de danger</h3>
                  <Button variant="destructive" className="mt-2">
                    Supprimer mon compte
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}