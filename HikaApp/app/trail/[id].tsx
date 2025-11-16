import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { getTrail } from '../../services/database';
import { Ionicons } from '@expo/vector-icons';
import TrailMap from '../../components/maps/TrailMap';
import type { Trail } from '../../types';

const TrailDetail = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && !authLoading) {
      loadTrail();
    }
  }, [id, authLoading]);

  const loadTrail = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const trailData = await getTrail(id);
      if (trailData) {
        setTrail(trailData);
      } else {
        setError('Trail not found');
      }
    } catch (err) {
      console.error('Error loading trail:', err);
      setError('Failed to load trail details');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <LoadingScreen message="Loading trail details..." variant="minimal" />;
  }

  if (error || !trail) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-4">
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text className="text-xl font-bold text-gray-900 mt-4 mb-2">
          {error || 'Trail not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-green-500 px-6 py-3 rounded-lg mt-4"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDistance = (meters: number): string => {
    if (!meters || meters === 0) return '0m';
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Hard':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Expert':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={16} color="#FBBF24" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={16} color="#FBBF24" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={16} color="#D1D5DB" />);
      }
    }
    return stars;
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 pt-2 pb-3 flex-row items-center" style={{ paddingTop: Platform.OS === 'ios' ? 8 : 16 }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 flex-1">Trail Details</Text>
      </View>

      <ScrollView className="flex-1">
        {/* Trail Image/Placeholder */}
        <View className="w-full h-64 bg-green-100 items-center justify-center">
          {trail.images && trail.images.length > 0 ? (
            <Image
              source={{ uri: trail.images[0] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="trail-sign" size={80} color="#10b981" />
          )}
        </View>

        <View className="px-4 py-6">
          {/* Trail Name and Location */}
          <View className="mb-4">
            <Text className="text-3xl font-bold text-gray-900 mb-2">{trail.name}</Text>
            <View className="flex-row items-center">
              <Ionicons name="location" size={18} color="#6B7280" />
              <Text className="text-base text-gray-600 ml-2">{trail.location}</Text>
            </View>
          </View>

          {/* Rating */}
          {trail.rating > 0 && trail.ratingCount > 0 && (
            <View className="flex-row items-center mb-4">
              <View className="flex-row items-center mr-2">
                {renderStars(trail.rating)}
              </View>
              <Text className="text-base text-gray-700 font-medium">
                {trail.rating.toFixed(1)} ({trail.ratingCount} {trail.ratingCount === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}

          {/* Difficulty Badge */}
          <View className="mb-4">
            <View className={`self-start px-4 py-2 rounded-full border ${getDifficultyColor(trail.difficulty)}`}>
              <Text className="font-semibold">{trail.difficulty}</Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View className="bg-gray-50 rounded-lg p-4 mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Trail Stats</Text>
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-3">
                <View className="flex-row items-center mb-1">
                  <Ionicons name="resize-outline" size={20} color="#10b981" />
                  <Text className="text-sm text-gray-600 ml-2">Distance</Text>
                </View>
                <Text className="text-xl font-bold text-gray-900">{formatDistance(trail.distance)}</Text>
              </View>

              {(trail.elevationGain !== undefined && trail.elevationGain !== null) && (
                <View className="w-1/2 mb-3">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="trending-up-outline" size={20} color="#10b981" />
                    <Text className="text-sm text-gray-600 ml-2">Elevation Gain</Text>
                  </View>
                  <Text className="text-xl font-bold text-gray-900">
                    {Math.round(trail.elevationGain)}m
                  </Text>
                </View>
              )}

              {(trail.elevationLoss !== undefined && trail.elevationLoss !== null && trail.elevationLoss > 0) && (
                <View className="w-1/2 mb-3">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="trending-down-outline" size={20} color="#10b981" />
                    <Text className="text-sm text-gray-600 ml-2">Elevation Loss</Text>
                  </View>
                  <Text className="text-xl font-bold text-gray-900">
                    {Math.round(trail.elevationLoss)}m
                  </Text>
                </View>
              )}

              {trail.path && trail.path.length > 0 && (
                <View className="w-1/2 mb-3">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="map-outline" size={20} color="#10b981" />
                    <Text className="text-sm text-gray-600 ml-2">Path Points</Text>
                  </View>
                  <Text className="text-xl font-bold text-gray-900">{trail.path.length}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Description</Text>
            <Text className="text-base text-gray-700 leading-6">
              {trail.description || 'No description available for this trail.'}
            </Text>
          </View>

          {/* Map */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Trail Map</Text>
            <TrailMap trail={trail} height={300} />
            <View className="mt-3 bg-gray-50 rounded-lg p-3">
              <Text className="text-sm text-gray-600 mb-1">Coordinates</Text>
              <Text className="text-base text-gray-900 font-mono">
                {trail.coordinates.latitude.toFixed(6)}, {trail.coordinates.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="space-y-3 mb-6">
            <TouchableOpacity
              className="bg-green-500 rounded-lg p-4 flex-row items-center justify-center"
              onPress={() => {
                // TODO: Start trail navigation
                console.log('Start trail:', trail.id);
              }}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold text-lg ml-2">Start Trail</Text>
            </TouchableOpacity>

            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3 flex-row items-center justify-center"
                onPress={() => {
                  // TODO: Add to wishlist
                  console.log('Add to wishlist:', trail.id);
                }}
              >
                <Ionicons name="heart-outline" size={20} color="#3B82F6" />
                <Text className="text-blue-600 font-medium ml-2">Wishlist</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 flex-row items-center justify-center"
                onPress={() => {
                  // TODO: Share trail
                  console.log('Share trail:', trail.id);
                }}
              >
                <Ionicons name="share-outline" size={20} color="#6B7280" />
                <Text className="text-gray-700 font-medium ml-2">Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrailDetail;

