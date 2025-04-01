import { createContext, ReactNode, useContext } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/constants';
import { getQueryFn, apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  displayName: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  lastSeen?: Date;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
}

interface RegisterData {
  username: string;
  password: string;
  displayName?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const { 
    data: user, 
    error, 
    isLoading,
    refetch
  } = useQuery({
    queryKey: [API_ENDPOINTS.USER],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest('POST', API_ENDPOINTS.LOGIN, credentials);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Échec de la connexion');
      }
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: 'Connexion réussie',
        description: 'Bienvenue sur Rony!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Échec de la connexion',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', API_ENDPOINTS.LOGOUT);
      if (!res.ok) {
        throw new Error('Échec de la déconnexion');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData([API_ENDPOINTS.USER], null);
      toast({
        title: 'Déconnexion réussie',
        description: 'À bientôt!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Échec de la déconnexion',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest('POST', API_ENDPOINTS.REGISTER, userData);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Échec de l\'inscription');
      }
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: 'Inscription réussie',
        description: 'Bienvenue sur Rony!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Échec de l\'inscription',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const register = async (userData: RegisterData) => {
    await registerMutation.mutateAsync(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user: user as User | null,
        isLoading,
        error,
        login,
        logout,
        register
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
}