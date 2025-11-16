import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Redirect, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { followUser, unfollowUser } from "../../services/database";
import { db } from "../../firebaseConfig";
import { doc, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { PostComposer } from "../../components/ui/PostComposer";
import type { Post, UserProfile } from "../../types";

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
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        <View className="mb-4">
          <TouchableOpacity onPress={() => router.back()} className="px-2 py-1">
            <Text className="text-green-600">Back</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Stats</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">{((profile?.totalDistance || 0) / 1000).toFixed(1)} km</Text>
              <Text className="text-gray-600 text-sm">Total Distance</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">{profile?.totalHikes || 0}</Text>
              <Text className="text-gray-600 text-sm">Total Hikes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">{Math.floor((profile?.totalTime || 0) / 3600)}h</Text>
              <Text className="text-gray-600 text-sm">Total Time</Text>
            </View>
          </View>
        </View>
        <View className="items-center mb-4">
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-3">
            <Text className="text-3xl font-bold text-white">
              {profile.displayName?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            {profile.displayName}
          </Text>
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

        <View className="mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Posts
          </Text>
          {loadingPosts ? (
            <Text className="text-gray-500">Loading posts...</Text>
          ) : posts.length === 0 ? (
            <Text className="text-gray-500">No posts yet.</Text>
          ) : (
            posts.map((p) => (
              <View key={p.id} className="mb-4 bg-gray-50 rounded-lg p-3">
                <Text className="text-gray-900 font-medium">
                  {p.description}
                </Text>
                <Text className="text-gray-500 text-sm mt-2">
                  {new Date(p.createdAt).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default RemoteProfile;
