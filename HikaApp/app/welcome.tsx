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
      router.replace('/(tabs)/home');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingScreen message="Loading..." variant="minimal" />;
  }

  if (user) {
    return null;
  }

  return (
    <View className="flex-1 bg-hika-green px-6 py-12">
      <View className="flex-1 items-center justify-between">
        
        {/* Header Section */}
        <View className="items-center mt-28 w-full">
          {/* Hika with lines on both sides */}
          <View className="flex-row items-center w-full mb-4">
            <View className="flex-1 h-1.5 bg-black" />
            <Text className="text-5xl font-bold text-black mx-6">Hika</Text>
            <View className="flex-1 h-1.5 bg-black" />
          </View>
          
          {/* Welcome Quote */}
          <Text className="text-2xl text-black font-bold text-center mt-10">
            "Take only pictures,{'\n'}leave only footprints."
          </Text>
        </View>

        {/* Create Account Section */}
        <View className="w-full items-center">
          <Text className="text-2xl font-semibold text-black mb-6 text-center">
            Create Your Account
          </Text>

          {/* Next Button */}
          <View className="w-full max-w-sm">
            <Link href="/signup" asChild>
              <TouchableOpacity className="bg-hika-darkgreen py-4 px-6 rounded-full items-center">
                <Text className="text-white text-lg font-semibold">Go Forth!</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Illustration */}
        <View className="items-center mb-8">
          <Image
            source={require('../assets/images/welcome.png')}
            style={{ width: 250, height: 250 }}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

