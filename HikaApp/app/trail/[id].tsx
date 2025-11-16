import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, StatusBar, Alert, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { getTrail, addTrailToList, removeTrailFromList } from '../../services/database';
import { Ionicons } from '@expo/vector-icons';
import TrailMap from '../../components/maps/TrailMap';
import { LogHikeModal } from '../../components/ui/LogHikeModal';
import type { Trail } from '../../types';

const TrailDetail = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, userProfile, loading: authLoading, refreshUserProfile } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogHikeModal, setShowLogHikeModal] = useState(false);
  const [processingWishlist, setProcessingWishlist] = useState(false);
  const [processingFavorite, setProcessingFavorite] = useState(false);
  
  const isInWishlist = userProfile?.wishlist?.includes(id || '') || false;
  const isInFavorites = userProfile?.favorites?.includes(id || '') || false;

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
      <View style={{ flex: 1, backgroundColor: '#516D58', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
          {error || 'Trail not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: '#92C59F',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            marginTop: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Go Back</Text>
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

  const handleWishlistToggle = async () => {
    if (!user?.uid || !id) {
      Alert.alert('Please sign in', 'You need to be signed in to manage your wishlist');
      return;
    }

    if (processingWishlist) return;

    try {
      setProcessingWishlist(true);
      if (isInWishlist) {
        await removeTrailFromList(user.uid, id, 'wishlist');
        Alert.alert('Removed', 'Trail removed from wishlist');
      } else {
        await addTrailToList(user.uid, id, 'wishlist');
        Alert.alert('Added', 'Trail added to wishlist');
      }
      await refreshUserProfile();
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      Alert.alert('Error', 'Failed to update wishlist. Please try again.');
    } finally {
      setProcessingWishlist(false);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user?.uid || !id) {
      Alert.alert('Please sign in', 'You need to be signed in to manage your favorites');
      return;
    }

    if (processingFavorite) return;

    try {
      setProcessingFavorite(true);
      if (isInFavorites) {
        await removeTrailFromList(user.uid, id, 'favorites');
        Alert.alert('Removed', 'Trail removed from favorites');
      } else {
        await addTrailToList(user.uid, id, 'favorites');
        Alert.alert('Added', 'Trail added to favorites');
      }
      await refreshUserProfile();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorites. Please try again.');
    } finally {
      setProcessingFavorite(false);
    }
  };

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
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={{ marginRight: 16 }} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 }}>Trail Details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* Trail Image/Placeholder */}
        <View style={{ width: '100%', height: 250, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
          {trail.images && trail.images.length > 0 ? (
            <Image
              source={{ uri: trail.images[0] }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="trail-sign" size={80} color="#516D58" />
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {/* Trail Name and Location */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 }}>{trail.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location" size={18} color="#E5E7EB" />
              <Text style={{ fontSize: 16, color: '#E5E7EB', marginLeft: 8 }}>{trail.location}</Text>
            </View>
          </View>

          {/* Rating */}
          {trail.rating > 0 && trail.ratingCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                {renderStars(trail.rating)}
              </View>
              <Text style={{ fontSize: 16, color: '#E5E7EB', fontWeight: '500' }}>
                {trail.rating.toFixed(1)} ({trail.ratingCount} {trail.ratingCount === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}

          {/* Difficulty Badge */}
          <View style={{ marginBottom: 20 }}>
            <View style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1,
              backgroundColor: trail.difficulty === 'Easy' ? '#D1FAE5' : 
                             trail.difficulty === 'Moderate' ? '#FEF3C7' :
                             trail.difficulty === 'Hard' ? '#FED7AA' :
                             trail.difficulty === 'Expert' ? '#FEE2E2' : '#F3F4F6',
              borderColor: trail.difficulty === 'Easy' ? '#A7F3D0' : 
                          trail.difficulty === 'Moderate' ? '#FDE68A' :
                          trail.difficulty === 'Hard' ? '#FDBA74' :
                          trail.difficulty === 'Expert' ? '#FCA5A5' : '#D1D5DB',
            }}>
              <Text style={{
                fontWeight: '600',
                fontSize: 14,
                color: trail.difficulty === 'Easy' ? '#065F46' : 
                       trail.difficulty === 'Moderate' ? '#92400E' :
                       trail.difficulty === 'Hard' ? '#9A3412' :
                       trail.difficulty === 'Expert' ? '#991B1B' : '#374151',
              }}>
                {trail.difficulty}
              </Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 2,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Trail Stats</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <View style={{ width: '50%', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="resize-outline" size={20} color="#516D58" />
                  <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>Distance</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>{formatDistance(trail.distance)}</Text>
              </View>

              {(trail.elevationGain !== undefined && trail.elevationGain !== null) && (
                <View style={{ width: '50%', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="trending-up-outline" size={20} color="#516D58" />
                    <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>Elevation Gain</Text>
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                    {Math.round(trail.elevationGain)}m
                  </Text>
                </View>
              )}

              {(trail.elevationLoss !== undefined && trail.elevationLoss !== null && trail.elevationLoss > 0) && (
                <View style={{ width: '50%', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="trending-down-outline" size={20} color="#516D58" />
                    <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>Elevation Loss</Text>
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
                    {Math.round(trail.elevationLoss)}m
                  </Text>
                </View>
              )}

              {trail.path && trail.path.length > 0 && (
                <View style={{ width: '50%', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="map-outline" size={20} color="#516D58" />
                    <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 8 }}>Path Points</Text>
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>{trail.path.length}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 }}>Description</Text>
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 15, color: '#374151', lineHeight: 24 }}>
                {trail.description || 'No description available for this trail.'}
              </Text>
            </View>
          </View>

          {/* Map */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 }}>Trail Map</Text>
            <View style={{
              borderRadius: 16,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              <TrailMap trail={trail} height={300} />
            </View>
            <View style={{
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Coordinates</Text>
              <Text style={{ fontSize: 14, color: '#111827', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                {trail.coordinates.latitude.toFixed(6)}, {trail.coordinates.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 12, marginBottom: 24 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#4ADE80',
                borderRadius: 12,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#4ADE80',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
              }}
              activeOpacity={0.8}
              onPress={() => {
                if (!trail?.id) {
                  Alert.alert('Error', 'Trail ID is missing');
                  return;
                }
                console.log('Navigating to track screen for trail:', trail.id);
                router.push({
                  pathname: '/track',
                  params: { trailId: trail.id },
                } as any);
              }}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>Start Trail</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#3B82F6',
                borderRadius: 12,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#3B82F6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              onPress={() => setShowLogHikeModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>Log Hike</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isInWishlist ? '#3B82F6' : '#FFFFFF',
                  borderColor: isInWishlist ? '#3B82F6' : '#E5E7EB',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isInWishlist ? 0.2 : 0.05,
                  shadowRadius: 4,
                  elevation: isInWishlist ? 3 : 1,
                }}
                onPress={handleWishlistToggle}
                disabled={processingWishlist}
                activeOpacity={0.7}
              >
                {processingWishlist ? (
                  <ActivityIndicator size="small" color={isInWishlist ? "#FFFFFF" : "#3B82F6"} />
                ) : (
                  <>
                    <Ionicons 
                      name={isInWishlist ? "bookmark" : "bookmark-outline"} 
                      size={20} 
                      color={isInWishlist ? "#FFFFFF" : "#3B82F6"} 
                    />
                    <Text style={{
                      fontWeight: '600',
                      marginLeft: 8,
                      fontSize: 14,
                      color: isInWishlist ? '#FFFFFF' : '#3B82F6',
                    }}>
                      {isInWishlist ? 'In Wishlist' : 'Wishlist'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isInFavorites ? '#EF4444' : '#FFFFFF',
                  borderColor: isInFavorites ? '#EF4444' : '#E5E7EB',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isInFavorites ? 0.2 : 0.05,
                  shadowRadius: 4,
                  elevation: isInFavorites ? 3 : 1,
                }}
                onPress={handleFavoriteToggle}
                disabled={processingFavorite}
                activeOpacity={0.7}
              >
                {processingFavorite ? (
                  <ActivityIndicator size="small" color={isInFavorites ? "#FFFFFF" : "#EF4444"} />
                ) : (
                  <>
                    <Ionicons 
                      name={isInFavorites ? "heart" : "heart-outline"} 
                      size={20} 
                      color={isInFavorites ? "#FFFFFF" : "#EF4444"} 
                    />
                    <Text style={{
                      fontWeight: '600',
                      marginLeft: 8,
                      fontSize: 14,
                      color: isInFavorites ? '#FFFFFF' : '#EF4444',
                    }}>
                      {isInFavorites ? 'Favorited' : 'Favorite'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Log Hike Modal */}
      {trail && (
        <LogHikeModal
          visible={showLogHikeModal}
          onClose={() => setShowLogHikeModal(false)}
          trail={trail}
          onSuccess={() => {
            // Optionally refresh trail data or show success message
            console.log('Hike logged successfully');
          }}
        />
      )}
    </View>
  );
};

export default TrailDetail;

