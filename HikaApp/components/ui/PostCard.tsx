import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import TrailMap from '../maps/TrailMap';
import { SharePostModal } from './SharePostModal';
import { CommentModal } from './CommentModal';
import { getTrail, likePost, unlikePost, getPost } from '../../services/database';
import type { Post, Trail } from '../../types';

interface PostCardProps {
  post: Post;
  onUpdate?: (updatedPost: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onUpdate }) => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post>(post);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    setCurrentPost(post);
  }, [post]);

  useEffect(() => {
    if (currentPost.trailId) {
      loadTrail();
    }
  }, [currentPost.trailId]);

  const loadTrail = async () => {
    if (!currentPost.trailId) return;
    
    try {
      setLoadingTrail(true);
      const trailData = await getTrail(currentPost.trailId);
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

  const handleLike = async () => {
    if (!user?.uid) {
      Alert.alert('Please sign in', 'You need to be signed in to like posts');
      return;
    }

    if (liking) return;

    const isLiked = currentPost.likes?.includes(user.uid) || false;

    try {
      setLiking(true);
      if (isLiked) {
        await unlikePost(currentPost.id, user.uid);
      } else {
        await likePost(currentPost.id, user.uid);
      }

      // Refresh post data
      const updatedPost = await getPost(currentPost.id);
      if (updatedPost) {
        setCurrentPost(updatedPost);
        onUpdate?.(updatedPost);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    } finally {
      setLiking(false);
    }
  };

  const handleCommentAdded = async () => {
    // Refresh post data after comment is added
    try {
      const updatedPost = await getPost(currentPost.id);
      if (updatedPost) {
        setCurrentPost(updatedPost);
        onUpdate?.(updatedPost);
      }
    } catch (error) {
      console.error('Error refreshing post:', error);
    }
  };

  const hasStats = currentPost.distance !== undefined || currentPost.elevationGain !== undefined || currentPost.time !== undefined;
  const isLiked = user && currentPost.likes?.includes(user.uid);

  return (
    <View className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.push(`/profile/${currentPost.userId}` as any)}
          activeOpacity={0.7}
        >
          {currentPost.userProfilePictureUrl ? (
            <Image
              source={{ uri: currentPost.userProfilePictureUrl }}
              className="w-10 h-10 rounded-full mr-3"
            />
          ) : (
            <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center mr-3">
              <Text className="text-white font-bold text-lg">
                {currentPost.userDisplayName?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/profile/${currentPost.userId}` as any)}
          activeOpacity={0.7}
          className="flex-1"
        >
          <Text className="text-gray-900 font-semibold">{currentPost.userDisplayName}</Text>
          <Text className="text-gray-500 text-xs">{formatDate(currentPost.createdAt)}</Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      {currentPost.description && (
        <View className="px-4 py-3">
          <Text className="text-gray-900 text-base leading-6">{currentPost.description}</Text>
        </View>
      )}

      {/* Trail Info */}
      {currentPost.trailId && currentPost.trailName && (
        <TouchableOpacity
          onPress={() => router.push(`/trail/${currentPost.trailId}` as any)}
          className="px-4 py-2 bg-gray-50 border-y border-gray-100"
        >
          <View className="flex-row items-center">
            <Ionicons name="trail-sign" size={20} color="#10b981" />
            <View className="flex-1 ml-2">
              <Text className="text-gray-900 font-semibold">{currentPost.trailName}</Text>
              {currentPost.location && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text className="text-gray-600 text-sm ml-1">{currentPost.location}</Text>
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
            {currentPost.distance !== undefined && (
              <View className="flex-row items-center mr-6 mb-2">
                <Ionicons name="resize-outline" size={18} color="#10b981" />
                <Text className="text-gray-700 font-medium ml-2">{formatDistance(currentPost.distance)}</Text>
              </View>
            )}
            {currentPost.elevationGain !== undefined && (
              <View className="flex-row items-center mr-6 mb-2">
                <Ionicons name="trending-up-outline" size={18} color="#10b981" />
                <Text className="text-gray-700 font-medium ml-2">{Math.round(currentPost.elevationGain)}m</Text>
              </View>
            )}
            {currentPost.time !== undefined && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="time-outline" size={18} color="#10b981" />
                <Text className="text-gray-700 font-medium ml-2">{formatTime(currentPost.time)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Trail Map */}
      {currentPost.trailId && (
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
        <TouchableOpacity 
          onPress={handleLike}
          disabled={liking}
          className="flex-row items-center mr-6"
        >
          {liking ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={isLiked ? "#EF4444" : "#6B7280"} 
            />
          )}
          <Text className="text-gray-600 text-sm ml-2">{currentPost.likes?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setCommentModalVisible(true)}
          className="flex-row items-center mr-6"
        >
          <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">{currentPost.comments?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShareModalVisible(true)}
          className="flex-row items-center"
        >
          <Ionicons name="share-outline" size={20} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">{currentPost.shares || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Share Modal */}
      <SharePostModal
        visible={shareModalVisible}
        post={currentPost}
        onClose={() => setShareModalVisible(false)}
      />

      {/* Comment Modal */}
      <CommentModal
        visible={commentModalVisible}
        post={currentPost}
        onClose={() => setCommentModalVisible(false)}
        onCommentAdded={handleCommentAdded}
      />
    </View>
  );
};

export default PostCard;

