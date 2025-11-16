import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import TrailMap from '../maps/TrailMap';
import { SharePostModal } from './SharePostModal';
import { getTrail } from '../../services/database';
import type { Post, Trail } from '../../types';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  useEffect(() => {
    if (post.trailId) {
      loadTrail();
    }
  }, [post.trailId]);

  const loadTrail = async () => {
    if (!post.trailId) return;
    
    try {
      setLoadingTrail(true);
      const trailData = await getTrail(post.trailId);
      if (trailData) {
        setTrail(trailData);
      }
    } catch (err) {
      console.error('Error loading trail for post:', err);
    } finally {
      setLoadingTrail(false);
    }
  };

  const formatDistance = (meters?: number): string => {
    if (!meters || meters === 0) return '0m';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds || seconds === 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const hasStats = post.distance !== undefined || post.elevationGain !== undefined || post.time !== undefined;

  return (
    <View className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        {post.userProfilePictureUrl ? (
          <Image
            source={{ uri: post.userProfilePictureUrl }}
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center mr-3">
            <Text className="text-white font-bold text-lg">
              {post.userDisplayName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-gray-900 font-semibold">{post.userDisplayName}</Text>
          <Text className="text-gray-500 text-xs">{formatDate(post.createdAt)}</Text>
        </View>
      </View>

      {/* Description */}
      {post.description && (
        <View className="px-4 py-3">
          <Text className="text-gray-900 text-base leading-6">{post.description}</Text>
        </View>
      )}

      {/* Trail Info */}
      {post.trailId && post.trailName && (
        <TouchableOpacity
          onPress={() => router.push(`/trail/${post.trailId}` as any)}
          className="px-4 py-2 bg-gray-50 border-y border-gray-100"
        >
          <View className="flex-row items-center">
            <Ionicons name="trail-sign" size={20} color="#10b981" />
            <View className="flex-1 ml-2">
              <Text className="text-gray-900 font-semibold">{post.trailName}</Text>
              {post.location && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text className="text-gray-600 text-sm ml-1">{post.location}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Stats */}
      {hasStats && (
        <View className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <View className="flex-row flex-wrap">
            {post.distance !== undefined && (
              <View className="flex-row items-center mr-6 mb-2">
                <Ionicons name="resize-outline" size={18} color="#10b981" />
                <Text className="text-gray-700 font-medium ml-2">{formatDistance(post.distance)}</Text>
              </View>
            )}
            {post.elevationGain !== undefined && (
              <View className="flex-row items-center mr-6 mb-2">
                <Ionicons name="trending-up-outline" size={18} color="#10b981" />
                <Text className="text-gray-700 font-medium ml-2">{Math.round(post.elevationGain)}m</Text>
              </View>
            )}
            {post.time !== undefined && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="time-outline" size={18} color="#10b981" />
                <Text className="text-gray-700 font-medium ml-2">{formatTime(post.time)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Trail Map */}
      {post.trailId && (
        <View className="bg-gray-50">
          {loadingTrail ? (
            <View className="h-48 items-center justify-center">
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          ) : trail ? (
            <TrailMap trail={trail} height={200} />
          ) : (
            <View className="h-48 items-center justify-center bg-gray-100">
              <Ionicons name="map-outline" size={32} color="#9CA3AF" />
              <Text className="text-gray-500 text-sm mt-2">Map unavailable</Text>
            </View>
          )}
        </View>
      )}

      {/* Engagement Bar */}
      <View className="flex-row items-center px-4 py-2 border-t border-gray-100">
        <TouchableOpacity className="flex-row items-center mr-6">
          <Ionicons 
            name={user && post.likes?.includes(user.uid) ? "heart" : "heart-outline"} 
            size={20} 
            color={user && post.likes?.includes(user.uid) ? "#EF4444" : "#6B7280"} 
          />
          <Text className="text-gray-600 text-sm ml-2">{post.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center mr-6">
          <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">{post.comments?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShareModalVisible(true)}
          className="flex-row items-center"
        >
          <Ionicons name="share-outline" size={20} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">{post.shares || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Share Modal */}
      <SharePostModal
        visible={shareModalVisible}
        post={post}
        onClose={() => setShareModalVisible(false)}
      />
    </View>
  );
};

export default PostCard;

