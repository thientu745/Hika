import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { createPost, getTrail, addTrailToList, updateUserStatsFromHike } from '../services/database';
import ActiveTrailMap from '../components/maps/ActiveTrailMap';
import { HikeCelebrationModal } from '../components/ui/HikeCelebrationModal';
import type { LocationPoint } from './track';

interface TrackingData {
  trailId?: string;
  trailName?: string;
  timeElapsed: number; // in seconds
  distance: number; // in meters
  elevationGain: number; // in meters
  path: LocationPoint[];
}

const CreatePostFromTracking = () => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const params = useLocalSearchParams<{
    trailId?: string;
    trailName?: string;
    timeElapsed?: string;
    distance?: string;
    elevationGain?: string;
    path?: string;
  }>();

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trailName, setTrailName] = useState(params.trailName || '');
  const [trailLocation, setTrailLocation] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  
  // If we have a custom trail name but no trailId, use the custom name
  const displayTrailName = trailName || params.trailName || 'Unknown Trail';

  // Parse tracking data from params
  const timeElapsed = params.timeElapsed ? parseFloat(params.timeElapsed) : 0;
  const distance = params.distance ? parseFloat(params.distance) : 0;
  const elevationGain = params.elevationGain ? parseFloat(params.elevationGain) : 0;
  
  // Parse path - convert timestamp strings back to Date objects if needed
  let path: LocationPoint[] = [];
  if (params.path) {
    try {
      const parsedPath = JSON.parse(params.path);
      path = parsedPath.map((point: any) => ({
        ...point,
        timestamp: point.timestamp ? new Date(point.timestamp) : new Date(),
      }));
    } catch (error) {
      console.error('Error parsing path:', error);
      path = [];
    }
  }

  useEffect(() => {
    loadTrailInfo();
  }, [params.trailId, params.trailName]);

  const loadTrailInfo = async () => {
    // If we have a custom trail name but no trailId, use the custom name
    if (!params.trailId) {
      if (params.trailName) {
        setTrailName(params.trailName);
      }
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const trail = await getTrail(params.trailId);
      if (trail) {
        setTrailName(trail.name);
        setTrailLocation(trail.location);
      } else if (params.trailName) {
        // Fallback to custom name if trail not found
        setTrailName(params.trailName);
      }
    } catch (error) {
      console.error('Error loading trail:', error);
      // Fallback to custom name on error
      if (params.trailName) {
        setTrailName(params.trailName);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const handleSubmit = async () => {
    if (!user || !userProfile) {
      Alert.alert('Error', 'You must be logged in to create a post.');
      return;
    }

    // Allow posts with either trailId or trailName (for custom hikes)
    if (!params.trailId && !displayTrailName) {
      Alert.alert('Error', 'Trail information is missing.');
      return;
    }

    setSubmitting(true);

    try {
      // Build post object, only including stats if they have valid values
      const postData: any = {
        userId: user.uid,
        userDisplayName: userProfile.displayName || (user.displayName || 'User'),
        userProfilePictureUrl: userProfile.profilePictureUrl || '',
        trailId: params.trailId || '',
        trailName: displayTrailName,
        location: trailLocation || '',
        images: [],
        description: description.trim() || `Completed ${displayTrailName}`,
      };

      // Only add stats if they have valid values (Firebase doesn't allow undefined)
      if (distance > 0) {
        postData.distance = distance;
      }
      if (timeElapsed > 0) {
        postData.time = timeElapsed;
      }
      if (elevationGain > 0) {
        postData.elevationGain = elevationGain;
      }
      
      // Add the traveled path (GPS tracking data) - convert to format suitable for Firestore
      if (path && path.length > 0) {
        postData.path = path.map((point) => {
          const pathPoint: any = {
            latitude: point.latitude,
            longitude: point.longitude,
          };
          // Only include altitude if it's defined
          if (point.altitude !== undefined && point.altitude !== null) {
            pathPoint.altitude = point.altitude;
          }
          // Convert timestamp to Firestore Timestamp format (will be converted in createPost)
          if (point.timestamp) {
            pathPoint.timestamp = point.timestamp instanceof Date ? point.timestamp : new Date(point.timestamp);
          }
          return pathPoint;
        });
      }

      await createPost(postData);

      // Calculate XP gained before updating stats
      let calculatedXpGained = 10; // Base XP for completing a hike
      if (distance > 0) {
        calculatedXpGained += Math.floor(distance / 100);
      }
      if (timeElapsed > 0) {
        calculatedXpGained += Math.floor(timeElapsed / 600);
      }
      if (elevationGain > 0) {
        calculatedXpGained += Math.floor(elevationGain / 10);
      }

      // Update user stats
      if (distance > 0 || timeElapsed > 0 || elevationGain > 0) {
        try {
          await updateUserStatsFromHike(
            user.uid,
            distance > 0 ? distance : undefined,
            timeElapsed > 0 ? timeElapsed : undefined,
            elevationGain > 0 ? elevationGain : undefined
          );
          // Show celebration modal after successful update
          setXpGained(calculatedXpGained);
          setShowCelebration(true);
        } catch (e) {
          console.warn('Failed to update user stats:', e);
          // Still show success alert if stats update fails
          Alert.alert('Success', 'Post created successfully!', [
            {
              text: 'OK',
              onPress: () => {
                router.back();
                router.back(); // Go back twice to return to the trail detail or home
              },
            },
          ]);
        }
      } else {
        // If no stats, just show success alert
        Alert.alert('Success', 'Post created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              router.back();
              router.back(); // Go back twice to return to the trail detail or home
            },
          },
        ]);
      }

      // Add trail to completed list (only if we have a trailId)
      if (params.trailId) {
        try {
          await addTrailToList(user.uid, params.trailId, 'completed');
        } catch (e) {
          console.warn('Failed to add trail to completed list:', e);
        }
      }
      // Note: Custom hikes without trailId won't be added to completed list
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading trail information...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Trail Info */}
        <View style={styles.trailInfoContainer}>
          <Text style={styles.trailName}>{displayTrailName}</Text>
          {trailLocation ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#6B7280" />
              <Text style={styles.locationText}>{trailLocation}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={24} color="#10b981" />
            <Text style={styles.statValue}>{formatTime(timeElapsed)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="resize-outline" size={24} color="#10b981" />
            <Text style={styles.statValue}>{formatDistance(distance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trending-up-outline" size={24} color="#10b981" />
            <Text style={styles.statValue}>{Math.round(elevationGain)}m</Text>
            <Text style={styles.statLabel}>Elevation</Text>
          </View>
        </View>

        {/* Map */}
        {path.length > 0 && (
          <View style={styles.mapContainer}>
            <Text style={styles.sectionTitle}>Your Path</Text>
            <ActiveTrailMap
              path={path}
              currentLocation={path[path.length - 1] || undefined}
              height={300}
            />
          </View>
        )}

        {/* Description Input */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Add a Description</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Share your experience..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Create Post</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Celebration Modal */}
      {user && (
        <HikeCelebrationModal
          visible={showCelebration}
          onClose={() => {
            setShowCelebration(false);
            router.back();
            router.back(); // Go back twice to return to the trail detail or home
          }}
          xpGained={xpGained}
          userId={user.uid}
          trailName={displayTrailName}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  trailInfoContainer: {
    marginBottom: 16,
  },
  trailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  mapContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CreatePostFromTracking;

