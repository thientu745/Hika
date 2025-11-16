import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { createPost, addTrailToList, updateUserStatsFromHike } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { searchTrailsFromFirestore } from '../../services/trailSearch';
import type { Trail } from '../../types';

interface Props {
  onPosted?: () => void;
}

export const PostComposer: React.FC<Props> = ({ onPosted }) => {
  const { user, userProfile } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showTrailSearch, setShowTrailSearch] = useState(false);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [trailSearchQuery, setTrailSearchQuery] = useState('');
  const [trailSearchResults, setTrailSearchResults] = useState<Trail[]>([]);
  const [searchingTrails, setSearchingTrails] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Stats state
  const [useAutoStats, setUseAutoStats] = useState(true);
  const [distance, setDistance] = useState('');
  const [elevationGain, setElevationGain] = useState('');
  const [time, setTime] = useState(''); // in hours

  // Debounced trail search - only searches Firestore database, no API calls
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
        // Only searches Firestore - does not call Overpass API
        const results = await searchTrailsFromFirestore(trailSearchQuery.trim(), undefined, undefined, 10);
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

  const handleRemoveTrail = () => {
    setSelectedTrail(null);
    setUseAutoStats(true);
    setDistance('');
    setElevationGain('');
    setTime('');
  };

  const formatDistance = (meters: number): string => {
    if (!meters || meters === 0) return '0m';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const handleSubmit = async () => {
    if (!user || !userProfile) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      // Calculate distance, elevation, and time
      let finalDistance: number | undefined;
      let finalElevationGain: number | undefined;
      let finalTime: number | undefined;

      if (selectedTrail && useAutoStats) {
        // Use trail values if they exist and are valid numbers
        if (selectedTrail.distance !== undefined && selectedTrail.distance !== null && selectedTrail.distance > 0) {
          finalDistance = selectedTrail.distance;
        }
        if (selectedTrail.elevationGain !== undefined && selectedTrail.elevationGain !== null && selectedTrail.elevationGain >= 0) {
          finalElevationGain = selectedTrail.elevationGain;
        }
      } else if (selectedTrail && !useAutoStats) {
        // Parse manual inputs
        if (distance.trim()) {
          const distValue = parseFloat(distance);
          if (!isNaN(distValue) && distValue > 0) {
            // Assume input is in kilometers, convert to meters
            finalDistance = distValue * 1000;
          }
        }
        if (elevationGain.trim()) {
          const elevValue = parseFloat(elevationGain);
          if (!isNaN(elevValue) && elevValue >= 0) {
            finalElevationGain = elevValue;
          }
        }
      }

      // Parse time input (in hours, convert to seconds)
      if (time.trim()) {
        const timeValue = parseFloat(time);
        if (!isNaN(timeValue) && timeValue > 0) {
          finalTime = timeValue * 3600; // Convert hours to seconds
        }
      }

      // Build post object, only including stats if they have values
      const postData: any = {
        userId: user.uid,
        userDisplayName: userProfile.displayName || (user.displayName || 'User'),
        userProfilePictureUrl: userProfile.profilePictureUrl || '',
        trailId: selectedTrail?.id || '',
        trailName: selectedTrail?.name || '',
        location: selectedTrail?.location || '',
        images: [],
        description: trimmed,
      };

      // Only add stats if they are defined
      if (finalDistance !== undefined && finalDistance !== null) {
        postData.distance = finalDistance;
      }
      if (finalElevationGain !== undefined && finalElevationGain !== null) {
        postData.elevationGain = finalElevationGain;
      }
      if (finalTime !== undefined && finalTime !== null) {
        postData.time = finalTime;
      }

      await createPost(postData);

      // Update user stats if a trail was selected (stats section only appears when trail is selected)
      if (user && selectedTrail?.id) {
        try {
          await updateUserStatsFromHike(
            user.uid,
            finalDistance,
            finalTime,
            finalElevationGain
          );
        } catch (e) {
          console.warn('Failed to update user stats:', e);
          // Don't fail the post creation if this fails
        }
      }

      // Add trail to completed list if a trail was selected
      if (selectedTrail?.id && user) {
        try {
          await addTrailToList(user.uid, selectedTrail.id, 'completed');
        } catch (e) {
          console.warn('Failed to add trail to completed list:', e);
          // Don't fail the post creation if this fails
        }
      }

      // Reset form
      setText('');
      setSelectedTrail(null);
      setUseAutoStats(true);
      setDistance('');
      setElevationGain('');
      setTime('');
      if (onPosted) onPosted();
    } catch (e) {
      console.warn('Failed to create post', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
      <Text className="text-gray-900 font-medium mb-3">Create Post</Text>
      
      {/* Selected Trail Display */}
      {selectedTrail && (
        <View className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center">
                <Ionicons name="trail-sign" size={18} color="#10b981" />
                <Text className="text-gray-900 font-semibold ml-2">{selectedTrail.name}</Text>
              </View>
              {selectedTrail.location && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text className="text-gray-600 text-sm ml-1">{selectedTrail.location}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={handleRemoveTrail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trail Search Toggle */}
      {!selectedTrail && (
        <TouchableOpacity
          onPress={() => setShowTrailSearch(!showTrailSearch)}
          className="mb-3 flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3"
        >
          <View className="flex-row items-center">
            <Ionicons name="trail-sign-outline" size={20} color="#6B7280" />
            <Text className="text-gray-700 font-medium ml-2">
              {showTrailSearch ? 'Hide Trail Search' : 'Add Trail (Optional)'}
            </Text>
          </View>
          <Ionicons 
            name={showTrailSearch ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#6B7280" 
          />
        </TouchableOpacity>
      )}

      {/* Trail Search */}
      {showTrailSearch && !selectedTrail && (
        <View className="mb-3">
          <TextInput
            value={trailSearchQuery}
            onChangeText={setTrailSearchQuery}
            placeholder="Search for a trail..."
            className="border border-gray-300 rounded-lg px-4 py-2 text-gray-900 mb-2"
          />
          {searchingTrails && (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          )}
          {trailSearchQuery.trim() && !searchingTrails && trailSearchResults.length > 0 && (
            <ScrollView className="max-h-48 border border-gray-200 rounded-lg bg-white">
              {trailSearchResults.map((trail) => (
                <TouchableOpacity
                  key={trail.id}
                  onPress={() => handleTrailSelect(trail)}
                  className="px-4 py-3 border-b border-gray-100"
                >
                  <Text className="text-gray-900 font-medium">{trail.name}</Text>
                  {trail.location && (
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="location" size={12} color="#6B7280" />
                      <Text className="text-gray-600 text-xs ml-1">{trail.location}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {trailSearchQuery.trim() && !searchingTrails && trailSearchResults.length === 0 && (
            <View className="py-4 items-center">
              <Text className="text-gray-500 text-sm">No trails found</Text>
            </View>
          )}
        </View>
      )}

      {/* Stats Section - Only show if trail is selected */}
      {selectedTrail && (
        <View className="mb-3">
          <Text className="text-base font-medium text-gray-900 mb-3">Hike Stats (Optional)</Text>
          
          {/* Stats Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              onPress={() => setUseAutoStats(true)}
              style={[
                styles.toggleButton,
                { flex: 1, marginRight: 6 },
                useAutoStats && styles.toggleButtonActive
              ]}
            >
              <Ionicons
                name={useAutoStats ? 'checkmark-circle' : 'radio-button-off'}
                size={20}
                color={useAutoStats ? '#10b981' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  useAutoStats && styles.toggleButtonTextActive
                ]}
              >
                Use Trail Stats
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setUseAutoStats(false)}
              style={[
                styles.toggleButton,
                { flex: 1, marginLeft: 6 },
                !useAutoStats && styles.toggleButtonActive
              ]}
            >
              <Ionicons
                name={!useAutoStats ? 'checkmark-circle' : 'radio-button-off'}
                size={20}
                color={!useAutoStats ? '#10b981' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  !useAutoStats && styles.toggleButtonTextActive
                ]}
              >
                Manual Input
              </Text>
            </TouchableOpacity>
          </View>

          {useAutoStats ? (
            <View className="bg-gray-50 rounded-lg p-4 mt-3">
              {selectedTrail.distance !== undefined && selectedTrail.distance !== null && selectedTrail.distance > 0 && (
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm text-gray-600">Distance</Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {formatDistance(selectedTrail.distance)}
                  </Text>
                </View>
              )}
              {selectedTrail.elevationGain !== undefined && selectedTrail.elevationGain !== null && (
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-600">Elevation Gain</Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {Math.round(selectedTrail.elevationGain)}m
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.manualInputContainer}>
              <View style={styles.inputGroup}>
                <Text className="text-sm text-gray-700 mb-2">Distance (km)</Text>
                <TextInput
                  value={distance}
                  onChangeText={setDistance}
                  placeholder="e.g., 5.2"
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text className="text-sm text-gray-700 mb-2">Elevation Gain (m)</Text>
                <TextInput
                  value={elevationGain}
                  onChangeText={setElevationGain}
                  placeholder="e.g., 500"
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                />
              </View>
            </View>
          )}

          {/* Time Input - Always manual */}
          <View style={styles.inputGroup}>
            <Text className="text-sm text-gray-700 mb-2">Time (hours, optional)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="e.g., 2.5"
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
            />
          </View>
        </View>
      )}

      {/* Description Input */}
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Share something about your hike..."
        className="border border-gray-200 rounded-lg p-3 min-h-[80px] text-gray-900"
        textAlignVertical="top"
      />
      
      <View className="mt-3 items-end">
        <Button title="Post" onPress={handleSubmit} loading={submitting} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  toggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10b981',
  },
  toggleButtonText: {
    marginLeft: 8,
    fontWeight: '500',
    color: '#374151',
  },
  toggleButtonTextActive: {
    color: '#047857',
  },
  manualInputContainer: {
    gap: 16,
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
});

export default PostComposer;
