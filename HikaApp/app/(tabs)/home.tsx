import { View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { Redirect, useRouter, Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { Input } from "../../components/ui/Input";
import { PostCard } from "../../components/ui/PostCard";
import { searchUsers, subscribeToFeedPosts } from "../../services/database";
import { Image } from "expo-image";

import type { UserProfile, Post } from "../../types";

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
    const ids = Array.from(new Set([...(following || []), user?.uid].filter(Boolean))) as string[];
    
    if (ids.length === 0) {
      setFeedPosts([]);
      setLoadingFeed(false);
      return;
    }

    setLoadingFeed(true);
    
    // Subscribe to real-time feed updates
    const unsubscribe = subscribeToFeedPosts(ids, (posts) => {
      setFeedPosts(posts);
      setLoadingFeed(false);
    }, 50);

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
    const ids = Array.from(new Set([...(following || []), user?.uid].filter(Boolean))) as string[];
    
    if (ids.length > 0) {
      // Re-subscribe to get latest posts
      const unsubscribe = subscribeToFeedPosts(ids, (posts) => {
        setFeedPosts(posts);
        setRefreshing(false);
      }, 50);
      
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="px-4 py-6">
        {/* People search */}
        <View className="mb-4">
          <TextInput
            className="rounded-lg px-4 py-3 text-hika-darkgreen bg-transparent bg-white border border-white"
            placeholder="Search people by name or username"
            placeholderTextColor="#516d58"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View className="mt-4">
            {results.map((u) => (
              <Link key={u.uid} href={("/profile/" + u.uid) as any} asChild>
                <TouchableOpacity
                  className="flex-row items-center py-3 border-b border-gray-100"
                  onPress={() => router.push(`/profile/${u.uid}` as any)}
                >
                  {u.profilePictureUrl ? (
                    <Image
                      source={{ uri: u.profilePictureUrl }}
                      style={{ width: 42, height: 42, borderRadius: 24, borderWidth: 2, borderColor: '#E5E7EB' }}
                      contentFit="cover"
                      className="mr-4"
                    />
                  ) : (
                    <View className="w-12 h-12 bg-green-500 rounded-full items-center justify-center mr-01">
                      <Text className="text-white font-bold">{u.displayName?.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-white font-medium ml-3">{u.displayName}</Text>
                    {(u as any).username ? (
                      <Text className="text-gray-500 text-sm">@{(u as any).username}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        {/* Composer removed from Home - posts are created on your profile page only */}

        <View className="mb-4">
          <Text className="text-lg font-semibold text-white mb-2">Feed</Text>
          {loadingFeed ? (
            <Text className="text-gray-500">Loading feed...</Text>
          ) : feedPosts.length === 0 ? (
            <Text className="text-gray-500">No posts yet.</Text>
          ) : (
            feedPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Home;
