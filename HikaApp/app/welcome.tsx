import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // User is already logged in, redirect to home
      router.replace('/(tabs)/home');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingScreen message="Loading..." variant="minimal" />;
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-1 items-center px-6 pt-16">
        {/* App Logo/Icon */}
        <View className="mb-8">
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-4">
            <Text className="text-4xl font-bold text-white">H</Text>
          </View>
        </View>

        {/* App Name */}
        <Text className="text-4xl font-bold text-gray-900 mb-2">Hika</Text>
        
        {/* Description */}
        <Text className="text-lg text-gray-600 text-center mb-12 max-w-sm">
          Rate and explore new hiking trails. Connect with friends, track your adventures, and climb the leaderboards.
        </Text>

        {/* Buttons */}
        <View className="w-full max-w-sm space-y-4">
          <Link href="/signup" asChild>
            <TouchableOpacity className="bg-green-500 py-4 px-6 rounded-lg items-center">
              <Text className="text-white text-lg font-semibold">Create Account</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/login" asChild>
            <TouchableOpacity className="bg-gray-100 py-4 px-6 rounded-lg items-center border border-gray-300">
              <Text className="text-gray-900 text-lg font-semibold">Log In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

