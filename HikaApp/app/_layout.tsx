import { Stack } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext";
import "../global.css";
import Header from "../components/ui/Header";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Header />
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
          name="profile/[uid]" 
          options={{ headerShown: false }} 
        />
      </Stack>
    </AuthProvider>
  );
}