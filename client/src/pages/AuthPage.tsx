import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import authBackgroundImage from '@assets/5968949_1750430126500.jpg';

export default function AuthPage() {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  
  const [tab, setTab] = useState('login');
  const [, navigate] = useLocation();
  
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  
  // Rediriger vers la page d'accueil si l'utilisateur est déjà connecté
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    loginMutation.mutate({
      username: loginUsername,
      password: loginPassword
    });
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerPassword !== registerConfirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    
    // Vérifier que l'adresse Rony se termine par @rony.com
    if (!registerUsername.endsWith('@rony.com')) {
      alert('L\'adresse Rony doit se terminer par @rony.com');
      return;
    }
    
    registerMutation.mutate({
      username: registerUsername,
      password: registerPassword,
      displayName: registerDisplayName || registerUsername.split('@')[0]
    });
  };
  
  return (
    <div 
      className="min-h-screen flex flex-col md:flex-row"
      style={{
        backgroundImage: `url(${authBackgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Colonne d'authentification */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Rony</h1>
            <p className="text-muted-foreground mt-2">Plateforme de communication et collaboration</p>
          </div>
          
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="register">Inscription</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Adresse Rony</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="votre.nom@rony.com"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember-me" className="text-sm">Se souvenir de moi</Label>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Connexion en cours...' : 'Se connecter'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Adresse Rony</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="votre.nom@rony.com"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Votre adresse Rony doit se terminer par @rony.com
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-display-name">Nom d'affichage (optionnel)</Label>
                  <Input
                    id="register-display-name"
                    type="text"
                    placeholder="Votre nom complet"
                    value={registerDisplayName}
                    onChange={(e) => setRegisterDisplayName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-password">Mot de passe</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="register-confirm-password"
                    type="password"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Inscription en cours...' : 'S\'inscrire'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Colonne d'accueil */}
      <div className="w-full hidden md:flex md:w-1/2 bg-primary/10 p-6 items-center justify-center">
        <div className="max-w-md">
          <h2 className="text-4xl font-bold mb-6">Bienvenue sur Rony</h2>
          <p className="mb-4 text-lg">Une plateforme de communication et collaboration complète :</p>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <span className="mr-2 text-primary font-bold">✓</span>
              <span>Messagerie instantanée sécurisée</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary font-bold">✓</span>
              <span>Appels audio et vidéo</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary font-bold">✓</span>
              <span>Salles de réunion virtuelles</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary font-bold">✓</span>
              <span>Partage de fichiers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-primary font-bold">✓</span>
              <span>Stockage cloud personnel</span>
            </li>
          </ul>
          <p className="text-sm opacity-80">Rejoignez des millions d'utilisateurs et restez connecté.</p>
        </div>
      </div>
    </div>
  );
}