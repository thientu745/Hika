import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { followUser, unfollowUser, getTrail, getUserPosts, getUserProfiles } from "../../services/database";
import { db } from "../../firebaseConfig";
import { doc, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { PostComposer } from "../../components/ui/PostComposer";
import { PostCard } from "../../components/ui/PostCard";
import { Image } from "expo-image";
import type { Post, UserProfile, Trail, UserRank } from "../../types";

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


const RemoteProfile = () => {
  const { uid } = useLocalSearchParams();
  const { user, userProfile, loading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [processingFollow, setProcessingFollow] = useState(false);
  const [following, setFollowing] = useState<boolean>(false);
  
  // Toggle states for dropdowns
  const [showFavorites, setShowFavorites] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  
  // Trail lists
  const [favoriteTrails, setFavoriteTrails] = useState<Trail[]>([]);
  const [wishlistTrails, setWishlistTrails] = useState<Trail[]>([]);
  const [completedTrails, setCompletedTrails] = useState<Trail[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  
  // Social lists
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    if (!uid) return;

    setLoadingProfile(true);
    const profileRef = doc(db, 'users', uid as string);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            uid: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as UserProfile);
        } else {
          setProfile(null);
        }
        setLoadingProfile(false);
      },
      (err) => {
        console.warn('Profile listener error', err);
        setLoadingProfile(false);
      }
    );

    // Posts listener
    setLoadingPosts(true);
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('userId', '==', uid as string), orderBy('createdAt', 'desc'), limit(50));
    const unsubPosts = onSnapshot(
      q,
      (snap) => {
        const ps: Post[] = [];
        snap.forEach((d) => {
          const data = d.data();
          ps.push({
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            comments: (data.comments || []).map((c: any) => ({
              ...c,
              createdAt: c.createdAt?.toDate?.() || new Date(),
            })),
          } as Post);
        });
        setPosts(ps);
        setLoadingPosts(false);
      },
      (err) => {
        console.warn('Posts listener error', err);
        setLoadingPosts(false);
      }
    );

    return () => {
      try {
        unsubProfile();
      } catch {}
      try {
        unsubPosts();
      } catch {}
    };
  }, [uid]);

  // Load favorite trails when section is expanded
  useEffect(() => {
    if (!showFavorites || !profile || profile.favorites.length === 0) {
      setFavoriteTrails([]);
      return;
    }

    const loadFavoriteTrails = async () => {
      setLoadingFavorites(true);
      try {
        const trails: Trail[] = [];
        for (const trailId of profile.favorites) {
          try {
            const trail = await getTrail(trailId);
            if (trail) {
              trails.push(trail);
            }
          } catch (err) {
            console.warn(`Failed to load favorite trail ${trailId}:`, err);
          }
        }
        setFavoriteTrails(trails);
      } catch (err) {
        console.error('Error loading favorite trails:', err);
      } finally {
        setLoadingFavorites(false);
      }
    };

    loadFavoriteTrails();
  }, [showFavorites, profile?.favorites]);

  // Load wishlist trails when section is expanded
  useEffect(() => {
    if (!showWishlist || !profile || profile.wishlist.length === 0) {
      setWishlistTrails([]);
      return;
    }

    const loadWishlistTrails = async () => {
      setLoadingWishlist(true);
      try {
        const trails: Trail[] = [];
        for (const trailId of profile.wishlist) {
          try {
            const trail = await getTrail(trailId);
            if (trail) {
              trails.push(trail);
            }
          } catch (err) {
            console.warn(`Failed to load wishlist trail ${trailId}:`, err);
          }
        }
        setWishlistTrails(trails);
      } catch (err) {
        console.error('Error loading wishlist trails:', err);
      } finally {
        setLoadingWishlist(false);
      }
    };

    loadWishlistTrails();
  }, [showWishlist, profile?.wishlist]);

  // Load completed trails when section is expanded
  useEffect(() => {
    if (!showCompleted || !profile || profile.completed.length === 0) {
      setCompletedTrails([]);
      return;
    }

    const loadCompletedTrails = async () => {
      setLoadingCompleted(true);
      try {
        const trails: Trail[] = [];
        for (const trailId of profile.completed) {
          try {
            const trail = await getTrail(trailId);
            if (trail) {
              trails.push(trail);
            }
          } catch (err) {
            console.warn(`Failed to load completed trail ${trailId}:`, err);
          }
        }
        setCompletedTrails(trails);
      } catch (err) {
        console.error('Error loading completed trails:', err);
      } finally {
        setLoadingCompleted(false);
      }
    };

    loadCompletedTrails();
  }, [showCompleted, profile?.completed]);

  // Load followers when modal opens
  useEffect(() => {
    if (!showFollowers || !profile || (profile.followers || []).length === 0) {
      if (!showFollowers) {
        setFollowersList([]);
      }
      return;
    }

    const loadFollowers = async () => {
      setLoadingFollowers(true);
      try {
        const profiles = await getUserProfiles(profile.followers || []);
        setFollowersList(profiles);
      } catch (err) {
        console.error('Error loading followers:', err);
      } finally {
        setLoadingFollowers(false);
      }
    };

    loadFollowers();
  }, [showFollowers, profile?.followers]);

  // Load following when modal opens
  useEffect(() => {
    if (!showFollowing || !profile || (profile.following || []).length === 0) {
      if (!showFollowing) {
        setFollowingList([]);
      }
      return;
    }

    const loadFollowing = async () => {
      setLoadingFollowing(true);
      try {
        const profiles = await getUserProfiles(profile.following || []);
        setFollowingList(profiles);
      } catch (err) {
        console.error('Error loading following:', err);
      } finally {
        setLoadingFollowing(false);
      }
    };

    loadFollowing();
  }, [showFollowing, profile?.following]);


  const isOwn = user?.uid === uid;

  // Local following state for optimistic UI updates
  useEffect(() => {
    setFollowing(!!(userProfile?.following?.includes(uid as string)));
  }, [userProfile, uid]);

  // Redirect if not authenticated when auth check finished
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  const handleFollowToggle = async () => {
    if (!user || !profile) return;
    setProcessingFollow(true);
    // Optimistically toggle UI immediately
    const prev = following;
    setFollowing(!prev);

    try {
      if (prev) {
        // previously following -> unfollow
        await unfollowUser(user.uid, profile.uid);

        // update remote profile locally: remove current user from followers
        setProfile((prevP) =>
          prevP
            ? { ...prevP, followers: (prevP.followers || []).filter((id) => id !== user.uid) }
            : prevP
        );
      } else {
        // previously not following -> follow
        await followUser(user.uid, profile.uid);

        // update remote profile locally: add current user to followers
        setProfile((prevP) =>
          prevP ? { ...prevP, followers: Array.from(new Set([...(prevP.followers || []), user.uid])) } : prevP
        );
      }

      // On success, refresh AuthContext profile so the current user's following list updates
      try {
        await refreshUserProfile();
      } catch (e) {
        console.warn("Failed to refresh user profile after follow change", e);
      }
    } catch (e) {
      // Revert optimistic update on error
      console.warn('Follow action failed', e);
      setFollowing(prev);
    } finally {
      setProcessingFollow(false);
    }
  };

  if (loading || loadingProfile) {
    return <LoadingScreen message="Loading profile..." variant="minimal" />;
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-600">Profile not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-hika-darkgreen">
      <View className="px-4 py-6">
        {/* Back Button */}
        <TouchableOpacity
          className="mb-4 flex-row items-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          <Text className="text-white ml-2 font-semibold">Back</Text>
        </TouchableOpacity>

        {/* Profile Header */}
        <View className="items-center mb-6">
          {profile.profilePictureUrl ? (
            <Image
              source={{ uri: profile.profilePictureUrl }}
              style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#E5E7EB' }}
              contentFit="cover"
            />
          ) : (
            <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-4">
              <Text className="text-3xl font-bold text-hika-green">
                {profile.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          {/* Changed from text-black to text-white */}
          <Text className="text-2xl font-bold text-white mt-4">{profile.displayName}</Text>
          
          {profile.bio && (
            <Text className="text-gray-300 mt-2 text-center">{profile.bio}</Text>
          )}

          {/* Follow Button - Fixed syntax */}
          {user && uid !== user.uid && (
            <TouchableOpacity
              style={{
                marginTop: 16,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                backgroundColor: following ? '#FFFFFF' : '#17AE3C',
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
              onPress={handleFollowToggle}
              disabled={processingFollow}
            >
              {processingFollow ? (
                <ActivityIndicator size="small" color={following ? '#516D58' : '#FFFFFF'} />
              ) : (
                <Text 
                  style={{
                    fontWeight: '600',
                    color: following ? '#516D58' : '#FFFFFF',
                  }}
                >
                  {following ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-hika-darkgreen mb-3">Stats</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-hika-darkgreen">{((profile?.totalDistance || 0) / 1000).toFixed(1)} km</Text>
              <Text className="text-gray-600 text-sm">Total Distance</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-hika-darkgreen">{profile?.totalHikes || 0}</Text>
              <Text className="text-gray-600 text-sm">Total Hikes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-hika-darkgreen">{Math.floor((profile?.totalTime || 0) / 3600)}h</Text>
              <Text className="text-gray-600 text-sm">Total Time</Text>
            </View>
          </View>
        </View>

        {/* Rank & Progress */}
        {profile && (
          <View className="bg-gray-50 rounded-lg p-4 mb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Rank & Progress</Text>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                {(() => {
                  const currentRank = (profile.rank || 'Copper') as UserRank;
                  const rankVisuals = getRankVisuals(currentRank);
                  return (
                    <View 
                      style={[styles.rankBadge, { backgroundColor: rankVisuals.bgColor }]}
                      className="flex-row items-center px-3 py-2 rounded-full mr-3"
                    >
                      <Ionicons name={rankVisuals.icon} size={24} color={rankVisuals.color} />
                      <Text className="text-lg font-bold ml-2" style={{ color: rankVisuals.color }}>
                        {currentRank}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text className="text-gray-600 font-medium">{(profile.xp || 0).toLocaleString()} XP</Text>
            </View>
            
            {/* XP Progress Bar */}
            {(() => {
              const progress = getXPProgress(profile.xp || 0, (profile.rank || 'Copper') as UserRank);
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
        )}
        <View className="items-center mb-4">
          {profile.profilePictureUrl ? (
            <Image
              source={{ uri: profile.profilePictureUrl }}
              style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#E5E7EB' }}
              contentFit="cover"
              className="mb-3"
            />
          ) : (
            <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-3">
              <Text className="text-3xl font-bold text-white">
                {profile.displayName?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="text-2xl font-bold text-gray-900">
            {profile.displayName}
          </Text>
          
          {/* Followers & Following Stats (Instagram style) */}
          <View className="flex-row items-center justify-center mt-4 mb-2">
            <TouchableOpacity
              onPress={() => setShowFollowers(true)}
              className="items-center mx-4"
            >
              <Text className="text-xl font-bold text-gray-900">{profile?.followers?.length || 0}</Text>
              <Text className="text-sm text-gray-600 mt-1">Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFollowing(true)}
              className="items-center mx-4"
            >
              <Text className="text-xl font-bold text-gray-900">{profile?.following?.length || 0}</Text>
              <Text className="text-sm text-gray-600 mt-1">Following</Text>
            </TouchableOpacity>
          </View>

          {(profile as any).username ? (
            <Text className="text-gray-500">@{(profile as any).username}</Text>
          ) : null}
          {profile.bio ? (
            <Text className="text-gray-600 mt-2 text-center">
              {profile.bio}
            </Text>
          ) : null}
        </View>

        {isOwn && (
          <View className="mb-4">
            <PostComposer />
          </View>
        )}

        {!isOwn && (
          <View className="items-center mb-4">
            <Button
              title={following ? "Following" : "Follow"}
              onPress={handleFollowToggle}
              loading={processingFollow}
              variant={following ? "outline" : "primary"}
            />
          </View>
        )}

        {/* Favorites */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setShowFavorites(!showFavorites)}
            className="bg-gray-50 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="heart" size={20} color="#EF4444" />
              <Text className="text-gray-900 font-semibold ml-2">Favorites ({profile?.favorites?.length || 0})</Text>
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
                <View className="p-4 bg-white">
                  <Text className="text-gray-500 text-center">No favorite trails yet.</Text>
                </View>
              ) : (
                favoriteTrails.map((trail) => (
                  <TouchableOpacity
                    key={trail.id}
                    onPress={() => router.push(`/trail/${trail.id}` as any)}
                    className="px-4 py-3 border-b border-gray-100 last:border-b-0 bg-white"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-gray-900 font-medium">{trail.name}</Text>
                        {trail.location && (
                          <View className="flex-row items-center mt-1">
                            <Ionicons name="location" size={12} color="#6B7280" />
                            <Text className="text-gray-600 text-xs ml-1">{trail.location}</Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
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
              <Text className="text-gray-900 font-semibold ml-2">Wishlist ({profile?.wishlist?.length || 0})</Text>
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
                <View className="p-4 bg-white">
                  <Text className="text-gray-500 text-center">No trails in wishlist yet.</Text>
                </View>
              ) : (
                wishlistTrails.map((trail) => (
                  <TouchableOpacity
                    key={trail.id}
                    onPress={() => router.push(`/trail/${trail.id}` as any)}
                    className="px-4 py-3 border-b border-gray-100 last:border-b-0 bg-white"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-gray-900 font-medium">{trail.name}</Text>
                        {trail.location && (
                          <View className="flex-row items-center mt-1">
                            <Ionicons name="location" size={12} color="#6B7280" />
                            <Text className="text-gray-600 text-xs ml-1">{trail.location}</Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
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
              <Text className="text-gray-900 font-semibold ml-2">Completed Trails ({profile?.completed?.length || 0})</Text>
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
                <View className="p-4 bg-white">
                  <Text className="text-gray-500 text-center">No completed trails yet.</Text>
                </View>
              ) : (
                completedTrails.map((trail) => (
                  <TouchableOpacity
                    key={trail.id}
                    onPress={() => router.push(`/trail/${trail.id}` as any)}
                    className="px-4 py-3 border-b border-gray-100 last:border-b-0 bg-white"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-gray-900 font-medium">{trail.name}</Text>
                        {trail.location && (
                          <View className="flex-row items-center mt-1">
                            <Ionicons name="location" size={12} color="#6B7280" />
                            <Text className="text-gray-600 text-xs ml-1">{trail.location}</Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* Followers Modal */}
        <Modal
          visible={showFollowers}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFollowers(false)}
          statusBarTranslucent={Platform.OS !== 'web'}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={() => setShowFollowers(false)}
            />
            <View style={styles.modalContentWrapper}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderText}>Followers</Text>
                  <TouchableOpacity onPress={() => setShowFollowers(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={24} color="#1F2937" />
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingFollowers ? (
                    <View className="py-8 items-center">
                      <ActivityIndicator size="small" color="#10b981" />
                    </View>
                  ) : followersList.length === 0 ? (
                    <View className="p-4">
                      <Text className="text-gray-500 text-center">No followers yet.</Text>
                    </View>
                  ) : (
                    followersList.map((follower) => (
                      <TouchableOpacity
                        key={follower.uid}
                        onPress={() => {
                          setShowFollowers(false);
                          router.push(`/profile/${follower.uid}` as any);
                        }}
                        className="px-4 py-3 border-b border-gray-100 flex-row items-center"
                      >
                        {follower.profilePictureUrl ? (
                          <Image
                            source={{ uri: follower.profilePictureUrl }}
                            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' }}
                            contentFit="cover"
                            className="mr-3"
                          />
                        ) : (
                          <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center mr-3">
                            <Text className="text-white font-bold text-sm">
                              {follower.displayName?.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-gray-900 font-medium">{follower.displayName}</Text>
                          {follower.bio && (
                            <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>
                              {follower.bio}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
              <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom} />
            </View>
          </View>
        </Modal>

        {/* Following Modal */}
        <Modal
          visible={showFollowing}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFollowing(false)}
          statusBarTranslucent={Platform.OS !== 'web'}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={() => setShowFollowing(false)}
            />
            <View style={styles.modalContentWrapper}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderText}>Following</Text>
                  <TouchableOpacity onPress={() => setShowFollowing(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={24} color="#1F2937" />
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingFollowing ? (
                    <View className="py-8 items-center">
                      <ActivityIndicator size="small" color="#10b981" />
                    </View>
                  ) : followingList.length === 0 ? (
                    <View className="p-4">
                      <Text className="text-gray-500 text-center">Not following anyone yet.</Text>
                    </View>
                  ) : (
                    followingList.map((followedUser) => (
                      <TouchableOpacity
                        key={followedUser.uid}
                        onPress={() => {
                          setShowFollowing(false);
                          router.push(`/profile/${followedUser.uid}` as any);
                        }}
                        className="px-4 py-3 border-b border-gray-100 flex-row items-center"
                      >
                        {followedUser.profilePictureUrl ? (
                          <Image
                            source={{ uri: followedUser.profilePictureUrl }}
                            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' }}
                            contentFit="cover"
                            className="mr-3"
                          />
                        ) : (
                          <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center mr-3">
                            <Text className="text-white font-bold text-sm">
                              {followedUser.displayName?.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-gray-900 font-medium">{followedUser.displayName}</Text>
                          {followedUser.bio && (
                            <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>
                              {followedUser.bio}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
              <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom} />
            </View>
          </View>
        </Modal>

        {/* Posts */}
        <View className="mb-4">
          <Text className="text-lg font-semibold text-white mb-2">
            Posts
          </Text>
          {loadingPosts ? (
            <Text className="text-gray-500">Loading posts...</Text>
          ) : posts.length === 0 ? (
            <Text className="text-gray-500">No posts yet.</Text>
          ) : (
            posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))
          )}
        </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContentWrapper: {
    width: '100%',
    maxHeight: Platform.OS === 'web' ? '90%' : '85%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalScrollView: {
    maxHeight: Platform.OS === 'web' ? 600 : 500,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  safeAreaBottom: {
    backgroundColor: '#FFFFFF',
  },
});

export default RemoteProfile;
