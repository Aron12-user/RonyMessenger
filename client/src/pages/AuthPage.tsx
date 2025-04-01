import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  
  const { user, isLoading, login, register } = useAuth();
  
  // Rediriger vers la page d'accueil si l'utilisateur est déjà connecté
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(loginUsername, loginPassword);
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerPassword !== registerConfirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    
    try {
      await register({
        username: registerUsername,
        password: registerPassword,
        displayName: registerDisplayName || registerUsername
      });
    } catch (error) {
      console.error('Erreur d\'inscription:', error);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Colonne d'authentification */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Rony</h1>
            <p className="text-muted-foreground mt-2">Plateforme de communication et collaboration</p>
          </div>
          
          <Tabs defaultValue="login" value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="register">Inscription</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="loginUsername">Nom d'utilisateur</Label>
                  <Input 
                    id="loginUsername" 
                    type="text" 
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required 
                  />
                </div>
                
                <div>
                  <Label htmlFor="loginPassword">Mot de passe</Label>
                  <Input 
                    id="loginPassword" 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required 
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(!!checked)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal">Se souvenir de moi</Label>
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
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="registerUsername">Nom d'utilisateur</Label>
                  <Input 
                    id="registerUsername" 
                    type="text" 
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required 
                  />
                </div>
                
                <div>
                  <Label htmlFor="registerDisplayName">Nom à afficher</Label>
                  <Input 
                    id="registerDisplayName" 
                    type="text" 
                    value={registerDisplayName}
                    onChange={(e) => setRegisterDisplayName(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
                
                <div>
                  <Label htmlFor="registerPassword">Mot de passe</Label>
                  <Input 
                    id="registerPassword" 
                    type="password" 
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required 
                  />
                </div>
                
                <div>
                  <Label htmlFor="registerConfirmPassword">Confirmer le mot de passe</Label>
                  <Input 
                    id="registerConfirmPassword" 
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