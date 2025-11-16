import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { searchUsers, sendMessage, incrementPostShares } from '../../services/database';
import type { UserProfile, Post } from '../../types';

interface SharePostModalProps {
  visible: boolean;
  post: Post;
  onClose: () => void;
  onShareSuccess?: () => void;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  visible,
  post,
  onClose,
  onShareSuccess,
}) => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (!searchQuery || searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery, 20);
        // Filter out current user
        const filtered = results.filter((u) => u.uid !== user?.uid);
        setSearchResults(filtered);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery, user?.uid]);

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleShare = async () => {
    if (selectedUsers.size === 0) {
      Alert.alert('Please select at least one user to share with');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to share');
      return;
    }

    setSending(true);

    try {
      // Share post with each selected user
      const sharedPostData = {
        postId: post.id,
        trailName: post.trailName,
        description: post.description,
        images: post.images,
        distance: post.distance,
        elevationGain: post.elevationGain,
        time: post.time,
      };

      const sharePromises = Array.from(selectedUsers).map((recipientId) =>
        sendMessage(
          user.uid,
          recipientId,
          userProfile?.displayName || 'User',
          userProfile?.profilePictureUrl,
          undefined,
          sharedPostData
        )
      );

      await Promise.all(sharePromises);

      // Increment share count for the post
      await incrementPostShares(post.id);

      const firstRecipient = Array.from(selectedUsers)[0];
      
      Alert.alert('Success', `Post shared!`, [
        {
          text: 'View Chat',
          onPress: () => {
            setSelectedUsers(new Set());
            setSearchQuery('');
            onShareSuccess?.();
            onClose();
            // Navigate to the message screen
            router.push(`/messages/${firstRecipient}` as any);
          },
        },
        {
          text: 'Done',
          onPress: () => {
            setSelectedUsers(new Set());
            setSearchQuery('');
            onShareSuccess?.();
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share post. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatDistance = (meters?: number): string => {
    if (!meters || meters === 0) return '';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds || seconds === 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black bg-opacity-50">
        <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[90vh]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-900">Share Post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {/* Post Preview */}
            <View className="bg-gray-50 rounded-lg p-3 mb-4">
              <Text className="font-semibold text-gray-900 mb-2">{post.trailName}</Text>
              {post.description && (
                <Text className="text-gray-700 text-sm mb-2 line-clamp-2">
                  {post.description}
                </Text>
              )}
              {(post.distance || post.elevationGain || post.time) && (
                <View className="flex-row flex-wrap gap-3">
                  {post.distance !== undefined && (
                    <Text className="text-gray-600 text-xs">
                      📏 {formatDistance(post.distance)}
                    </Text>
                  )}
                  {post.elevationGain !== undefined && (
                    <Text className="text-gray-600 text-xs">
                      📈 {Math.round(post.elevationGain)}m
                    </Text>
                  )}
                  {post.time !== undefined && (
                    <Text className="text-gray-600 text-xs">
                      ⏱️ {formatTime(post.time)}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Search Input */}
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-2">Send to:</Text>
              <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                  placeholder="Search users..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 ml-2 text-gray-900"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Selected Users Count */}
            {selectedUsers.size > 0 && (
              <View className="mb-3 bg-green-50 rounded-lg p-3 flex-row items-center">
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text className="text-green-700 ml-2 font-medium">
                  {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
                </Text>
              </View>
            )}

            {/* Search Results or Recent Contacts */}
            <View>
              {loading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : searchResults.length > 0 ? (
                <View>
                  <Text className="text-gray-600 text-sm mb-2">Search Results</Text>
                  {searchResults.map((user) => (
                    <TouchableOpacity
                      key={user.uid}
                      onPress={() => toggleUserSelection(user.uid)}
                      className={`flex-row items-center p-3 rounded-lg mb-2 ${
                        selectedUsers.has(user.uid)
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {user.profilePictureUrl ? (
                        <Image
                          source={{ uri: user.profilePictureUrl }}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center">
                          <Text className="text-white font-bold">
                            {user.displayName?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1 ml-3">
                        <Text className="text-gray-900 font-medium">
                          {user.displayName}
                        </Text>
                        {user.bio && (
                          <Text className="text-gray-600 text-xs mt-1 line-clamp-1">
                            {user.bio}
                          </Text>
                        )}
                      </View>
                      {selectedUsers.has(user.uid) && (
                        <View className="w-6 h-6 bg-green-500 rounded-full items-center justify-center">
                          <Ionicons name="checkmark" size={16} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : searchQuery.trim() === '' ? (
                <View className="py-8 items-center">
                  <Ionicons name="search-outline" size={40} color="#D1D5DB" />
                  <Text className="text-gray-500 mt-2 text-center">
                    Search for users to share with
                  </Text>
                </View>
              ) : (
                <View className="py-8 items-center">
                  <Ionicons name="person-remove-outline" size={40} color="#D1D5DB" />
                  <Text className="text-gray-500 mt-2 text-center">
                    No users found
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Share Button */}
          <View className="px-4 py-4 border-t border-gray-200">
            <TouchableOpacity
              onPress={handleShare}
              disabled={selectedUsers.size === 0 || sending}
              className={`py-3 rounded-lg items-center ${
                selectedUsers.size === 0 || sending
                  ? 'bg-gray-300'
                  : 'bg-green-500'
              }`}
            >
              {sending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Share Post
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SharePostModal;
