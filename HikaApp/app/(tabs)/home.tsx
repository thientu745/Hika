import { View, Text, ScrollView } from 'react-native';
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const Home = () => {
  const { user, userProfile, loading } = useAuth();

  // Redirect to welcome if not authenticated
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  // Show loading only while checking auth, not while loading profile
  if (loading) {
    return <LoadingScreen message="Loading your feed..." variant="minimal" />;
  }

  // Show content even if profile is still loading (with fallback)
  const displayName = userProfile?.displayName || user?.displayName || 'User';

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Welcome back, {displayName}!
        </Text>
        <Text className="text-gray-600 mb-6">
          Feed coming soon...
        </Text>
      </View>
    </ScrollView>
  );
};

export default Home;