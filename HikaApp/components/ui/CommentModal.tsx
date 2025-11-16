import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { addComment, getPost, getTrail, getUserProfiles } from '../../services/database';
import TrailMap from '../maps/TrailMap';
import type { Post, Comment, Trail } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CommentModalProps {
  visible: boolean;
  post: Post;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  visible,
  post,
  onClose,
  onCommentAdded,
}) => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post>(post);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const imageListRef = useRef<FlatList>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [commentProfilePictures, setCommentProfilePictures] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      loadPost();
      setSelectedImageIndex(0);
    }
  }, [visible, post.id]);

  useEffect(() => {
    if (currentPost.trailId) {
      loadTrail();
    }
  }, [currentPost.trailId]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const updatedPost = await getPost(post.id);
      if (updatedPost) {
        setCurrentPost(updatedPost);
        // Load profile pictures for comments that don't have them
        if (updatedPost.comments && updatedPost.comments.length > 0) {
          loadCommentProfilePictures(updatedPost.comments);
        }
      }
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommentProfilePictures = async (comments: Comment[]) => {
    const picturesToLoad: Record<string, string> = {};
    const userIdsToFetch: string[] = [];

    // Check which comments need profile pictures
    comments.forEach((comment) => {
      if (!comment.userProfilePictureUrl && comment.userId) {
        // Only add unique user IDs
        if (!userIdsToFetch.includes(comment.userId)) {
          userIdsToFetch.push(comment.userId);
        }
      } else if (comment.userProfilePictureUrl) {
        picturesToLoad[comment.userId] = comment.userProfilePictureUrl;
      }
    });

    // Fetch profile pictures for comments that don't have them (batch fetch)
    if (userIdsToFetch.length > 0) {
      try {
        const profiles = await getUserProfiles(userIdsToFetch);
        profiles.forEach((profile) => {
          if (profile.profilePictureUrl) {
            picturesToLoad[profile.uid] = profile.profilePictureUrl;
          }
        });
      } catch (error) {
        console.error('Error loading comment profile pictures:', error);
      }
    }

    setCommentProfilePictures(picturesToLoad);
  };

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

  const handleSubmit = async () => {
    if (!user?.uid) {
      Alert.alert('Please sign in', 'You need to be signed in to comment');
      return;
    }

    if (!commentText.trim()) {
      Alert.alert('Empty comment', 'Please enter a comment');
      return;
    }

    try {
      setSubmitting(true);
      await addComment(post.id, {
        userId: user.uid,
        userDisplayName: userProfile?.displayName || user.displayName || 'User',
        userProfilePictureUrl: userProfile?.profilePictureUrl,
        text: commentText.trim(),
      });

      setCommentText('');
      await loadPost();
      onCommentAdded?.();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPostDate = (date: Date): string => {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <SafeAreaView edges={['top']} className="bg-white">
            <View className="flex-row items-center justify-between pl-4 pr-2 pt-6 pb-4 border-b border-gray-200 bg-white">
              <Text className="text-lg font-semibold text-gray-900">Comments</Text>
              <TouchableOpacity 
                onPress={onClose} 
                className="p-4 -mr-2"
                hitSlop={{ top: 25, right: 25, bottom: 25, left: 25 }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <ScrollView className="flex-1 bg-white" showsVerticalScrollIndicator={false}>
            {/* Post Content */}
            <View className="border-b border-gray-200 pb-4">
              {/* Post Header */}
              <View className="flex-row items-center px-4 pt-4 pb-2">
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
                <View className="flex-1">
                  <Text className="text-gray-900 font-semibold">{currentPost.userDisplayName}</Text>
                  <Text className="text-gray-500 text-xs">{formatPostDate(currentPost.createdAt)}</Text>
                </View>
              </View>

              {/* Post Description */}
              {currentPost.description && (
                <View className="px-4 pb-3">
                  <Text className="text-gray-900 text-base leading-6">{currentPost.description}</Text>
                </View>
              )}

              {/* Post Images - Swipeable Carousel */}
              {currentPost.images && currentPost.images.length > 0 && (
                <View className="px-4 pb-3">
                  <View className="relative overflow-hidden rounded-lg" style={{ width: '100%', maxWidth: SCREEN_WIDTH - 32 }}>
                    <FlatList
                      ref={imageListRef}
                      data={currentPost.images}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item, index) => `comment-post-image-${index}`}
                      onMomentumScrollEnd={(event) => {
                        const imageWidth = SCREEN_WIDTH - 32;
                        const index = Math.round(event.nativeEvent.contentOffset.x / imageWidth);
                        if (index >= 0 && index < currentPost.images.length) {
                          setSelectedImageIndex(index);
                        }
                      }}
                      getItemLayout={(data, index) => {
                        const imageWidth = SCREEN_WIDTH - 32;
                        return {
                          length: imageWidth,
                          offset: imageWidth * index,
                          index,
                        };
                      }}
                      renderItem={({ item: uri }) => {
                        const imageWidth = SCREEN_WIDTH - 32;
                        return (
                          <View style={{ width: imageWidth, alignItems: 'center', justifyContent: 'center' }}>
                            <Image
                              source={{ uri }}
                              style={{ width: imageWidth, maxHeight: 400, borderRadius: 8 }}
                              contentFit="contain"
                            />
                          </View>
                        );
                      }}
                      onScrollToIndexFailed={(info) => {
                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                        wait.then(() => {
                          const imageWidth = SCREEN_WIDTH - 32;
                          imageListRef.current?.scrollToOffset({ 
                            offset: imageWidth * info.index, 
                            animated: false 
                          });
                        });
                      }}
                    />
                    
                    {/* Image Counter/Dots Indicator */}
                    {currentPost.images.length > 1 && (
                      <>
                        <View className="absolute bottom-4 right-4 bg-black/60 rounded-full px-3 py-1">
                          <Text className="text-white text-sm font-semibold">
                            {selectedImageIndex + 1} / {currentPost.images.length}
                          </Text>
                        </View>
                        {/* Dot Indicators */}
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
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* Trail Info */}
              {currentPost.trailId && currentPost.trailName && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    router.push(`/trail/${currentPost.trailId}` as any);
                  }}
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
              {(currentPost.distance !== undefined || currentPost.elevationGain !== undefined || currentPost.time !== undefined) && (
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
            </View>

            {/* Comments List */}
            <View className="px-4 py-4">
              {loading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : (!currentPost.comments || currentPost.comments.length === 0) ? (
                <View className="py-16 items-center">
                  <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                  <Text className="text-gray-500 mt-3 text-center">
                    No comments yet. Be the first to comment!
                  </Text>
                </View>
              ) : (
                currentPost.comments.map((comment: Comment) => {
                  const profilePictureUrl = comment.userProfilePictureUrl || commentProfilePictures[comment.userId];
                  return (
                    <View key={comment.id} className="mb-4 flex-row">
                      {profilePictureUrl ? (
                        <Image
                          source={{ uri: profilePictureUrl }}
                          className="w-8 h-8 rounded-full mr-3"
                          contentFit="cover"
                        />
                      ) : (
                        <View className="w-8 h-8 bg-green-500 rounded-full items-center justify-center mr-3">
                          <Text className="text-white font-bold text-xs">
                            {comment.userDisplayName?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <View className="bg-gray-100 rounded-lg px-3 py-2">
                          <Text className="text-gray-900 font-semibold text-sm mb-1">
                            {comment.userDisplayName}
                          </Text>
                          <Text className="text-gray-700 text-sm">{comment.text}</Text>
                        </View>
                        <Text className="text-gray-400 text-xs mt-1 ml-3">
                          {formatDate(comment.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Comment Input */}
          <SafeAreaView edges={['bottom']} className="bg-white border-t border-gray-200">
            <View className="px-4 pt-4 pb-6">
              <View className="flex-row items-center">
                <TextInput
                  placeholder="Add a comment..."
                  value={commentText}
                  onChangeText={setCommentText}
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-gray-900"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting || !commentText.trim()}
                  className={`ml-2 p-2 rounded-full ${
                    submitting || !commentText.trim()
                      ? 'bg-gray-300'
                      : 'bg-green-500'
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="send" size={20} color="white" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CommentModal;

