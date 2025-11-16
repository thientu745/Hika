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
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updatePost, deletePost } from '../../services/database';
import { searchTrailsFromFirestore } from '../../services/trailSearch';
import type { Post, Trail } from '../../types';

interface EditPostModalProps {
  visible: boolean;
  post: Post;
  onClose: () => void;
  onUpdate?: (updatedPost: Post | null) => void; // null means deleted
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  visible,
  post,
  onClose,
  onUpdate,
}) => {
  const [description, setDescription] = useState(post.description || '');
  const [distance, setDistance] = useState(
    post.distance ? (post.distance / 1000).toFixed(2) : ''
  );
  const [elevationGain, setElevationGain] = useState(
    post.elevationGain ? post.elevationGain.toString() : ''
  );
  const [time, setTime] = useState(
    post.time ? (post.time / 3600).toFixed(2) : ''
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTrailSearch, setShowTrailSearch] = useState(false);
  const [trailSearchQuery, setTrailSearchQuery] = useState('');
  const [trailSearchResults, setTrailSearchResults] = useState<Trail[]>([]);
  const [searchingTrails, setSearchingTrails] = useState(false);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setDescription(post.description || '');
      setDistance(post.distance ? (post.distance / 1000).toFixed(2) : '');
      setElevationGain(post.elevationGain ? post.elevationGain.toString() : '');
      setTime(post.time ? (post.time / 3600).toFixed(2) : '');
      setSelectedTrail(null);
      setShowTrailSearch(false);
      setTrailSearchQuery('');
    }
  }, [visible, post]);

  // Debounced trail search
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (!trailSearchQuery.trim()) {
      setTrailSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        setSearchingTrails(true);
        const results = await searchTrailsFromFirestore(
          trailSearchQuery.trim(),
          undefined,
          undefined,
          10
        );
        setTrailSearchResults(results);
      } catch (e) {
        console.warn('Trail search error', e);
        setTrailSearchResults([]);
      } finally {
        setSearchingTrails(false);
      }
    }, 300);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [trailSearchQuery]);

  const handleTrailSelect = (trail: Trail) => {
    setSelectedTrail(trail);
    setShowTrailSearch(false);
    setTrailSearchQuery('');
    setTrailSearchResults([]);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Description cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        description: description.trim(),
      };

      // Update trail if changed
      if (selectedTrail) {
        updates.trailId = selectedTrail.id;
        updates.trailName = selectedTrail.name;
        updates.location = selectedTrail.location || '';
      }

      // Update stats
      if (distance.trim()) {
        const distValue = parseFloat(distance);
        if (!isNaN(distValue) && distValue > 0) {
          updates.distance = distValue * 1000; // Convert km to meters
        } else {
          updates.distance = null;
        }
      } else {
        updates.distance = null;
      }

      if (elevationGain.trim()) {
        const elevValue = parseFloat(elevationGain);
        if (!isNaN(elevValue) && elevValue >= 0) {
          updates.elevationGain = elevValue;
        } else {
          updates.elevationGain = null;
        }
      } else {
        updates.elevationGain = null;
      }

      if (time.trim()) {
        const timeValue = parseFloat(time);
        if (!isNaN(timeValue) && timeValue > 0) {
          updates.time = timeValue * 3600; // Convert hours to seconds
        } else {
          updates.time = null;
        }
      } else {
        updates.time = null;
      }

      await updatePost(post.id, updates);

      // Get updated post
      const updatedPost: Post = {
        ...post,
        ...updates,
        updatedAt: new Date(),
      };

      onUpdate?.(updatedPost);
      onClose();
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deletePost(post.id);
              onUpdate?.(null);
              onClose();
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
          <Text className="text-xl font-bold text-gray-900">Edit Post</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {/* Description */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Share something about your hike..."
              className="border border-gray-300 rounded-lg p-3 min-h-[100px] text-gray-900"
              textAlignVertical="top"
            />
          </View>

          {/* Trail Selection */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Trail (optional)
            </Text>
            {selectedTrail ? (
              <View className="bg-green-50 border border-green-200 rounded-lg p-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Ionicons name="trail-sign" size={18} color="#10b981" />
                      <Text className="text-gray-900 font-semibold ml-2">
                        {selectedTrail.name}
                      </Text>
                    </View>
                    {selectedTrail.location && (
                      <View className="flex-row items-center mt-1">
                        <Ionicons name="location" size={14} color="#6B7280" />
                        <Text className="text-gray-600 text-sm ml-1">
                          {selectedTrail.location}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedTrail(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowTrailSearch(!showTrailSearch)}
                className="border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
              >
                <Text className="text-gray-600">
                  {post.trailName || 'Search for a trail...'}
                </Text>
                <Ionicons
                  name={showTrailSearch ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}

            {showTrailSearch && !selectedTrail && (
              <View className="mt-2">
                <TextInput
                  value={trailSearchQuery}
                  onChangeText={setTrailSearchQuery}
                  placeholder="Search trails..."
                  className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 mb-2"
                />
                {searchingTrails ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color="#10b981" />
                  </View>
                ) : trailSearchResults.length > 0 ? (
                  <View className="border border-gray-200 rounded-lg max-h-48">
                    <ScrollView>
                      {trailSearchResults.map((trail) => (
                        <TouchableOpacity
                          key={trail.id}
                          onPress={() => handleTrailSelect(trail)}
                          className="px-4 py-3 border-b border-gray-100 last:border-b-0"
                        >
                          <Text className="text-gray-900 font-medium">
                            {trail.name}
                          </Text>
                          {trail.location && (
                            <Text className="text-gray-600 text-sm mt-1">
                              {trail.location}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : trailSearchQuery.trim() ? (
                  <Text className="text-gray-500 text-center py-4">
                    No trails found
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Stats</Text>
            <View style={styles.inputGroup}>
              <Text className="text-xs text-gray-600 mb-1">Distance (km)</Text>
              <TextInput
                value={distance}
                onChangeText={setDistance}
                placeholder="e.g., 5.2"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text className="text-xs text-gray-600 mb-1">
                Elevation Gain (m)
              </Text>
              <TextInput
                value={elevationGain}
                onChangeText={setElevationGain}
                placeholder="e.g., 500"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text className="text-xs text-gray-600 mb-1">Time (hours)</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="e.g., 2.5"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View className="px-4 py-4 border-t border-gray-200">
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 rounded-lg py-3 items-center"
            >
              {deleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">Delete</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-green-500 rounded-lg py-3 items-center"
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 12,
  },
});

export default EditPostModal;

