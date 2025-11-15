import { Redirect, useRootNavigationState } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export default function Index() {
  const { user, loading } = useAuth();
  const rootNavigationState = useRootNavigationState();

  // Wait for navigation to be ready
  if (!rootNavigationState?.key || loading) {
    return <LoadingScreen message="Initializing..." showLogo />;
  }

  // Redirect based on auth state
  if (!user) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/(tabs)/home" />;
}

