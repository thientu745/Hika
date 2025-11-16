import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { PostCard } from "../../components/ui/PostCard";
import { FollowingList } from "../../components/ui/FollowingList";
import { FollowersList } from "../../components/ui/FollowersList";
import {
  getUserPosts,
  getTrail,
  getUserProfiles,
  removeTrailFromList,
  updateUserProfile,
} from "../../services/database";
import { pickImage, uploadProfilePicture } from "../../services/storage";
import { getRankBorderStyle } from "../../utils/rankStyles";
import type { Post, Trail, UserRank, UserProfile } from "../../types";

// Rank thresholds
const RANK_THRESHOLDS: Record<
  UserRank,
  { min: number; max: number; next?: UserRank }
> = {
  Copper: { min: 0, max: 999, next: "Bronze" },
  Bronze: { min: 1000, max: 4999, next: "Silver" },
  Silver: { min: 5000, max: 14999, next: "Gold" },
  Gold: { min: 15000, max: 49999, next: "Platinum" },
  Platinum: { min: 50000, max: 149999, next: "Diamond" },
  Diamond: { min: 150000, max: Infinity },
};

// Rank visual indicators
const getRankVisuals = (rank: UserRank) => {
  const visuals: Record<
    UserRank,
    {
      icon: keyof typeof Ionicons.glyphMap;
      color: string;
      bgColor: string;
      emoji: string;
    }
  > = {
    Copper: {
      icon: "trophy",
      color: "#B87333",
      bgColor: "#F5E6D3",
      emoji: "🥉",
    },
    Bronze: {
      icon: "trophy",
      color: "#CD7F32",
      bgColor: "#F5E6D3",
      emoji: "🥉",
    },
    Silver: {
      icon: "trophy",
      color: "#C0C0C0",
      bgColor: "#F0F0F0",
      emoji: "🥈",
    },
    Gold: { icon: "trophy", color: "#FFD700", bgColor: "#FFF9E6", emoji: "🥇" },
    Platinum: {
      icon: "star",
      color: "#E5E4E2",
      bgColor: "#F5F5F5",
      emoji: "💎",
    },
    Diamond: {
      icon: "star",
      color: "#B9F2FF",
      bgColor: "#E6F7FF",
      emoji: "💠",
    },
  };
  return visuals[rank];
};

// Helper function to calculate XP progress
const getXPProgress = (currentXP: number, currentRank: UserRank) => {
  const rankInfo = RANK_THRESHOLDS[currentRank];
  const xpInCurrentRank = currentXP - rankInfo.min;
  const xpNeededForCurrentRank = rankInfo.max - rankInfo.min + 1;
  const progressPercent = Math.min(
    100,
    (xpInCurrentRank / xpNeededForCurrentRank) * 100
  );

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

const Profile = () => {
  const { user, userProfile, signOut, loading, refreshUserProfile } = useAuth();
  const router = useRouter();
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Toggle states for dropdowns
  const [showFavorites, setShowFavorites] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPosts, setShowPosts] = useState(false);
  
  // Trail lists
  const [favoriteTrails, setFavoriteTrails] = useState<Trail[]>([]);
  const [wishlistTrails, setWishlistTrails] = useState<Trail[]>([]);
  const [completedTrails, setCompletedTrails] = useState<Trail[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingTrail, setRemovingTrail] = useState<string | null>(null);
  
  // Social list modals (using new components)
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/welcome");
  };

  // Use fallback values if profile is still loading (needed for useEffect dependencies)
  const favorites = userProfile?.favorites || [];
  const completed = userProfile?.completed || [];
  const wishlist = userProfile?.wishlist || [];
  const followers = userProfile?.followers || [];
  const following = userProfile?.following || [];

  // Load user posts (must be before early returns)
  useEffect(() => {
    if (!user?.uid) return;

    const loadPosts = async () => {
      setLoadingPosts(true);
      try {
        const posts = await getUserPosts(user.uid, 100);
        setUserPosts(posts);
      } catch (err) {
        console.error("Error loading posts:", err);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadPosts();
  }, [user?.uid]);

  // Load favorite trails when section is expanded (must be before early returns)
  useEffect(() => {
    if (!showFavorites || favorites.length === 0) {
      setFavoriteTrails([]);
      return;
    }

    const loadFavoriteTrails = async () => {
      setLoadingFavorites(true);
      try {
        const trails: Trail[] = [];
        for (const trailId of favorites) {
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
        console.error("Error loading favorite trails:", err);
      } finally {
        setLoadingFavorites(false);
      }
    };

    loadFavoriteTrails();
  }, [showFavorites, favorites]);

  // Load wishlist trails when section is expanded (must be before early returns)
  useEffect(() => {
    if (!showWishlist || wishlist.length === 0) {
      setWishlistTrails([]);
      return;
    }

    const loadWishlistTrails = async () => {
      setLoadingWishlist(true);
      try {
        const trails: Trail[] = [];
        for (const trailId of wishlist) {
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
        console.error("Error loading wishlist trails:", err);
      } finally {
        setLoadingWishlist(false);
      }
    };

    loadWishlistTrails();
  }, [showWishlist, wishlist]);

  // Load completed trails when section is expanded (must be before early returns)
  useEffect(() => {
    if (!showCompleted || completed.length === 0) {
      setCompletedTrails([]);
      return;
    }

    const loadCompletedTrails = async () => {
      setLoadingCompleted(true);
      try {
        const trails: Trail[] = [];
        for (const trailId of completed) {
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
        console.error("Error loading completed trails:", err);
      } finally {
        setLoadingCompleted(false);
      }
    };

    loadCompletedTrails();
  }, [showCompleted, completed]);

  const handleImageUpload = async () => {
    console.log("=== IMAGE UPLOAD STARTED ===");
    if (!user) {
      console.log("No user found, aborting");
      return;
    }

    try {
      setUploading(true);
      console.log("Uploading state set to true");

      // Pick image from device
      console.log("Opening image picker...");
      const imageUri = await pickImage();
      if (!imageUri) {
        setUploading(false);
        return;
      }

      console.log("Picked image URI:", imageUri);
      console.log("Uploading profile picture for user:", user.uid);

      // Upload to Firebase Storage
      const downloadURL = await uploadProfilePicture(user.uid, imageUri);
      console.log("Uploaded to Storage, got URL:", downloadURL);

      // Update user profile with new image URL
      await updateUserProfile(user.uid, {
        profilePictureUrl: downloadURL,
      });
      console.log("Updated Firestore profile with new image URL");

      // Manually refresh the profile to ensure UI updates immediately
      await refreshUserProfile();
      console.log("Refreshed user profile");

      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error: any) {
      console.error("❌ ERROR IN PROFILE PICTURE UPLOAD");
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);
      console.error("Full error:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to upload profile picture. Please try again.";

      if (
        error?.code === "storage/unauthorized" ||
        error?.message?.includes("denied") ||
        error?.message?.includes("Permission")
      ) {
        errorMessage =
          "Upload denied: Check Storage security rules in Firebase Console. Make sure rules are published.";
        console.error(
          "🔴 STORAGE PERMISSION DENIED - Check Firebase Console → Storage → Rules"
        );
      } else if (error?.code === "storage/canceled") {
        errorMessage = "Upload was canceled.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert("Upload Failed", errorMessage);
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
  const displayName = userProfile?.displayName || user?.displayName || "User";
  const bio = userProfile?.bio || "";
  const profilePictureUrl = userProfile?.profilePictureUrl;
  const totalDistance = userProfile?.totalDistance || 0;
  const totalHikes = userProfile?.totalHikes || 0;
  const totalTime = userProfile?.totalTime || 0;
  const rank = userProfile?.rank || "Copper";
  const xp = userProfile?.xp || 0;

  const handleRemoveFromList = async (
    trailId: string,
    listType: "favorites" | "wishlist" | "completed"
  ) => {
    if (!user?.uid) {
      Alert.alert("Error", "You must be logged in to manage your lists");
      return;
    }

    const listNames = {
      favorites: "favorites",
      wishlist: "wishlist",
      completed: "completed trails",
    };

    try {
      setRemovingTrail(trailId);

      // Optimistically update the UI by removing from local state immediately
      if (listType === "favorites") {
        setFavoriteTrails((prev) => prev.filter((t) => t.id !== trailId));
      } else if (listType === "wishlist") {
        setWishlistTrails((prev) => prev.filter((t) => t.id !== trailId));
      } else if (listType === "completed") {
        setCompletedTrails((prev) => prev.filter((t) => t.id !== trailId));
      }

      // Remove from database
      await removeTrailFromList(user.uid, trailId, listType);

      // Refresh profile to sync with database
      await refreshUserProfile();
    } catch (error) {
      console.error(`Error removing trail from ${listType}:`, error);
      Alert.alert(
        "Error",
        `Failed to remove trail from ${listNames[listType]}. Please try again.`
      );

      // Reload the list on error to restore the correct state
      if (listType === "favorites" && showFavorites) {
        const trails: Trail[] = [];
        for (const id of favorites) {
          try {
            const trail = await getTrail(id);
            if (trail) trails.push(trail);
          } catch (err) {
            console.warn(`Failed to load favorite trail ${id}:`, err);
          }
        }
        setFavoriteTrails(trails);
      } else if (listType === "wishlist" && showWishlist) {
        const trails: Trail[] = [];
        for (const id of wishlist) {
          try {
            const trail = await getTrail(id);
            if (trail) trails.push(trail);
          } catch (err) {
            console.warn(`Failed to load wishlist trail ${id}:`, err);
          }
        }
        setWishlistTrails(trails);
      } else if (listType === "completed" && showCompleted) {
        const trails: Trail[] = [];
        for (const id of completed) {
          try {
            const trail = await getTrail(id);
            if (trail) trails.push(trail);
          } catch (err) {
            console.warn(`Failed to load completed trail ${id}:`, err);
          }
        }
        setCompletedTrails(trails);
      }
    } finally {
      setRemovingTrail(null);
    }
  };

  return (
    <ScrollView className="flex-1 bg-hika-darkgreen">
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
              <View>
                <Image
                  source={{ uri: profilePictureUrl }}
                  style={[
                    {
                      width: 96,
                      height: 96,
                      borderRadius: 48,
                    },
                    getRankBorderStyle((userProfile?.rank || 'Copper') as UserRank),
                  ]}
                  contentFit="cover"
                  key={profilePictureUrl}
                  cachePolicy="memory-disk"
                />
              </View>
            ) : (
              <View
                style={[
                  {
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  getRankBorderStyle((userProfile?.rank || 'Copper') as UserRank),
                ]}
              >
                <Text className="text-3xl font-bold text-hika-darkgreen">
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Upload overlay button */}
            <View className="absolute bottom-0 right-0 w-8 h-8 bg-hika-darkgreen rounded-full items-center justify-center border-2 border-white">
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-bold">+</Text>
              )}
            </View>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-white">{displayName}</Text>
          
          {/* Followers & Following Stats (Instagram style) */}
          <View className="flex-row items-center justify-center mt-4 mb-2">
            <TouchableOpacity
              onPress={() => setShowFollowersList(true)}
              className="items-center mx-6"
            >
              <Text className="text-xl font-bold text-white">{followers.length}</Text>
              <Text className="text-sm text-gray-300 mt-1">Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFollowingList(true)}
              className="items-center mx-6"
            >
              <Text className="text-xl font-bold text-white">{following.length}</Text>
              <Text className="text-sm text-gray-300 mt-1">Following</Text>
            </TouchableOpacity>
          </View>
          {!userProfile && (
            <Text className="text-gray-500 text-sm mt-2">
              Loading profile data...
            </Text>
          )}
          {bio && <Text className="text-gray-300 mt-2 text-center">{bio}</Text>}
        </View>

        {/* Stats */}
        <View className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-hika-darkgreen mb-3">Stats</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-hika-darkgreen">
                {(totalDistance / 1000).toFixed(1)} km
              </Text>
              <Text className="text-gray-600 text-sm">Total Distance</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-hika-darkgreen">{totalHikes}</Text>
              <Text className="text-gray-600 text-sm">Total Hikes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-hika-darkgreen">
                {Math.floor(totalTime / 3600)}h
              </Text>
              <Text className="text-gray-600 text-sm">Total Time</Text>
            </View>
          </View>
        </View>

        {/* Game Features */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-3">Rank & Progress</Text>
          <View className="bg-gray-50 rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                {(() => {
                  const rankVisuals = getRankVisuals(rank as UserRank);
                  return (
                    <View
                      style={[
                        styles.rankBadge,
                        { backgroundColor: rankVisuals.bgColor },
                      ]}
                      className="flex-row items-center px-3 py-2 rounded-full mr-3"
                    >
                      <Ionicons
                        name={rankVisuals.icon}
                        size={24}
                        color={rankVisuals.color}
                      />
                      <Text
                        className="text-lg font-bold ml-2"
                        style={{ color: rankVisuals.color }}
                      >
                        {rank}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text className="text-gray-600 font-medium">
                {xp.toLocaleString()} XP
              </Text>
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
                        { width: `${progress.progressPercent}%` },
                      ]}
                    />
                  </View>
                  <View className="flex-row justify-between mt-2">
                    <Text className="text-xs text-gray-500">
                      {progress.rankMin.toLocaleString()} XP
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {progress.rankMax === Infinity
                        ? "∞"
                        : progress.rankMax.toLocaleString()}{" "}
                      XP
                    </Text>
                  </View>
                  {progress.nextRank &&
                    progress.xpNeededForNextRank !== null && (
                      <View className="mt-3 pt-3 border-t border-gray-200">
                        <View className="flex-row items-center mb-1">
                          <Text className="text-sm text-gray-700 mr-2">
                            Next Rank:
                          </Text>
                          {(() => {
                            const nextRankVisuals = getRankVisuals(
                              progress.nextRank!
                            );
                            return (
                              <View className="flex-row items-center">
                                <Ionicons
                                  name={nextRankVisuals.icon}
                                  size={16}
                                  color={nextRankVisuals.color}
                                />
                                <Text
                                  className="text-sm font-semibold ml-1"
                                  style={{ color: nextRankVisuals.color }}
                                >
                                  {progress.nextRank}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        <Text className="text-sm text-green-600 font-medium">
                          {progress.xpNeededForNextRank.toLocaleString()} XP
                          needed
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
              <Ionicons name="heart" size={20} color="#DB1630" />
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
                  <Text className="text-gray-500 text-center">
                    No favorite trails yet.
                  </Text>
                </View>
              ) : (
                favoriteTrails.map((trail) => (
                  <View
                    key={trail.id}
                    className="px-4 py-3 border-b border-gray-100 last:border-b-0 flex-row items-center"
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/trail/${trail.id}` as any)}
                      className="flex-1"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-gray-900 font-medium">
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <View className="flex-row items-center mt-1">
                              <Ionicons
                                name="location"
                                size={12}
                                color="#6B7280"
                              />
                              <Text className="text-gray-600 text-xs ml-1">
                                {trail.location}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchableOpacity>
                    <View className="ml-3">
                      <TouchableOpacity
                        onPress={() => {
                          handleRemoveFromList(trail.id, "favorites");
                        }}
                        disabled={removingTrail === trail.id}
                        className="p-2"
                        activeOpacity={0.7}
                        hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
                      >
                        {removingTrail === trail.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Ionicons
                            name="close-circle"
                            size={24}
                            color="#EF4444"
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
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
              <Text className="text-gray-900 font-semibold ml-2">
                Wishlist ({wishlist.length})
              </Text>
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
                  <Text className="text-gray-500 text-center">
                    No trails in wishlist yet.
                  </Text>
                </View>
              ) : (
                wishlistTrails.map((trail) => (
                  <View
                    key={trail.id}
                    className="px-4 py-3 border-b border-gray-100 last:border-b-0 flex-row items-center"
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/trail/${trail.id}` as any)}
                      className="flex-1"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-gray-900 font-medium">
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <View className="flex-row items-center mt-1">
                              <Ionicons
                                name="location"
                                size={12}
                                color="#6B7280"
                              />
                              <Text className="text-gray-600 text-xs ml-1">
                                {trail.location}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchableOpacity>
                    <View className="ml-3">
                      <TouchableOpacity
                        onPress={() => {
                          handleRemoveFromList(trail.id, "wishlist");
                        }}
                        disabled={removingTrail === trail.id}
                        className="p-2"
                        activeOpacity={0.7}
                        hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
                      >
                        {removingTrail === trail.id ? (
                          <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                          <Ionicons
                            name="close-circle"
                            size={24}
                            color="#3B82F6"
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
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
              <Text className="text-gray-900 font-semibold ml-2">
                Completed Trails ({completed.length})
              </Text>
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
                  <Text className="text-gray-500 text-center">
                    No completed trails yet.
                  </Text>
                </View>
              ) : (
                completedTrails.map((trail) => (
                  <View
                    key={trail.id}
                    className="px-4 py-3 border-b border-gray-100 last:border-b-0 flex-row items-center"
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/trail/${trail.id}` as any)}
                      className="flex-1"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-gray-900 font-medium">
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <View className="flex-row items-center mt-1">
                              <Ionicons
                                name="location"
                                size={12}
                                color="#6B7280"
                              />
                              <Text className="text-gray-600 text-xs ml-1">
                                {trail.location}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchableOpacity>
                    <View className="ml-3">
                      <TouchableOpacity
                        onPress={() => {
                          handleRemoveFromList(trail.id, "completed");
                        }}
                        disabled={removingTrail === trail.id}
                        className="p-2"
                        activeOpacity={0.7}
                        hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}
                      >
                        {removingTrail === trail.id ? (
                          <ActivityIndicator size="small" color="#10b981" />
                        ) : (
                          <Ionicons
                            name="close-circle"
                            size={24}
                            color="#10b981"
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>


        {/* Posts */}
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setShowPosts(!showPosts)}
            className="bg-gray-50 rounded-lg p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Ionicons name="document-text" size={20} color="#10b981" />
              <Text className="text-gray-900 font-semibold ml-2">
                My Posts ({userPosts.length})
              </Text>
            </View>
            <Ionicons
              name={showPosts ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showPosts && (
            <View className="mt-2">
              {loadingPosts ? (
                <View className="py-8 items-center bg-gray-50 rounded-lg">
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text className="text-gray-500 text-sm mt-2">
                    Loading posts...
                  </Text>
                </View>
              ) : userPosts.length === 0 ? (
                <View className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <Text className="text-gray-500 text-center">
                    No posts yet. Create your first post!
                  </Text>
                </View>
              ) : (
                <View>
                  {userPosts
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((post) => (
                      <PostCard 
                        key={post.id} 
                        post={post} 
                        onUpdate={(updatedPost) => {
                          // Handle post deletion
                          if (updatedPost && updatedPost.id === 'DELETED') {
                            setUserPosts(prev => prev.filter(p => p.id !== post.id));
                          } else if (updatedPost) {
                            setUserPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
                          }
                        }}
                      />
                    ))}
                </View>
              )}
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

        {/* Following List Modal */}
        {user?.uid && (
          <FollowingList
            visible={showFollowingList}
            userId={user.uid}
            onClose={() => setShowFollowingList(false)}
          />
        )}

        {/* Followers List Modal */}
        {user?.uid && (
          <FollowersList
            visible={showFollowersList}
            userId={user.uid}
            onClose={() => setShowFollowersList(false)}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  progressBarContainer: {
    height: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
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

export default Profile;
