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
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#516D58' }}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {/* Profile Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
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
            <View style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              backgroundColor: '#516D58',
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#FFFFFF',
            }}>
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>+</Text>
              )}
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 12 }}>
            {displayName}
          </Text>
          
          {/* Followers & Following Stats (Instagram style) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setShowFollowersList(true)}
              style={{ alignItems: 'center', marginHorizontal: 24 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
                {followers.length}
              </Text>
              <Text style={{ fontSize: 13, color: '#E5E7EB', marginTop: 4 }}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFollowingList(true)}
              style={{ alignItems: 'center', marginHorizontal: 24 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
                {following.length}
              </Text>
              <Text style={{ fontSize: 13, color: '#E5E7EB', marginTop: 4 }}>Following</Text>
            </TouchableOpacity>
          </View>
          {!userProfile && (
            <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 8 }}>
              Loading profile data...
            </Text>
          )}
          {bio && (
            <Text style={{ color: '#E5E7EB', marginTop: 8, textAlign: 'center', fontSize: 14 }}>
              {bio}
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 2,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>
            Stats
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#516D58' }}>
                {(totalDistance / 1000).toFixed(1)} km
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Total Distance</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#516D58' }}>
                {totalHikes}
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Total Hikes</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#516D58' }}>
                {Math.floor(totalTime / 3600)}h
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Total Time</Text>
            </View>
          </View>
        </View>

        {/* Game Features */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 }}>
            Rank & Progress
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {(() => {
                  const rankVisuals = getRankVisuals(rank as UserRank);
                  return (
                    <View
                      style={[
                        styles.rankBadge,
                        { backgroundColor: rankVisuals.bgColor },
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 12,
                        },
                      ]}
                    >
                      <Ionicons
                        name={rankVisuals.icon}
                        size={24}
                        color={rankVisuals.color}
                      />
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          marginLeft: 8,
                          color: rankVisuals.color,
                        }}
                      >
                        {rank}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {progress.rankMin.toLocaleString()} XP
                    </Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {progress.rankMax === Infinity
                        ? "∞"
                        : progress.rankMax.toLocaleString()}{" "}
                      XP
                    </Text>
                  </View>
                  {progress.nextRank &&
                    progress.xpNeededForNextRank !== null && (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, color: '#374151', marginRight: 8 }}>
                            Next Rank:
                          </Text>
                          {(() => {
                            const nextRankVisuals = getRankVisuals(
                              progress.nextRank!
                            );
                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons
                                  name={nextRankVisuals.icon}
                                  size={16}
                                  color={nextRankVisuals.color}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    marginLeft: 4,
                                    color: nextRankVisuals.color,
                                  }}
                                >
                                  {progress.nextRank}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        <Text style={{ fontSize: 13, color: '#516D58', fontWeight: '600' }}>
                          {progress.xpNeededForNextRank.toLocaleString()} XP needed
                        </Text>
                      </View>
                    )}
                  {!progress.nextRank && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                      <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>
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
        <View style={{ marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => setShowFavorites(!showFavorites)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="heart" size={20} color="#DB1630" />
              <Text style={{ color: '#111827', fontWeight: '600', marginLeft: 8, fontSize: 16 }}>
                Favorites ({favorites.length})
              </Text>
            </View>
            <Ionicons
              name={showFavorites ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showFavorites && (
            <View style={{
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}>
              {loadingFavorites ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#516D58" />
                </View>
              ) : favoriteTrails.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No favorite trails yet.
                  </Text>
                </View>
              ) : (
                favoriteTrails.map((trail, index) => (
                  <View
                    key={trail.id}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: index < favoriteTrails.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/trail/${trail.id}` as any)}
                      style={{ flex: 1 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <Ionicons
                                name="location"
                                size={12}
                                color="#6B7280"
                              />
                              <Text style={{ color: '#6B7280', fontSize: 12, marginLeft: 4 }}>
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
                    <View style={{ marginLeft: 12 }}>
                      <TouchableOpacity
                        onPress={() => {
                          handleRemoveFromList(trail.id, "favorites");
                        }}
                        disabled={removingTrail === trail.id}
                        style={{ padding: 8 }}
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
        <View style={{ marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => setShowWishlist(!showWishlist)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="bookmark" size={20} color="#3B82F6" />
              <Text style={{ color: '#111827', fontWeight: '600', marginLeft: 8, fontSize: 16 }}>
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
            <View style={{
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}>
              {loadingWishlist ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#516D58" />
                </View>
              ) : wishlistTrails.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No trails in wishlist yet.
                  </Text>
                </View>
              ) : (
                wishlistTrails.map((trail, index) => (
                  <View
                    key={trail.id}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: index < wishlistTrails.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/trail/${trail.id}` as any)}
                      style={{ flex: 1 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <Ionicons
                                name="location"
                                size={12}
                                color="#6B7280"
                              />
                              <Text style={{ color: '#6B7280', fontSize: 12, marginLeft: 4 }}>
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
                    <View style={{ marginLeft: 12 }}>
                      <TouchableOpacity
                        onPress={() => {
                          handleRemoveFromList(trail.id, "wishlist");
                        }}
                        disabled={removingTrail === trail.id}
                        style={{ padding: 8 }}
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
        <View style={{ marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => setShowCompleted(!showCompleted)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={{ color: '#111827', fontWeight: '600', marginLeft: 8, fontSize: 16 }}>
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
            <View style={{
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}>
              {loadingCompleted ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#516D58" />
                </View>
              ) : completedTrails.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No completed trails yet.
                  </Text>
                </View>
              ) : (
                completedTrails.map((trail, index) => (
                  <View
                    key={trail.id}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: index < completedTrails.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/trail/${trail.id}` as any)}
                      style={{ flex: 1 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <Ionicons
                                name="location"
                                size={12}
                                color="#6B7280"
                              />
                              <Text style={{ color: '#6B7280', fontSize: 12, marginLeft: 4 }}>
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
                    <View style={{ marginLeft: 12 }}>
                      <TouchableOpacity
                        onPress={() => {
                          handleRemoveFromList(trail.id, "completed");
                        }}
                        disabled={removingTrail === trail.id}
                        style={{ padding: 8 }}
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
        <View style={{ marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => setShowPosts(!showPosts)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="document-text" size={20} color="#10b981" />
              <Text style={{ color: '#111827', fontWeight: '600', marginLeft: 8, fontSize: 16 }}>
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
            <View style={{ marginTop: 12 }}>
              {loadingPosts ? (
                <View style={{
                  paddingVertical: 32,
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}>
                  <ActivityIndicator size="small" color="#516D58" />
                  <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>
                    Loading posts...
                  </Text>
                </View>
              ) : userPosts.length === 0 ? (
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No posts yet. Create your first post!
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {userPosts
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((post) => (
                      <View key={post.id}>
                        <PostCard 
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
                      </View>
                    ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={{
            backgroundColor: '#EF4444',
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 8,
            marginBottom: 24,
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
            Sign Out
          </Text>
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
