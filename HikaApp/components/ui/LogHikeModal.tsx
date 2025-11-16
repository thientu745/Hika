import React, { useState } from 'react';
import { View, Text, TextInput, Modal, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { createPost, addTrailToList, updateUserStatsFromHike } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import type { Trail } from '../../types';

interface LogHikeModalProps {
  visible: boolean;
  onClose: () => void;
  trail: Trail;
  onSuccess?: () => void;
}

export const LogHikeModal: React.FC<LogHikeModalProps> = ({
  visible,
  onClose,
  trail,
  onSuccess,
}) => {
  const { user, userProfile } = useAuth();
  const [useAutoStats, setUseAutoStats] = useState(true);
  const [distance, setDistance] = useState('');
  const [elevationGain, setElevationGain] = useState('');
  const [time, setTime] = useState('');
  const [hikeDate, setHikeDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse date from input
  const parseDateInput = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const handleDateChange = (dateString: string) => {
    if (dateString) {
      const newDate = parseDateInput(dateString);
      if (!isNaN(newDate.getTime())) {
        setHikeDate(newDate);
      }
    }
  };

  const handleSubmit = async () => {
    if (!user || !userProfile) {
      setError('You must be logged in to log a hike');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Calculate distance and elevation
      let finalDistance: number | undefined;
      let finalElevationGain: number | undefined;
      let finalTime: number | undefined;

      if (useAutoStats) {
        // Use trail values if they exist and are valid numbers
        if (trail.distance !== undefined && trail.distance !== null && trail.distance > 0) {
          finalDistance = trail.distance;
        }
        if (trail.elevationGain !== undefined && trail.elevationGain !== null && trail.elevationGain >= 0) {
          finalElevationGain = trail.elevationGain;
        }
      } else {
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

      // Parse time input (in hours, convert to seconds) - always manual
      if (time.trim()) {
        const timeValue = parseFloat(time);
        if (!isNaN(timeValue) && timeValue > 0) {
          finalTime = timeValue * 3600; // Convert hours to seconds
        }
      }

      // Create post with hike data
      // Build post object, only including distance and elevationGain if they have values
      const postData: any = {
        userId: user.uid,
        userDisplayName: userProfile.displayName || (user.displayName || 'User'),
        userProfilePictureUrl: userProfile.profilePictureUrl || '',
        trailId: trail.id,
        trailName: trail.name,
        location: trail.location,
        images: [],
        description: description.trim() || `Completed ${trail.name}`,
      };

      // Only add distance, elevationGain, and time if they are defined
      if (finalDistance !== undefined && finalDistance !== null) {
        postData.distance = finalDistance;
      }
      if (finalElevationGain !== undefined && finalElevationGain !== null) {
        postData.elevationGain = finalElevationGain;
      }
      if (finalTime !== undefined && finalTime !== null) {
        postData.time = finalTime;
      }

      await createPost(
        postData,
        {
          createdAt: hikeDate,
          updatedAt: hikeDate,
        }
      );

      // Update user stats
      if (user) {
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

      // Add trail to completed list
      if (user) {
        try {
          await addTrailToList(user.uid, trail.id, 'completed');
        } catch (e) {
          console.warn('Failed to add trail to completed list:', e);
          // Don't fail the post creation if this fails
        }
      }

      // Reset form
      setDescription('');
      setDistance('');
      setElevationGain('');
      setTime('');
      setHikeDate(new Date());
      setUseAutoStats(true);
      setError(null);

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (e) {
      console.error('Failed to log hike:', e);
      setError('Failed to log hike. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDistance = (meters: number): string => {
    if (!meters || meters === 0) return '0m';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            nestedScrollEnabled={true}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-900">Log Hike</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View className="px-4 py-6">
              {/* Trail Info */}
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-2">{trail.name}</Text>
                <View className="flex-row items-center">
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{trail.location}</Text>
                </View>
              </View>

              {/* Date Selection */}
              <View className="mb-6">
                <Text className="text-base font-medium text-gray-900 mb-2">Hike Date</Text>
                {Platform.OS === 'web' ? (
                  <TextInput
                    type="date"
                    value={formatDateInput(hikeDate)}
                    onChangeText={handleDateChange}
                    className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                    max={formatDateInput(new Date())}
                  />
                ) : (
                  <View>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(!showDatePicker)}
                      className="border border-gray-300 rounded-lg px-4 py-3 flex-row items-center justify-between"
                    >
                      <Text className="text-gray-900">{formatDate(hikeDate)}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <View className="mt-2">
                        <TextInput
                          value={formatDateInput(hikeDate)}
                          onChangeText={handleDateChange}
                          className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                          placeholder="YYYY-MM-DD"
                          keyboardType="numeric"
                        />
                        <Text className="text-xs text-gray-500 mt-1">Enter date as YYYY-MM-DD</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Stats Toggle */}
              <View className="mb-6">
                <Text className="text-base font-medium text-gray-900 mb-3">Distance & Elevation</Text>
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
                  <View className="bg-gray-50 rounded-lg p-4">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-sm text-gray-600">Distance</Text>
                      <Text className="text-base font-semibold text-gray-900">
                        {formatDistance(trail.distance)}
                      </Text>
                    </View>
                    {trail.elevationGain !== undefined && trail.elevationGain !== null && (
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm text-gray-600">Elevation Gain</Text>
                        <Text className="text-base font-semibold text-gray-900">
                          {Math.round(trail.elevationGain)}m
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

              {/* Description */}
              <View className="mb-6">
                <Text className="text-base font-medium text-gray-900 mb-2">Description (Optional)</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  placeholder="Share your experience on this hike..."
                  className="border border-gray-300 rounded-lg px-4 py-3 min-h-[100px] text-gray-900"
                  textAlignVertical="top"
                />
              </View>

              {/* Error Message */}
              {error && (
                <View className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <Text className="text-red-700 text-sm">{error}</Text>
                </View>
              )}

              {/* Submit Button */}
              <Button
                title="Log Hike"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting}
                className="w-full"
              />
            </View>
            </ScrollView>
          <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Platform.OS === 'web' ? '90%' : '85%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  safeAreaBottom: {
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    maxHeight: Platform.OS === 'web' ? undefined : '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  manualInputContainer: {
    // gap handled by marginBottom on children
  },
  inputGroup: {
    marginBottom: 16,
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
});

export default LogHikeModal;

