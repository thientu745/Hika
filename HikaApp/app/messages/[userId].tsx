import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToConversationMessages, getUserProfile } from '../../services/database';
import type { Message, UserProfile } from '../../types';

const MessageScreen = () => {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!userId || !user) {
      router.back();
      return;
    }

    const loadOtherUser = async () => {
      try {
        const profile = await getUserProfile(userId);
        setOtherUser(profile);
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadOtherUser();

    // Subscribe to messages
    setLoading(true);
    const unsubscribe = subscribeToConversationMessages(user.uid, userId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 100);

    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, [userId, user, router]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      {/* Header */}
      <View className="px-4 py-3 bg-white border-b border-gray-200 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="chevron-back" size={28} color="#10b981" />
        </TouchableOpacity>
        <View className="flex-1 ml-3">
          <Text className="text-gray-900 font-semibold text-lg">
            {otherUser?.displayName || 'User'}
          </Text>
          {otherUser?.bio && (
            <Text className="text-gray-600 text-xs mt-1 line-clamp-1">
              {otherUser.bio}
            </Text>
          )}
        </View>
        {otherUser?.profilePictureUrl ? (
          <Image
            source={{ uri: otherUser.profilePictureUrl }}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center">
            <Text className="text-white font-bold">
              {otherUser?.displayName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <View className="px-4 py-4">
          {messages.length === 0 ? (
            <View className="py-16 items-center">
              <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-500 mt-3 text-center">
                No messages yet. Send a message to start the conversation!
              </Text>
            </View>
          ) : (
            messages.map((message) => {
              const isCurrentUser = message.senderId === user?.uid;
              return (
                <View
                  key={message.id}
                  className={`mb-4 flex-row ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Shared Post Message */}
                  {message.sharedPost ? (
                    <View
                      className={`max-w-xs rounded-lg overflow-hidden ${
                        isCurrentUser ? 'bg-green-50 border border-green-200' : 'bg-gray-100'
                      }`}
                    >
                      {/* Post Header */}
                      <View className="px-3 py-2 border-b border-gray-200">
                        <Text className="text-xs text-gray-500">
                          {isCurrentUser ? 'You' : message.senderDisplayName} shared a post
                        </Text>
                      </View>

                      {/* Post Content */}
                      <View className="p-3">
                        {/* Trail Images */}
                        {message.sharedPost.images && message.sharedPost.images.length > 0 && (
                          <Image
                            source={{ uri: message.sharedPost.images[0] }}
                            className="w-full h-40 rounded-lg mb-3"
                          />
                        )}

                        {/* Trail Info */}
                        <Text className="text-gray-900 font-semibold mb-2">
                          {message.sharedPost.trailName}
                        </Text>

                        {/* Description */}
                        {message.sharedPost.description && (
                          <Text className="text-gray-700 text-sm mb-3 line-clamp-2">
                            {message.sharedPost.description}
                          </Text>
                        )}

                        {/* Stats */}
                        {(message.sharedPost.distance ||
                          message.sharedPost.elevationGain ||
                          message.sharedPost.time) && (
                          <View className="flex-row flex-wrap gap-3">
                            {message.sharedPost.distance !== undefined && (
                              <View className="flex-row items-center">
                                <Ionicons name="resize-outline" size={14} color="#10b981" />
                                <Text className="text-gray-700 font-medium ml-1 text-xs">
                                  {formatDistance(message.sharedPost.distance)}
                                </Text>
                              </View>
                            )}
                            {message.sharedPost.elevationGain !== undefined && (
                              <View className="flex-row items-center">
                                <Ionicons name="trending-up-outline" size={14} color="#10b981" />
                                <Text className="text-gray-700 font-medium ml-1 text-xs">
                                  {Math.round(message.sharedPost.elevationGain)}m
                                </Text>
                              </View>
                            )}
                            {message.sharedPost.time !== undefined && (
                              <View className="flex-row items-center">
                                <Ionicons name="time-outline" size={14} color="#10b981" />
                                <Text className="text-gray-700 font-medium ml-1 text-xs">
                                  {formatTime(message.sharedPost.time)}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Timestamp */}
                      <View className="px-3 py-2 border-t border-gray-200">
                        <Text className="text-xs text-gray-500">
                          {formatDate(message.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ) : message.text ? (
                    // Text Message
                    <View
                      className={`rounded-lg px-3 py-2 max-w-xs ${
                        isCurrentUser
                          ? 'bg-green-500'
                          : 'bg-gray-200'
                      }`}
                    >
                      <Text className={isCurrentUser ? 'text-white' : 'text-gray-900'}>
                        {message.text}
                      </Text>
                      <Text
                        className={`text-xs mt-1 ${
                          isCurrentUser ? 'text-green-100' : 'text-gray-600'
                        }`}
                      >
                        {formatDate(message.createdAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Input Area - Coming Soon */}
      <View className="px-4 py-3 border-t border-gray-200 bg-white">
        <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
          <TextInput
            placeholder="Type a message..."
            className="flex-1 text-gray-900"
            placeholderTextColor="#9CA3AF"
            editable={false}
          />
          <TouchableOpacity disabled>
            <Ionicons name="send" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-gray-500 text-center mt-2">
          Messaging coming soon
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

export default MessageScreen;
