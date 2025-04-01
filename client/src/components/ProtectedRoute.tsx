import { ReactNode, useEffect } from 'react';
import { useLocation, Redirect } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/constants';
import { getQueryFn } from '@/lib/queryClient';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [location, navigate] = useLocation();
  console.log("Current location:", location);

  const { data: user, isLoading, error } = useQuery({
    queryKey: [API_ENDPOINTS.USER],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  console.log("Auth state:", { user, isLoading, error });

  // Afficher un écran de chargement pendant la vérification de l'authentification
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas authentifié, rediriger vers la page d'authentification
  if (!user) {
    console.log("User not authenticated, redirecting to /auth");
    return <Redirect to="/auth" />;
  }

  // Si l'utilisateur est authentifié, afficher le contenu protégé
  console.log("User authenticated, rendering protected content");
  return <>{children}</>;
}