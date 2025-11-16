import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { Redirect, useRouter, Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { PostCard } from "../../components/ui/PostCard";
import { searchUsers, subscribeToFeedPosts } from "../../services/database";
import { Image } from "expo-image";
import { getRankBorderStyle } from "../../utils/rankStyles";
import { Ionicons } from "@expo/vector-icons";

import type { UserProfile, Post, UserRank } from "../../types";

const Home = () => {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  // state for people search
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const searchTimer = useRef<number | null>(null);

  // feed state
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounced live search (runs automatically as user types)
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (!searchQuery || searchQuery.trim() === "") {
      setResults([]);
      return;
    }

    // @ts-ignore - window.setTimeout returns number in browser and NodeJS.Timeout in Node
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await searchUsers(searchQuery, 30);
        setResults(res);
      } catch (e) {
        console.warn("Search error", e);
        setResults([]);
      }
    }, 350);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery]);

  // Load feed posts for followed users (real-time with onSnapshot)
  useEffect(() => {
    const following = (userProfile?.following || []) as string[];
    const ids = Array.from(
      new Set([...(following || []), user?.uid].filter(Boolean))
    ) as string[];

    if (ids.length === 0) {
      setFeedPosts([]);
      setLoadingFeed(false);
      return;
    }

    setLoadingFeed(true);

    // Subscribe to real-time feed updates
    const unsubscribe = subscribeToFeedPosts(
      ids,
      (posts) => {
        setFeedPosts(posts);
        setLoadingFeed(false);
      },
      50
    );

    // Unsubscribe on unmount or when following list changes
    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, [userProfile?.following, user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Trigger a manual re-subscription of the feed
    const following = (userProfile?.following || []) as string[];
    const ids = Array.from(
      new Set([...(following || []), user?.uid].filter(Boolean))
    ) as string[];

    if (ids.length > 0) {
      // Re-subscribe to get latest posts
      const unsubscribe = subscribeToFeedPosts(
        ids,
        (posts) => {
          setFeedPosts(posts);
          setRefreshing(false);
        },
        50
      );

      // Clean up after a short delay to ensure data is loaded
      setTimeout(() => {
        try {
          unsubscribe();
        } catch {}
      }, 1000);
    } else {
      setRefreshing(false);
    }
  };

  // Redirect if not authenticated
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  if (loading) {
    return <LoadingScreen message="Loading your feed..." variant="minimal" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#516D58' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#516D58"
            colors={['#516D58']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {/* People search */}
          {searchQuery && (
            <View style={{ marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                paddingHorizontal: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}>
                <Ionicons name="search" size={20} color="#6B7280" style={{ marginRight: 12 }} />
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: '#111827',
                    paddingVertical: 12,
                  }}
                  placeholder="Search people by name or username"
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {results.length > 0 && (
                <View style={{
                  marginTop: 12,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}>
                  {results.map((u, index) => (
                    <Link key={u.uid} href={("/profile/" + u.uid) as any} asChild>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          borderBottomWidth: index < results.length - 1 ? 1 : 0,
                          borderBottomColor: '#F3F4F6',
                        }}
                        onPress={() => router.push(`/profile/${u.uid}` as any)}
                        activeOpacity={0.7}
                      >
                        <View style={{ marginRight: 12 }}>
                          {u.profilePictureUrl ? (
                            <Image
                              source={{ uri: u.profilePictureUrl }}
                              style={[
                                {
                                  width: 48,
                                  height: 48,
                                  borderRadius: 24,
                                },
                                getRankBorderStyle((u.rank || "Copper") as UserRank),
                              ]}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                {
                                  width: 48,
                                  height: 48,
                                  borderRadius: 24,
                                  backgroundColor: "#10b981",
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                                getRankBorderStyle((u.rank || "Copper") as UserRank),
                              ]}
                            >
                              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}>
                                {u.displayName?.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#111827', fontWeight: '600', fontSize: 16 }}>
                            {u.displayName}
                          </Text>
                          {(u as any).username ? (
                            <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 2 }}>
                              @{(u as any).username}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </Link>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Search bar when no query */}
          {!searchQuery && (
            <View style={{ marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                paddingHorizontal: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}>
                <Ionicons name="search" size={20} color="#6B7280" style={{ marginRight: 12 }} />
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: '#111827',
                    paddingVertical: 12,
                  }}
                  placeholder="Search people by name or username"
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
          )}

          {/* Feed */}
          <View>
            {loadingFeed ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="small" color="#516D58" />
                <Text style={{ color: '#6B7280', marginTop: 12, fontSize: 14 }}>Loading feed...</Text>
              </View>
            ) : feedPosts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 24,
                  marginBottom: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 3,
                }}>
                  <Image
                    source={require('../../assets/images/deer.png')}
                    style={{ width: 180, height: 180 }}
                    contentFit="contain"
                  />
                </View>
                <Text style={{ color: '#111827', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                  No posts yet...
                </Text>
                <Text style={{ color: '#6B7280', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 }}>
                  Follow some hikers to see their adventures!
                </Text>
              </View>
            ) : (
              feedPosts
                .filter((p) => p.id !== "DELETED")
                .map((p) => (
                  <View key={p.id} style={{ marginBottom: 16 }}>
                    <PostCard
                      post={p}
                      onUpdate={(updatedPost) => {
                        // Handle post deletion
                        if (updatedPost && updatedPost.id === "DELETED") {
                          setFeedPosts((prev) =>
                            prev.filter((post) => post.id !== p.id)
                          );
                        } else if (updatedPost) {
                          setFeedPosts((prev) =>
                            prev.map((post) =>
                              post.id === p.id ? updatedPost : post
                            )
                          );
                        }
                      }}
                    />
                  </View>
                ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default Home;
