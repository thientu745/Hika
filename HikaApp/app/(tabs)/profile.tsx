import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import React, { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { PostComposer } from '../../components/ui/PostComposer';
import { Image } from 'expo-image';
import { pickImage, uploadProfilePicture } from '../../services/storage';
import { updateUserProfile } from '../../services/database';

const Profile = () => {
  const { user, userProfile, signOut, loading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/welcome');
  };

  const handleImageUpload = async () => {
    console.log('=== IMAGE UPLOAD STARTED ===');
    if (!user) {
      console.log('No user found, aborting');
      return;
    }

    try {
      setUploading(true);
      console.log('Uploading state set to true');
      
      // Pick image from device
      console.log('Opening image picker...');
      const imageUri = await pickImage();
      if (!imageUri) {
        setUploading(false);
        return;
      }

      console.log('Picked image URI:', imageUri);
      console.log('Uploading profile picture for user:', user.uid);

      // Upload to Firebase Storage
      const downloadURL = await uploadProfilePicture(user.uid, imageUri);
      console.log('Uploaded to Storage, got URL:', downloadURL);

      // Update user profile with new image URL
      await updateUserProfile(user.uid, {
        profilePictureUrl: downloadURL,
      });
      console.log('Updated Firestore profile with new image URL');

      // Manually refresh the profile to ensure UI updates immediately
      await refreshUserProfile();
      console.log('Refreshed user profile');

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error: any) {
      console.error('❌ ERROR IN PROFILE PICTURE UPLOAD');
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Full error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to upload profile picture. Please try again.';
      
      if (error?.code === 'storage/unauthorized' || error?.message?.includes('denied') || error?.message?.includes('Permission')) {
        errorMessage = 'Upload denied: Check Storage security rules in Firebase Console. Make sure rules are published.';
        console.error('🔴 STORAGE PERMISSION DENIED - Check Firebase Console → Storage → Rules');
      } else if (error?.code === 'storage/canceled') {
        errorMessage = 'Upload was canceled.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Redirect to welcome if not authenticated (after all hooks)
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  // Show loading only while checking auth, not while loading profile
  if (loading) {
    return <LoadingScreen message="Loading profile..." variant="minimal" />;
  }

  // Use fallback values if profile is still loading
  const displayName = userProfile?.displayName || user?.displayName || 'User';
  const bio = userProfile?.bio || '';
  const profilePictureUrl = userProfile?.profilePictureUrl;
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
          <TouchableOpacity
            onPress={handleImageUpload}
            disabled={uploading}
            className="relative mb-4"
            activeOpacity={0.7}
          >
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#E5E7EB' }}
                contentFit="cover"
                key={profilePictureUrl}
                cachePolicy="memory-disk"
              />
            ) : (
              <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center">
                <Text className="text-3xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Upload overlay button */}
            <View className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full items-center justify-center border-2 border-white">
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-bold">+</Text>
              )}
            </View>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">{displayName}</Text>
          {!userProfile && (
            <Text className="text-gray-500 text-sm mt-2">Loading profile data...</Text>
          )}
          {bio && (
            <Text className="text-gray-600 mt-2 text-center">{bio}</Text>
          )}
        </View>

        {/* Composer (create posts) */}
        {user && (
          <View className="mb-4">
            <PostComposer />
          </View>
        )}

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