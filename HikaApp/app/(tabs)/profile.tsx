import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import React from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const Profile = () => {
  const { user, userProfile, signOut, loading } = useAuth();
  const router = useRouter();

  // Redirect to welcome if not authenticated
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace('/welcome');
  };

  // Show loading only while checking auth, not while loading profile
  if (loading) {
    return <LoadingScreen message="Loading profile..." variant="minimal" />;
  }

  // Use fallback values if profile is still loading
  const displayName = userProfile?.displayName || user?.displayName || 'User';
  const bio = userProfile?.bio || '';
  const totalDistance = userProfile?.totalDistance || 0;
  const totalHikes = userProfile?.totalHikes || 0;
  const totalTime = userProfile?.totalTime || 0;
  const rank = userProfile?.rank || 'Copper';
  const xp = userProfile?.xp || 0;
  const favorites = userProfile?.favorites || [];
  const completed = userProfile?.completed || [];
  const wishlist = userProfile?.wishlist || [];

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        {/* Profile Header */}
        <View className="items-center mb-6">
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-4">
            <Text className="text-3xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">{displayName}</Text>
          {!userProfile && (
            <Text className="text-gray-500 text-sm mt-2">Loading profile data...</Text>
          )}
          {bio && (
            <Text className="text-gray-600 mt-2 text-center">{bio}</Text>
          )}
        </View>

        {/* Stats */}
        <View className="bg-gray-50 rounded-lg p-4 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Stats</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {(totalDistance / 1000).toFixed(1)} km
              </Text>
              <Text className="text-gray-600 text-sm">Total Distance</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">{totalHikes}</Text>
              <Text className="text-gray-600 text-sm">Total Hikes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {Math.floor(totalTime / 3600)}h
              </Text>
              <Text className="text-gray-600 text-sm">Total Time</Text>
            </View>
          </View>
        </View>

        {/* Game Features */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Rank</Text>
          <View className="bg-gray-50 rounded-lg p-4">
            <Text className="text-xl font-bold text-gray-900">{rank}</Text>
            <Text className="text-gray-600">XP: {xp}</Text>
          </View>
        </View>

        {/* Lists */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Lists</Text>
          <View className="space-y-2">
            <TouchableOpacity className="bg-gray-50 rounded-lg p-4">
              <Text className="text-gray-900 font-medium">Favorites ({favorites.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-gray-50 rounded-lg p-4">
              <Text className="text-gray-900 font-medium">Completed ({completed.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-gray-50 rounded-lg p-4">
              <Text className="text-gray-900 font-medium">Wishlist ({wishlist.length})</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          className="bg-red-500 rounded-lg p-4 items-center mt-4"
          onPress={handleSignOut}
        >
          <Text className="text-white font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default Profile;