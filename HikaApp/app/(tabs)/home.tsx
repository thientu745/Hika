import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { Redirect, useRouter, Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { Input } from "../../components/ui/Input";
import { searchUsers, getFeedPosts } from "../../services/database";

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

  // Load feed posts for followed users (includes own posts)
  useEffect(() => {
    const loadFeed = async () => {
      setLoadingFeed(true);
      try {
        const following = (userProfile?.following || []) as string[];
        const ids = Array.from(new Set([...(following || []), user?.uid].filter(Boolean))) as string[];
        if (ids.length === 0) {
          setFeedPosts([]);
          setLoadingFeed(false);
          return;
        }
        const posts = await getFeedPosts(ids.slice(0, 10), 50);
        setFeedPosts(posts);
      } catch (error) {
        console.warn("Failed to load feed", error);
        setFeedPosts([]);
      } finally {
        setLoadingFeed(false);
      }
    };

    loadFeed();
  }, [userProfile?.following, user?.uid]);

  // Posts are loaded via the effect above; refresh function removed to avoid unused linter warning.

  // Redirect if not authenticated
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  if (loading) {
    return <LoadingScreen message="Loading your feed..." variant="minimal" />;
  }


  // helper navigation (use inline router.push in handlers)

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        {/* People search */}
        <View className="mb-4">
          <Input
            placeholder="Search people by name or username"
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerClassName="mb-2"
          />

          <View className="mt-4">
            {results.map((u) => (
              <Link key={u.uid} href={("/profile/" + u.uid) as any} asChild>
                <TouchableOpacity
                  className="flex-row items-center py-3 border-b border-gray-100"
                  onPress={() => router.push(`/profile/${u.uid}` as any)}
                >
                  <View className="w-12 h-12 bg-green-500 rounded-full items-center justify-center mr-4">
                    <Text className="text-white font-bold">{u.displayName?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium">{u.displayName}</Text>
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
          <Text className="text-lg font-semibold text-gray-900 mb-2">Feed</Text>
          {loadingFeed ? (
            <Text className="text-gray-500">Loading feed...</Text>
          ) : feedPosts.length === 0 ? (
            <Text className="text-gray-500">No posts yet.</Text>
          ) : (
            feedPosts.map((p) => (
              <View key={p.id} className="mb-4 bg-gray-50 rounded-lg p-3">
                <Text className="text-gray-900 font-medium">{p.userDisplayName}</Text>
                <Text className="text-gray-900 mt-1">{p.description}</Text>
                <Text className="text-gray-500 text-sm mt-2">{new Date(p.createdAt).toLocaleString()}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Home;
