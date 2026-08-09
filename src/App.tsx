import { useEffect, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { AppShell } from '@/components/AppShell';
import { LoadingScreen } from '@/components/LoadingScreen';

function Router() {
  const { session, profile, loading } = useAuth();
  const [route, setRoute] = useState<string>(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
    setRoute(to);
    window.scrollTo(0, 0);
  }, []);

  if (loading) return <LoadingScreen />;

  if (!session || !profile) {
    if (route.startsWith('/auth')) return <AuthPage navigate={navigate} />;
    return <LandingPage navigate={navigate} />;
  }

  return <AppShell route={route} navigate={navigate} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ThemeProvider>
  );
}
