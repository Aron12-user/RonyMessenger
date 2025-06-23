import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import Home from "@/pages/Home";
import JitsiSimple from "@/pages/JitsiSimple";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { getCurrentTheme, applyTheme } from "@/lib/themes";

function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    // Apply modern theme system
    const theme = getCurrentTheme();
    applyTheme(theme);
    
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <AuthProvider>
      <div className="font-sans antialiased bg-background text-foreground min-h-screen">
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <Route path="/meeting/:roomCode">
            <ProtectedRoute>
              <JitsiSimple />
            </ProtectedRoute>
          </Route>
          <Route path="/">
            <ProtectedRoute>
              <Home isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
            </ProtectedRoute>
          </Route>
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
