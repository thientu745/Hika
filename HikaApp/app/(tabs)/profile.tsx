import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { PostComposer } from '../../components/ui/PostComposer';
import { PostCard } from '../../components/ui/PostCard';
import { getUserPosts, getTrail, addTrailToList, removeTrailFromList, updateUserProfile } from '../../services/database';
import { Image } from 'expo-image';
import { pickImage, uploadProfilePicture } from '../../services/storage';
import type { Post, Trail, UserRank } from '../../types';

// Rank thresholds
const RANK_THRESHOLDS: Record<UserRank, { min: number; max: number; next?: UserRank }> = {
  Copper: { min: 0, max: 999, next: 'Bronze' },
  Bronze: { min: 1000, max: 4999, next: 'Silver' },
  Silver: { min: 5000, max: 14999, next: 'Gold' },
  Gold: { min: 15000, max: 49999, next: 'Platinum' },
  Platinum: { min: 50000, max: 149999, next: 'Diamond' },
  Diamond: { min: 150000, max: Infinity },
};

// Rank visual indicators
const getRankVisuals = (rank: UserRank) => {
  const visuals: Record<UserRank, { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string; emoji: string }> = {
    Copper: { icon: 'trophy', color: '#B87333', bgColor: '#F5E6D3', emoji: '🥉' },
    Bronze: { icon: 'trophy', color: '#CD7F32', bgColor: '#F5E6D3', emoji: '🥉' },
    Silver: { icon: 'trophy', color: '#C0C0C0', bgColor: '#F0F0F0', emoji: '🥈' },
    Gold: { icon: 'trophy', color: '#FFD700', bgColor: '#FFF9E6', emoji: '🥇' },
    Platinum: { icon: 'star', color: '#E5E4E2', bgColor: '#F5F5F5', emoji: '💎' },
    Diamond: { icon: 'star', color: '#B9F2FF', bgColor: '#E6F7FF', emoji: '💠' },
  };
  return visuals[rank];
};

// Helper function to calculate XP progress
const getXPProgress = (currentXP: number, currentRank: UserRank) => {
  const rankInfo = RANK_THRESHOLDS[currentRank];
  const xpInCurrentRank = currentXP - rankInfo.min;
  const xpNeededForCurrentRank = rankInfo.max - rankInfo.min + 1;
  const progressPercent = Math.min(100, (xpInCurrentRank / xpNeededForCurrentRank) * 100);
  
  let xpNeededForNextRank: number | null = null;
  let nextRank: UserRank | null = null;
  
  if (rankInfo.next) {
    nextRank = rankInfo.next;
    const nextRankInfo = RANK_THRESHOLDS[rankInfo.next];
    xpNeededForNextRank = nextRankInfo.min - currentXP;
  }
  
  return {
    currentXP,
    currentRank,
    xpInCurrentRank,
    xpNeededForCurrentRank,
    progressPercent,
    xpNeededForNextRank,
    nextRank,
    rankMin: rankInfo.min,
    rankMax: rankInfo.max === Infinity ? currentXP : rankInfo.max,
  };
};

// Reusable TrailRow component for consistent list rendering
interface TrailRowProps {
  trail: Trail;
  userProfile: any;
  user: any;
  listType: 'favorites' | 'wishlist' | 'completed';
  onNavigate: (trailId: string) => void;
  onRefresh: () => Promise<void>;
}

const TrailRow = ({ trail, userProfile, user, listType, onNavigate, onRefresh }: TrailRowProps) => {
  const isFavorited = userProfile?.favorites?.includes(trail.id);

  const handleToggleFavorite = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to manage favorites.');
      return;
    }
    try {
      if (isFavorited) {
        await removeTrailFromList(user.uid, trail.id, 'favorites');
      } else {
        await addTrailToList(user.uid, trail.id, 'favorites');
      }
      await onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
    }
  };

  const handleRemoveFromList = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to manage lists.');
      return;
    }

    try {
      await removeTrailFromList(user.uid, trail.id, listType);
      await onRefresh();
      console.log(`Trail removed from ${listType}`);
    } catch (error) {
      console.error('Failed to remove trail:', error);
      Alert.alert('Error', 'Failed to remove trail. Please try again.');
    }
  };

  return (
    <View className="px-4 py-3 border-b border-gray-100 last:border-b-0 flex-row items-center justify-between">
      <TouchableOpacity
        onPress={() => onNavigate(trail.id)}
        className="flex-1"
      >
        <Text className="text-gray-900 font-medium">{trail.name}</Text>
        {trail.location && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text className="text-gray-600 text-xs ml-1">{trail.location}</Text>
          </View>
        )}
      </TouchableOpacity>
      <View className="flex-row items-center ml-2">
        {(listType === 'wishlist' || listType === 'completed') && (
          <TouchableOpacity
            onPress={handleToggleFavorite}
            className="p-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons 
              name={isFavorited ? 'heart' : 'heart-outline'} 
              size={18} 
              color="#EF4444" 
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleRemoveFromList}
          className="p-2"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </View>
  );
};

const Profile = () => {
  const { user, userProfile, signOut, loading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  // Toggle states for dropdowns
  const [showFavorites, setShowFavorites] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Trail lists
  const [favoriteTrails, setFavoriteTrails] = useState<Trail[]>([]);
  const [wishlistTrails, setWishlistTrails] = useState<Trail[]>([]);
  const [completedTrails, setCompletedTrails] = useState<Trail[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/welcome');
  };

  // Optimized trail loading function - uses Promise.all for parallel loading
  const loadTrails = async (trailIds: string[]) => {
    if (trailIds.length === 0) return [];
    
    try {
      const trailPromises = trailIds.map(id =>
        getTrail(id).catch(err => {
          console.warn(`Failed to load trail ${id}:`, err);
          return null;
        })
      );
      const trails = await Promise.all(trailPromises);
      return trails.filter((trail): trail is Trail => trail !== null);
    } catch (err) {
      console.error('Error loading trails:', err);
      return [];
    }
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

  // Use fallback values if profile is still loading
  const displayName = userProfile?.displayName || user?.displayName || 'User';
  const bio = userProfile?.bio || '';
  const profilePictureUrl = userProfile?.profilePictureUrl;
  const totalDistance = userProfile?.totalDistance || 0;
  const totalHikes = userProfile?.totalHikes || 0;
  const totalTime = userProfile?.totalTime || 0;
  const rank = userProfile?.rank || 'Copper';
  const xp = userProfile?.xp || 0;
  const favorites = useMemo(() => userProfile?.favorites || [], [userProfile?.favorites]);
  const completed = useMemo(() => userProfile?.completed || [], [userProfile?.completed]);
  const wishlist = useMemo(() => userProfile?.wishlist || [], [userProfile?.wishlist]);

  // Load user posts
  useEffect(() => {
    if (!user?.uid) return;

    const loadPosts = async () => {
      setLoadingPosts(true);
      try {
        const posts = await getUserPosts(user.uid, 100);
        setUserPosts(posts);
      } catch (err) {
        console.error('Error loading posts:', err);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadPosts();
  }, [user?.uid]);

  // Load favorite trails when section is expanded
  useEffect(() => {
    if (!showFavorites || favorites.length === 0) {
      setFavoriteTrails([]);
      return;
    }

    const load = async () => {
      setLoadingFavorites(true);
      const trails = await loadTrails(favorites);
      setFavoriteTrails(trails);
      setLoadingFavorites(false);
    };

    load();
  }, [showFavorites, favorites]);

  // Load wishlist trails when section is expanded
  useEffect(() => {
    if (!showWishlist || wishlist.length === 0) {
      setWishlistTrails([]);
      return;
    }

    const load = async () => {
      setLoadingWishlist(true);
      const trails = await loadTrails(wishlist);
      setWishlistTrails(trails);
      setLoadingWishlist(false);
    };

    load();
  }, [showWishlist, wishlist]);

  // Load completed trails when section is expanded
  useEffect(() => {
    if (!showCompleted || completed.length === 0) {
      setCompletedTrails([]);
      return;
    }

    const load = async () => {
      setLoadingCompleted(true);
      const trails = await loadTrails(completed);
      setCompletedTrails(trails);
      setLoadingCompleted(false);
    };

    load();
  }, [showCompleted, completed]);

  // Redirect to welcome if not authenticated (after all hooks)
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  // Show loading only while checking auth, not while loading profile
  if (loading) {
    return <LoadingScreen message="Loading profile..." variant="minimal" />;
  }

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
            <PostComposer 
              onPosted={() => {
                // Refresh posts after creating a new post
                if (user?.uid) {
                  getUserPosts(user.uid, 100).then(setUserPosts).catch(console.error);
                }
              }}
            />
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
          <Text className="text-lg font-semibold text-gray-900 mb-3">Rank & Progress</Text>
          <View className="bg-gray-50 rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                {(() => {
                  const rankVisuals = getRankVisuals(rank as UserRank);
                  return (
                    <View 
                      style={[styles.rankBadge, { backgroundColor: rankVisuals.bgColor }]}
                      className="flex-row items-center px-3 py-2 rounded-full mr-3"
                    >
                      <Ionicons name={rankVisuals.icon} size={24} color={rankVisuals.color} />
                      <Text className="text-lg font-bold ml-2" style={{ color: rankVisuals.color }}>
                        {rank}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text className="text-gray-600 font-medium">{xp.toLocaleString()} XP</Text>
            </View>
            
            {/* XP Progress Bar */}
            {(() => {
              const progress = getXPProgress(xp, rank as UserRank);
              return (
                <View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${progress.progressPercent}%` }
                      ]} 
                    />
                  </View>
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-xs text-gray-500">
                      {progress.rankMin.toLocaleString()} XP
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {progress.rankMax === Infinity ? '∞' : progress.rankMax.toLocaleString()} XP
                    </Text>
                  </View>
                  {progress.nextRank && progress.xpNeededForNextRank !== null && (
                    <View className="mt-3 pt-3 border-t border-gray-200">
                      <View className="flex-row items-center mb-1">
                        <Text className="text-sm text-gray-700 mr-2">Next Rank:</Text>
                        {(() => {
                          const nextRankVisuals = getRankVisuals(progress.nextRank!);
                          return (
                            <View className="flex-row items-center">
                              <Ionicons name={nextRankVisuals.icon} size={16} color={nextRankVisuals.color} />
                              <Text className="text-sm font-semibold ml-1" style={{ color: nextRankVisuals.color }}>
                                {progress.nextRank}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      <Text className="text-sm text-green-600 font-medium">
                        {progress.xpNeededForNextRank.toLocaleString()} XP needed
                      </Text>
                    </View>
                  )}
                  {!progress.nextRank && (
                    <View className="mt-3 pt-3 border-t border-gray-200">
                      <Text className="text-sm text-gray-600 font-medium">
                        🏆 Maximum rank achieved!
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </View>

        {/* Favorites */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setShowFavorites(!showFavorites)}
            className="bg-gray-50 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="heart" size={20} color="#EF4444" />
              <Text className="text-gray-900 font-semibold ml-2">Favorites ({favorites.length})</Text>
            </View>
            <Ionicons 
              name={showFavorites ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {showFavorites && (
            <View className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {loadingFavorites ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : favoriteTrails.length === 0 ? (
                <View className="p-4">
                  <Text className="text-gray-500 text-center">No favorite trails yet.</Text>
                </View>
              ) : (
                favoriteTrails.map((trail) => (
                  <TrailRow
                    key={trail.id}
                    trail={trail}
                    userProfile={userProfile}
                    user={user}
                    listType="favorites"
                    onNavigate={(id) => router.push(`/trail/${id}` as any)}
                    onRefresh={refreshUserProfile}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Wishlist */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setShowWishlist(!showWishlist)}
            className="bg-gray-50 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="bookmark" size={20} color="#3B82F6" />
              <Text className="text-gray-900 font-semibold ml-2">Wishlist ({wishlist.length})</Text>
            </View>
            <Ionicons 
              name={showWishlist ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {showWishlist && (
            <View className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {loadingWishlist ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : wishlistTrails.length === 0 ? (
                <View className="p-4">
                  <Text className="text-gray-500 text-center">No trails in wishlist yet.</Text>
                </View>
              ) : (
                wishlistTrails.map((trail) => (
                  <TrailRow
                    key={trail.id}
                    trail={trail}
                    userProfile={userProfile}
                    user={user}
                    listType="wishlist"
                    onNavigate={(id) => router.push(`/trail/${id}` as any)}
                    onRefresh={refreshUserProfile}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Completed Trails */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setShowCompleted(!showCompleted)}
            className="bg-gray-50 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text className="text-gray-900 font-semibold ml-2">Completed Trails ({completed.length})</Text>
            </View>
            <Ionicons 
              name={showCompleted ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {showCompleted && (
            <View className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {loadingCompleted ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : completedTrails.length === 0 ? (
                <View className="p-4">
                  <Text className="text-gray-500 text-center">No completed trails yet.</Text>
                </View>
              ) : (
                completedTrails.map((trail) => (
                  <TrailRow
                    key={trail.id}
                    trail={trail}
                    userProfile={userProfile}
                    user={user}
                    listType="completed"
                    onNavigate={(id) => router.push(`/trail/${id}` as any)}
                    onRefresh={refreshUserProfile}
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Posts */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">My Posts</Text>
          {loadingPosts ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#10b981" />
              <Text className="text-gray-500 text-sm mt-2">Loading posts...</Text>
            </View>
          ) : userPosts.length === 0 ? (
            <View className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <Text className="text-gray-500 text-center">No posts yet. Create your first post!</Text>
            </View>
          ) : (
            <View>
              {userPosts
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
            </View>
          )}
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

const styles = StyleSheet.create({
  progressBarContainer: {
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 12,
    minWidth: 4,
  },
  rankBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default Profile;