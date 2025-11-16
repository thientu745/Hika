import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { followUser, unfollowUser, getTrail } from "../../services/database";
import { db } from "../../firebaseConfig";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { PostCard } from "../../components/ui/PostCard";
import { FollowingList } from "../../components/ui/FollowingList";
import { FollowersList } from "../../components/ui/FollowersList";
import { Image } from "expo-image";
import { getRankBorderStyle } from "../../utils/rankStyles";
import type { Post, UserProfile, Trail, UserRank } from "../../types";

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
  const [showPosts, setShowPosts] = useState(false);

  // Trail lists
  const [favoriteTrails, setFavoriteTrails] = useState<Trail[]>([]);
  const [wishlistTrails, setWishlistTrails] = useState<Trail[]>([]);
  const [completedTrails, setCompletedTrails] = useState<Trail[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);

  // Social list modals (using new components)
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);

  useEffect(() => {
    if (!uid) return;

    setLoadingProfile(true);
    const profileRef = doc(db, "users", uid as string);
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
        console.warn("Profile listener error", err);
        setLoadingProfile(false);
      }
    );

    // Posts listener
    setLoadingPosts(true);
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("userId", "==", uid as string),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubPosts = onSnapshot(
      q,
      (snap) => {
        const ps: Post[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const post: Post = {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            comments: (data.comments || []).map((c: any) => ({
              ...c,
              createdAt: c.createdAt?.toDate?.() || new Date(),
            })),
          } as Post;
          
          // Convert path timestamps from Firestore Timestamps to Date objects
          if (post.path && Array.isArray(post.path)) {
            post.path = post.path.map((point: any) => ({
              ...point,
              timestamp: point.timestamp?.toDate ? point.timestamp.toDate() : (point.timestamp instanceof Date ? point.timestamp : new Date(point.timestamp || Date.now())),
            }));
          }
          
          ps.push(post);
        });
        setPosts(ps);
        setLoadingPosts(false);
      },
      (err) => {
        console.warn("Posts listener error", err);
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
        console.error("Error loading favorite trails:", err);
      } finally {
        setLoadingFavorites(false);
      }
    };

    loadFavoriteTrails();
  }, [showFavorites, profile]);

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
        console.error("Error loading wishlist trails:", err);
      } finally {
        setLoadingWishlist(false);
      }
    };

    loadWishlistTrails();
  }, [showWishlist, profile]);

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
        console.error("Error loading completed trails:", err);
      } finally {
        setLoadingCompleted(false);
      }
    };

    loadCompletedTrails();
  }, [showCompleted, profile]);
  const isOwn = user?.uid === uid;

  // Local following state for optimistic UI updates
  useEffect(() => {
    setFollowing(!!userProfile?.following?.includes(uid as string));
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
            ? {
                ...prevP,
                followers: (prevP.followers || []).filter(
                  (id) => id !== user.uid
                ),
              }
            : prevP
        );
      } else {
        // previously not following -> follow
        await followUser(user.uid, profile.uid);

        // update remote profile locally: add current user to followers
        setProfile((prevP) =>
          prevP
            ? {
                ...prevP,
                followers: Array.from(
                  new Set([...(prevP.followers || []), user.uid])
                ),
              }
            : prevP
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
      console.warn("Follow action failed", e);
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
      <View style={{ flex: 1, backgroundColor: '#516D58', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Ionicons name="person-outline" size={64} color="#9CA3AF" />
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginTop: 16, textAlign: 'center' }}>
          Profile not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#516D58' }}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {/* Back Button */}
        <TouchableOpacity
          style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', marginLeft: 8, fontWeight: '600', fontSize: 16 }}>Back</Text>
        </TouchableOpacity>

        {/* Profile Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {profile.profilePictureUrl ? (
            <View>
              <Image
                source={{ uri: profile.profilePictureUrl }}
                style={[
                  {
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                  },
                  getRankBorderStyle((profile.rank || "Copper") as UserRank),
                ]}
                contentFit="cover"
              />
            </View>
          ) : (
            <View
              style={[
                {
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: "white",
                  alignItems: "center",
                  justifyContent: "center",
                },
                getRankBorderStyle((profile.rank || "Copper") as UserRank),
              ]}
            >
              <Text className="text-3xl font-bold text-hika-green">
                {profile.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 12 }}>
            {profile.displayName}
          </Text>

          {/* Followers & Following Stats (Instagram style) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setShowFollowersList(true)}
              style={{ alignItems: 'center', marginHorizontal: 24 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
                {profile?.followers?.length || 0}
              </Text>
              <Text style={{ fontSize: 13, color: '#E5E7EB', marginTop: 4 }}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFollowingList(true)}
              style={{ alignItems: 'center', marginHorizontal: 24 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
                {profile?.following?.length || 0}
              </Text>
              <Text style={{ fontSize: 13, color: '#E5E7EB', marginTop: 4 }}>Following</Text>
            </TouchableOpacity>
          </View>

          {profile.bio && (
            <Text style={{ color: '#E5E7EB', marginTop: 8, textAlign: 'center', fontSize: 14 }}>
              {profile.bio}
            </Text>
          )}

          {/* Follow Button */}
          {user && uid !== user.uid && (
            <TouchableOpacity
              style={{
                marginTop: 16,
                paddingVertical: 12,
                paddingHorizontal: 32,
                borderRadius: 12,
                backgroundColor: following ? '#FFFFFF' : '#92C59F',
                borderWidth: following ? 1 : 0,
                borderColor: '#E5E7EB',
                shadowColor: following ? '#000' : '#92C59F',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: following ? 0.1 : 0.3,
                shadowRadius: 4,
                elevation: following ? 2 : 4,
              }}
              onPress={handleFollowToggle}
              disabled={processingFollow}
              activeOpacity={0.8}
            >
              {processingFollow ? (
                <ActivityIndicator
                  size="small"
                  color={following ? "#516D58" : "#FFFFFF"}
                />
              ) : (
                <Text
                  style={{
                    fontWeight: '700',
                    fontSize: 16,
                    color: following ? "#516D58" : "#FFFFFF",
                  }}
                >
                  {following ? "Following" : "Follow"}
                </Text>
              )}
            </TouchableOpacity>
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
                {((profile?.totalDistance || 0) / 1000).toFixed(1)} km
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Total Distance</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#516D58' }}>
                {profile?.totalHikes || 0}
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Total Hikes</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#516D58' }}>
                {Math.floor((profile?.totalTime || 0) / 3600)}h
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Total Time</Text>
            </View>
          </View>
        </View>

        {/* Rank & Progress */}
        {profile && (
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
                    const currentRank = (profile.rank || "Copper") as UserRank;
                    const rankVisuals = getRankVisuals(currentRank);
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
                          {currentRank}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>
                  {(profile.xp || 0).toLocaleString()} XP
                </Text>
              </View>

              {/* XP Progress Bar */}
              {(() => {
                const progress = getXPProgress(
                  profile.xp || 0,
                  (profile.rank || "Copper") as UserRank
                );
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
        )}

        {/* Favorites */}
        <View style={{ marginBottom: 16 }}>
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
              shadowRadius: 12,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="heart" size={20} color="#EF4444" />
              <Text style={{ color: '#111827', fontWeight: '700', marginLeft: 8, fontSize: 16 }}>
                Favorites ({profile?.favorites?.length || 0})
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
              marginTop: 8,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              {loadingFavorites ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#516D58" />
                </View>
              ) : favoriteTrails.length === 0 ? (
                <View style={{ padding: 20, backgroundColor: '#FFFFFF' }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No favorite trails yet.
                  </Text>
                </View>
              ) : (
                favoriteTrails.map((trail, index) => (
                  <TouchableOpacity
                    key={trail.id}
                    onPress={() => router.push(`/trail/${trail.id}` as any)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: index < favoriteTrails.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                      backgroundColor: '#FFFFFF',
                    }}
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
                ))
              )}
            </View>
          )}
        </View>

        {/* Wishlist */}
        <View style={{ marginBottom: 16 }}>
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
              shadowRadius: 12,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="bookmark" size={20} color="#3B82F6" />
              <Text style={{ color: '#111827', fontWeight: '700', marginLeft: 8, fontSize: 16 }}>
                Wishlist ({profile?.wishlist?.length || 0})
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
              marginTop: 8,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              {loadingWishlist ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#516D58" />
                </View>
              ) : wishlistTrails.length === 0 ? (
                <View style={{ padding: 20, backgroundColor: '#FFFFFF' }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No trails in wishlist yet.
                  </Text>
                </View>
              ) : (
                wishlistTrails.map((trail, index) => (
                  <TouchableOpacity
                    key={trail.id}
                    onPress={() => router.push(`/trail/${trail.id}` as any)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: index < wishlistTrails.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                      backgroundColor: '#FFFFFF',
                    }}
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
                ))
              )}
            </View>
          )}
        </View>

        {/* Completed Trails */}
        <View style={{ marginBottom: 16 }}>
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
              shadowRadius: 12,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={{ color: '#111827', fontWeight: '700', marginLeft: 8, fontSize: 16 }}>
                Completed Trails ({profile?.completed?.length || 0})
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
              marginTop: 8,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              {loadingCompleted ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#516D58" />
                </View>
              ) : completedTrails.length === 0 ? (
                <View style={{ padding: 20, backgroundColor: '#FFFFFF' }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No completed trails yet.
                  </Text>
                </View>
              ) : (
                completedTrails.map((trail, index) => (
                  <TouchableOpacity
                    key={trail.id}
                    onPress={() => router.push(`/trail/${trail.id}` as any)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: index < completedTrails.length - 1 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                      backgroundColor: '#FFFFFF',
                    }}
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
                ))
              )}
            </View>
          )}
        </View>

        {/* Posts */}
        <View style={{ marginBottom: 16 }}>
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
              shadowRadius: 12,
              elevation: 2,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="document-text" size={20} color="#10b981" />
              <Text style={{ color: '#111827', fontWeight: '700', marginLeft: 8, fontSize: 16 }}>
                Posts ({posts.filter((p) => p.id !== "DELETED").length})
              </Text>
            </View>
            <Ionicons
              name={showPosts ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showPosts && (
            <View style={{ marginTop: 8 }}>
              {loadingPosts ? (
                <View style={{
                  paddingVertical: 32,
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 2,
                }}>
                  <ActivityIndicator size="small" color="#516D58" />
                  <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>
                    Loading posts...
                  </Text>
                </View>
              ) : posts.filter((p) => p.id !== "DELETED").length === 0 ? (
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
                  <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 14 }}>
                    No posts yet.
                  </Text>
                </View>
              ) : (
                <View>
                  {posts
                    .filter((p) => p.id !== "DELETED")
                    .map((p) => (
                      <View key={p.id} style={{ marginBottom: 12 }}>
                        <PostCard
                          post={p}
                          onUpdate={(updatedPost) => {
                            // Handle post deletion
                            if (updatedPost && updatedPost.id === "DELETED") {
                              setPosts((prev) =>
                                prev.filter((post) => post.id !== p.id)
                              );
                            } else if (updatedPost) {
                              setPosts((prev) =>
                                prev.map((post) =>
                                  post.id === p.id ? updatedPost : post
                                )
                              );
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

        {/* Following List Modal */}
        {uid && (
          <FollowingList
            visible={showFollowingList}
            userId={uid as string}
            onClose={() => setShowFollowingList(false)}
          />
        )}

        {/* Followers List Modal */}
        {uid && (
          <FollowersList
            visible={showFollowersList}
            userId={uid as string}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContentWrapper: {
    width: "100%",
    maxHeight: Platform.OS === "web" ? "90%" : "85%",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  modalScrollView: {
    maxHeight: Platform.OS === "web" ? 600 : 500,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  safeAreaBottom: {
    backgroundColor: "#FFFFFF",
  },
});

export default RemoteProfile;
