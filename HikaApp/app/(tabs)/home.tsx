import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { Redirect, useRouter, Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { PostCard } from "../../components/ui/PostCard";
import { searchUsers, subscribeToFeedPosts } from "../../services/database";
import { Image } from "expo-image";
import { getRankBorderStyle } from "../../utils/rankStyles";

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
    <ScrollView
      className="flex-1 bg-hika-darkgreen"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="px-4 py-6">
        {/* People search */}
        <View className="mb-4">
          <TextInput
            className="rounded-lg px-4 py-3 text-white bg-transparent border border-white"
            placeholder="Search people by name or username"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View className="mt-4">
            {results.map((u) => (
              <Link key={u.uid} href={("/profile/" + u.uid) as any} asChild>
                <TouchableOpacity
                  className="flex-row items-center py-3 border-b border-gray-700"
                  onPress={() => router.push(`/profile/${u.uid}` as any)}
                >
                  {u.profilePictureUrl ? (
                    <Image
                      source={{ uri: u.profilePictureUrl }}
                      style={[
                        {
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                        },
                        getRankBorderStyle((u.rank || "Copper") as UserRank),
                      ]}
                      contentFit="cover"
                      className="mr-4"
                    />
                  ) : (
                    <View
                      style={[
                        {
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: "#10b981",
                          alignItems: "center",
                          justifyContent: "center",
                        },
                        getRankBorderStyle((u.rank || "Copper") as UserRank),
                      ]}
                      className="mr-4"
                    >
                      <Text className="text-white font-bold">
                        {u.displayName?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-white font-medium ml-3">
                      {u.displayName}
                    </Text>
                    {(u as any).username ? (
                      <Text className="text-gray-500 text-sm">
                        @{(u as any).username}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        {/* Feed */}
        <View className="mb-4">
          {loadingFeed ? (
            <Text className="text-gray-400">Loading feed...</Text>
          ) : feedPosts.length === 0 ? (
            <View className="items-center py-8">
              {/* Wrap image in a white background View */}
              <View className="bg-off-white rounded-lg p-4 mb-4">
                <Image
                  source={require('../../assets/images/deer.png')}
                  style={{ width: 200, height: 200 }}
                  contentFit="contain"
                />
              </View>
              <Text className="text-white text-center font-bold mt-4">No posts yet...</Text>
              <Text className="text-white text-sm text-center font-bold mt-2 px-4">
                Follow some hikers to see their adventures!
              </Text>
            </View>
          ) : (
            feedPosts
              .filter((p) => p.id !== "DELETED")
              .map((p) => (
                <PostCard
                  key={p.id}
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
              ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Home;
