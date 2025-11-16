import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import ActiveTrailMap from '../components/maps/ActiveTrailMap';
import { useAuth } from '../contexts/AuthContext';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: Date;
  accuracy?: number; // GPS accuracy in meters
  speed?: number; // Speed in m/s
}

const TrackScreen = () => {
  const router = useRouter();
  const { trailId, trailName } = useLocalSearchParams<{ trailId?: string; trailName?: string }>();
  const { user } = useAuth();

  useEffect(() => {
    console.log('TrackScreen mounted, trailId:', trailId, 'trailName:', trailName);
  }, [trailId, trailName]);

  const [isTracking, setIsTracking] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [path, setPath] = useState<LocationPoint[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [distance, setDistance] = useState(0); // in meters
  const [elevationGain, setElevationGain] = useState(0); // in meters
  const [isPaused, setIsPaused] = useState(false);

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<LocationPoint | null>(null);
  const lastElevationRef = useRef<number | null>(null);
  const isPausedRef = useRef(false);
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // For elevation smoothing (moving average)
  const elevationHistoryRef = useRef<number[]>([]);
  const MAX_ELEVATION_HISTORY = 5; // Keep last 5 elevation readings for smoothing

  // Request location permissions on mount
  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to track your trail. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
            { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationPermission(false);
    }
  };

  // Calculate 2D distance between two coordinates (Haversine formula)
  const calculateDistance2D = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate 3D distance (accounting for elevation change)
  const calculateDistance3D = (
    lat1: number,
    lon1: number,
    alt1: number | null,
    lat2: number,
    lon2: number,
    alt2: number | null
  ): number => {
    const horizontalDistance = calculateDistance2D(lat1, lon1, lat2, lon2);
    
    // If we have altitude data, calculate 3D distance
    if (alt1 !== null && alt2 !== null && alt1 !== undefined && alt2 !== undefined) {
      const verticalDistance = Math.abs(alt2 - alt1);
      // Pythagorean theorem for 3D distance
      return Math.sqrt(horizontalDistance * horizontalDistance + verticalDistance * verticalDistance);
    }
    
    return horizontalDistance;
  };

  // Smooth elevation using moving average
  const smoothElevation = (elevation: number | null | undefined): number | null => {
    if (elevation === null || elevation === undefined) {
      return null;
    }

    elevationHistoryRef.current.push(elevation);
    
    // Keep only last N readings
    if (elevationHistoryRef.current.length > MAX_ELEVATION_HISTORY) {
      elevationHistoryRef.current.shift();
    }

    // Calculate average
    const sum = elevationHistoryRef.current.reduce((a, b) => a + b, 0);
    return sum / elevationHistoryRef.current.length;
  };

  // Check if GPS reading is valid (filters out bad readings)
  const isValidLocation = (
    location: Location.LocationObject,
    lastLocation: LocationPoint | null
  ): boolean => {
    // Check accuracy - reject readings with accuracy worse than 100 meters (more lenient)
    if (location.coords.accuracy && location.coords.accuracy > 100) {
      console.log('Rejected: Poor accuracy', location.coords.accuracy);
      return false;
    }

    // Check for unrealistic speed jumps (more than 50 m/s = 180 km/h)
    if (lastLocation && location.coords.speed !== null && location.coords.speed !== undefined) {
      if (location.coords.speed > 50) {
        console.log('Rejected: Unrealistic speed', location.coords.speed);
        return false; // Unrealistic speed for hiking
      }

      // Check for unrealistic position jumps (only if we have a last location)
      if (lastLocation.latitude && lastLocation.longitude) {
        const distance = calculateDistance2D(
          lastLocation.latitude,
          lastLocation.longitude,
          location.coords.latitude,
          location.coords.longitude
        );
        
        // More lenient: Allow larger jumps if speed is reasonable
        // If speed is available, check if the distance makes sense
        // Allow up to 15 m/s (54 km/h) which is reasonable for cycling
        const maxDistance = (location.coords.speed || 15) * 5; // 5 seconds max (more lenient)
        if (distance > maxDistance && distance > 100) { // Only reject if > 100m jump
          console.log('Rejected: Unrealistic position jump', distance, 'max allowed:', maxDistance);
          return false; // Unrealistic jump
        }
      }
    }

    return true;
  };

  const startTracking = async () => {
    if (locationPermission !== true) {
      await requestLocationPermission();
      if (locationPermission !== true) return;
    }

    try {
      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      // Initialize elevation history with first reading
      const rawAltitude = location.coords.altitude || null;
      if (rawAltitude !== null) {
        elevationHistoryRef.current = [rawAltitude];
      }

      const initialPoint: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: rawAltitude || undefined,
        timestamp: new Date(),
        accuracy: location.coords.accuracy || undefined,
        speed: location.coords.speed || undefined,
      };

      setCurrentLocation(initialPoint);
      setPath([initialPoint]);
      const now = new Date();
      setStartTime(now);
      setElapsedTime(0);
      setDistance(0);
      setElevationGain(0);
      setIsTracking(true);
      setIsPaused(false);
      isPausedRef.current = false;
      lastLocationRef.current = initialPoint;
      lastElevationRef.current = rawAltitude;
      // Timer will be started by useEffect when startTime and isTracking change

      // Start watching location with more frequent updates
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every 1 second for better battery life
          distanceInterval: 0, // Update on every location change (no minimum distance)
        },
        (location) => {
          if (!isPausedRef.current) {
            // Always update current location for map display, even if validation fails
            const newPoint: LocationPoint = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude || undefined,
              timestamp: new Date(),
              accuracy: location.coords.accuracy || undefined,
              speed: location.coords.speed || undefined,
            };
            
            // Always update current location for map display
            setCurrentLocation(newPoint);
            
            // Validate GPS reading for distance/path tracking
            if (!isValidLocation(location, lastLocationRef.current)) {
              // Still update lastLocationRef for next validation, but don't accumulate distance
              lastLocationRef.current = newPoint;
              return; // Skip invalid readings for distance tracking
            }

            // Smooth elevation if available
            const rawAltitude = location.coords.altitude || null;
            const smoothedAltitude = smoothElevation(rawAltitude);

            // Update the point with smoothed elevation
            newPoint.altitude = smoothedAltitude || undefined;

            if (lastLocationRef.current) {
              // Calculate 3D distance (more accurate)
              const segmentDistance = calculateDistance3D(
                lastLocationRef.current.latitude,
                lastLocationRef.current.longitude,
                lastLocationRef.current.altitude || null,
                newPoint.latitude,
                newPoint.longitude,
                newPoint.altitude || null
              );

              // Always accumulate distance for all valid location updates
              // This ensures distance updates even for small movements
              if (segmentDistance > 0) {
                setDistance((prev) => prev + segmentDistance);
              }

              // Only add point if it's at least 2 meters away (to reduce noise while keeping smooth path)
              if (segmentDistance >= 2) {
                setPath((prev) => [...prev, newPoint]);

                // Calculate elevation gain with smoothing and threshold
                if (
                  newPoint.altitude !== undefined &&
                  lastElevationRef.current !== null &&
                  newPoint.altitude > lastElevationRef.current
                ) {
                  const gain = newPoint.altitude - lastElevationRef.current;
                  // Only count elevation gain if it's significant (at least 1 meter)
                  // This filters out GPS noise in altitude readings
                  if (gain >= 1) {
                    setElevationGain((prev) => prev + gain);
                    lastElevationRef.current = newPoint.altitude;
                  }
                } else if (newPoint.altitude !== undefined) {
                  // Update elevation reference even if no gain
                  lastElevationRef.current = newPoint.altitude;
                }
              } else if (newPoint.altitude !== undefined && lastElevationRef.current !== null) {
                // Update elevation reference even if we don't add the point to path
                // This ensures elevation tracking continues for small movements
                if (newPoint.altitude > lastElevationRef.current) {
                  const gain = newPoint.altitude - lastElevationRef.current;
                  if (gain >= 1) {
                    setElevationGain((prev) => prev + gain);
                    lastElevationRef.current = newPoint.altitude;
                  }
                } else {
                  lastElevationRef.current = newPoint.altitude;
                }
              }

              lastLocationRef.current = newPoint;
            } else {
              lastLocationRef.current = newPoint;
              if (newPoint.altitude !== undefined) {
                lastElevationRef.current = newPoint.altitude;
                // Initialize elevation history
                elevationHistoryRef.current = [newPoint.altitude];
              }
            }
          }
        }
      );
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking. Please try again.');
    }
  };

  const pauseTracking = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    // Pause the timer
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  };

  const resumeTracking = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    // Resume the timer - the useEffect will handle restarting it
  };

  const stopTracking = () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    // Stop the timer
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
    setIsTracking(false);
    setIsPaused(false);
    isPausedRef.current = false;

    // Navigate to post creation screen with tracking data
    if (path.length > 0) {
      router.push({
        pathname: '/create-post-from-tracking',
        params: {
          trailId: trailId || '',
          trailName: trailName || '', // Pass custom trail name if provided
          timeElapsed: elapsedTime.toString(),
          distance: distance.toString(),
          elevationGain: elevationGain.toString(),
          path: JSON.stringify(path),
        },
      } as any);
    } else {
      // If no path was recorded, just go back
      router.back();
    }
  };

  const resetTracking = () => {
    Alert.alert(
      'Reset Tracking',
      'Are you sure you want to reset? This will clear all tracking data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            stopTracking();
            setPath([]);
            setCurrentLocation(null);
            setDistance(0);
            setElevationGain(0);
            setStartTime(null);
            setElapsedTime(0);
            lastLocationRef.current = null;
            lastElevationRef.current = null;
            elevationHistoryRef.current = [];
            isPausedRef.current = false;
            if (timeIntervalRef.current) {
              clearInterval(timeIntervalRef.current);
              timeIntervalRef.current = null;
            }
          },
        },
      ]
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, []);

  // Update elapsed time when startTime changes
  useEffect(() => {
    if (startTime && isTracking && !isPaused) {
      // Clear any existing interval
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
      // Start new interval
      timeIntervalRef.current = setInterval(() => {
        if (!isPausedRef.current && startTime) {
          setElapsedTime((new Date().getTime() - startTime.getTime()) / 1000);
        }
      }, 100); // Update every 100ms for smooth UI
    } else if (!isTracking || isPaused) {
      // Clear interval when not tracking or paused
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }
    }
    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [startTime, isTracking, isPaused]);

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

  // elapsedTime is now managed by state and updated via interval

  if (locationPermission === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#516D58' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>Requesting location permission...</Text>
        </View>
      </View>
    );
  }

  if (locationPermission === false) {
    return (
      <View style={{ flex: 1, backgroundColor: '#516D58' }}>
        <View style={{
          backgroundColor: '#516D58',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 }}>Track Trail</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}>
            <Ionicons name="location-outline" size={64} color="#EF4444" />
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
              Location Permission Required
            </Text>
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Please enable location permissions in your device settings to track your trail.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#92C59F',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 12,
                shadowColor: '#92C59F',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPress={requestLocationPermission}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Request Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#516D58' }}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={{
        backgroundColor: '#516D58',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 }}>
          {trailName || (trailId ? 'Track Trail' : 'New Hike')}
        </Text>
        {isTracking && (
          <TouchableOpacity onPress={resetTracking} style={{ padding: 4 }} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        )}
        {!isTracking && <View style={{ width: 24 }} />}
      </View>

      {/* Map - Only show when tracking has started */}
      {isTracking && (
        <View style={{
          height: 400,
          backgroundColor: '#E8F5E9',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}>
          <ActiveTrailMap
            path={path}
            currentLocation={currentLocation || undefined}
            height={400}
          />
        </View>
      )}

      {/* Initial Welcome State */}
      {!isTracking && (
        <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 16,
            elevation: 4,
            width: '100%',
            maxWidth: 400,
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#F0FDF4',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}>
              <Ionicons name="location" size={40} color="#92C59F" />
            </View>
            <Text style={{ 
              fontSize: 24, 
              fontWeight: '800', 
              color: '#111827', 
              marginBottom: 12,
              textAlign: 'center',
            }}>
              Ready to Track
            </Text>
            <Text style={{ 
              fontSize: 16, 
              color: '#6B7280', 
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 32,
            }}>
              Press the button below to start tracking your hike.
            </Text>
            
            {/* Stats Preview */}
            <View style={{
              width: '100%',
              backgroundColor: '#F9FAFB',
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#6B7280',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                Stats will appear here
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Ionicons name="time-outline" size={20} color="#9CA3AF" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#D1D5DB', marginTop: 6 }}>0:00</Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Time</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Ionicons name="resize-outline" size={20} color="#9CA3AF" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#D1D5DB', marginTop: 6 }}>0m</Text>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Distance</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Stats - Only show when tracking */}
      {isTracking && (
        <View style={{
          backgroundColor: '#FFFFFF',
          paddingVertical: 20,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="time-outline" size={24} color="#516D58" />
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 }}>{formatTime(elapsedTime)}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Time</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="resize-outline" size={24} color="#516D58" />
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 }}>{formatDistance(distance)}</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Distance</Text>
            </View>
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={{
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingBottom: 32,
      }}>
        {!isTracking ? (
          <TouchableOpacity
            style={{
              backgroundColor: '#4ADE80',
              borderRadius: 12,
              paddingVertical: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#4ADE80',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={startTracking}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={28} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 12 }}>Start Tracking</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {isPaused ? (
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#4ADE80',
                  borderRadius: 12,
                  paddingVertical: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#4ADE80',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 6,
                }}
                onPress={resumeTracking}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={28} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 12 }}>Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F59E0B',
                  borderRadius: 12,
                  paddingVertical: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#F59E0B',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
                onPress={pauseTracking}
                activeOpacity={0.8}
              >
                <Ionicons name="pause" size={28} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 12 }}>Pause</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#EF4444',
                borderRadius: 12,
                paddingVertical: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPress={stopTracking}
              activeOpacity={0.8}
            >
              <Ionicons name="stop" size={28} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 12 }}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  resetButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  mapContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  controlsContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  pauseButton: {
    backgroundColor: '#F59E0B',
  },
  resumeButton: {
    backgroundColor: '#10b981',
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  trackingControls: {
    flexDirection: 'row',
    gap: 12,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TrackScreen;

