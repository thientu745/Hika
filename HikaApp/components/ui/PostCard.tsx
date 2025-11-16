import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, ScrollView, Dimensions, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import TrailMap from '../maps/TrailMap';
import { CommentModal } from './CommentModal';
import { EditPostModal } from './EditPostModal';
import { getTrail, likePost, unlikePost, getPost } from '../../services/database';
import type { Post, Trail } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onUpdate?: (updatedPost: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onUpdate }) => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post>(post);
  const [liking, setLiking] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const imageListRef = useRef<FlatList>(null);
  const postImageListRef = useRef<FlatList>(null);

  // Scroll to selected image when modal opens
  useEffect(() => {
    if (imageModalVisible && imageListRef.current && currentPost.images && currentPost.images.length > 0) {
      // Small delay to ensure FlatList is rendered
      setTimeout(() => {
        imageListRef.current?.scrollToIndex({ 
          index: selectedImageIndex, 
          animated: false 
        });
      }, 100);
    }
  }, [imageModalVisible, selectedImageIndex, currentPost.images]);

  // Reset selected image index when post changes
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [currentPost.id]);

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
    const currentLikes = currentPost.likes || [];
    
    // Store previous state for error rollback
    const previousPost = currentPost;

    // Optimistic update
    const optimisticLikes = isLiked
      ? currentLikes.filter((id) => id !== user.uid)
      : [...currentLikes, user.uid];
    
    const optimisticPost = {
      ...currentPost,
      likes: optimisticLikes,
    };
    setCurrentPost(optimisticPost);
    onUpdate?.(optimisticPost);

    try {
      setLiking(true);
      if (isLiked) {
        await unlikePost(currentPost.id, user.uid);
      } else {
        await likePost(currentPost.id, user.uid);
      }

      // Refresh post data to ensure consistency
      const updatedPost = await getPost(currentPost.id);
      if (updatedPost) {
        setCurrentPost(updatedPost);
        onUpdate?.(updatedPost);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      setCurrentPost(previousPost);
      onUpdate?.(previousPost);
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

  const handlePostUpdate = (updatedPost: Post | null) => {
    if (updatedPost === null) {
      // Post was deleted
      onUpdate?.({ ...currentPost, id: 'DELETED' } as Post);
    } else {
      // Post was updated
      setCurrentPost(updatedPost);
      onUpdate?.(updatedPost);
    }
    setEditModalVisible(false);
  };

  const hasStats = currentPost.distance !== undefined || currentPost.elevationGain !== undefined || currentPost.time !== undefined;
  const isLiked = user && currentPost.likes?.includes(user.uid);
  const isOwner = user && currentPost.userId === user.uid;

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
        {/* Edit button for post owner */}
        {isOwner && (
          <TouchableOpacity
            onPress={() => setEditModalVisible(true)}
            className="ml-2 p-2"
          >
            <Ionicons name="create-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      {currentPost.description && (
        <View className="px-4 py-3">
          <Text className="text-gray-900 text-base leading-6">{currentPost.description}</Text>
        </View>
      )}

      {/* Image Gallery - Swipeable Carousel */}
      {currentPost.images && currentPost.images.length > 0 && (
        <View className="relative">
          <FlatList
            ref={postImageListRef}
            data={currentPost.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `post-image-${index}`}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (index >= 0 && index < currentPost.images.length) {
                setSelectedImageIndex(index);
              }
            }}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            renderItem={({ item: uri, index }) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageIndex(index);
                  setImageModalVisible(true);
                }}
                activeOpacity={0.9}
                style={{ width: SCREEN_WIDTH }}
              >
                <Image
                  source={{ uri }}
                  style={{ width: SCREEN_WIDTH, height: 400 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                postImageListRef.current?.scrollToOffset({ 
                  offset: info.averageItemLength * info.index, 
                  animated: false 
                });
              });
            }}
          />
          
          {/* Image Counter/Dots Indicator */}
          {currentPost.images.length > 1 && (
            <View className="absolute bottom-4 right-4 bg-black/60 rounded-full px-3 py-1">
              <Text className="text-white text-sm font-semibold">
                {selectedImageIndex + 1} / {currentPost.images.length}
              </Text>
            </View>
          )}
          
          {/* Dot Indicators */}
          {currentPost.images.length > 1 && (
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center items-center gap-2">
              {currentPost.images.map((_, index) => (
                <View
                  key={index}
                  className={`h-2 rounded-full ${
                    index === selectedImageIndex ? 'bg-white w-6' : 'bg-white/50 w-2'
                  }`}
                />
              ))}
            </View>
          )}
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
          className="flex-row items-center"
        >
          <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
          <Text className="text-gray-600 text-sm ml-2">{currentPost.comments?.length || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Comment Modal */}
      <CommentModal
        visible={commentModalVisible}
        post={currentPost}
        onClose={() => setCommentModalVisible(false)}
        onCommentAdded={handleCommentAdded}
      />

      {/* Edit Post Modal */}
      {isOwner && (
        <EditPostModal
          visible={editModalVisible}
          post={currentPost}
          onClose={() => setEditModalVisible(false)}
          onUpdate={handlePostUpdate}
        />
      )}

      {/* Image Viewer Modal */}
      {currentPost.images && currentPost.images.length > 0 && (
        <Modal
          visible={imageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View className="flex-1 bg-black">
            <TouchableOpacity
              onPress={() => setImageModalVisible(false)}
              className="absolute top-12 right-4 z-10 bg-black/50 rounded-full p-2"
            >
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <FlatList
              ref={imageListRef}
              data={currentPost.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `image-${index}`}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                if (index >= 0 && index < currentPost.images.length) {
                  setSelectedImageIndex(index);
                }
              }}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              renderItem={({ item: uri }) => (
                <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                </View>
              )}
              onScrollToIndexFailed={(info) => {
                // Fallback: scroll to offset if scrollToIndex fails
                const wait = new Promise(resolve => setTimeout(resolve, 500));
                wait.then(() => {
                  imageListRef.current?.scrollToOffset({ 
                    offset: info.averageItemLength * info.index, 
                    animated: false 
                  });
                });
              }}
            />
            {currentPost.images.length > 1 && (
              <View className="absolute bottom-8 left-0 right-0 items-center">
                <View className="bg-black/50 rounded-full px-4 py-2">
                  <Text className="text-white text-sm">
                    {selectedImageIndex + 1} / {currentPost.images.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
};

export default PostCard;

