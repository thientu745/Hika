import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { addComment, getPost } from '../../services/database';
import type { Post, Comment } from '../../types';

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
  const { user, userProfile } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post>(post);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPost();
    }
  }, [visible, post.id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const updatedPost = await getPost(post.id);
      if (updatedPost) {
        setCurrentPost(updatedPost);
      }
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
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
        <View className="flex-1 bg-black bg-opacity-50">
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[90vh]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">Comments</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <ScrollView className="flex-1 px-4 py-4">
              {loading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : !currentPost.comments || currentPost.comments.length === 0 ? (
                <View className="py-16 items-center">
                  <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                  <Text className="text-gray-500 mt-3 text-center">
                    No comments yet. Be the first to comment!
                  </Text>
                </View>
              ) : (
                currentPost.comments.map((comment: Comment) => (
                  <View key={comment.id} className="mb-4 flex-row">
                    {comment.userProfilePictureUrl ? (
                      <Image
                        source={{ uri: comment.userProfilePictureUrl }}
                        className="w-8 h-8 rounded-full mr-3"
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
                ))
              )}
            </ScrollView>

            {/* Comment Input */}
            <View className="px-4 py-4 border-t border-gray-200 bg-white">
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CommentModal;

