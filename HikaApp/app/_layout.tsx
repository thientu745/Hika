import { Stack, useSegments } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext";
import "../global.css";
import Header from "../components/ui/Header";
import { useEffect, useState } from "react";

function ConditionalHeader() {
  const segments = useSegments();
  const [showHeader, setShowHeader] = useState(true);

  useEffect(() => {
    // Hide header on welcome, login, and signup screens
    // Check all segments to handle nested routes
    const hideHeaderRoutes = ['welcome', 'login', 'signup'];
    const shouldHide = segments.some(segment => hideHeaderRoutes.includes(segment));
    setShowHeader(!shouldHide);
  }, [segments]);

  if (!showHeader) {
    return null;
  }

  return <Header />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ConditionalHeader />
      <Stack>
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="welcome" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="login" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="signup" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="trail/[id]" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="track" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="create-post-from-tracking" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="profile/[uid]" 
          options={{ headerShown: false }} 
        />
      </Stack>
    </AuthProvider>
  );
}