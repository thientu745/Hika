import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { searchTrailsFromFirestore, searchTrailsFromOverpass, saveOverpassTrailToFirestore, searchAllTrails } from '../../services/trailSearch';
import { Ionicons } from '@expo/vector-icons';
import type { Trail } from '../../types';

const Search = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [overpassTrails, setOverpassTrails] = useState<Partial<Trail>[]>([]);
  const [isLoadingOverpass, setIsLoadingOverpass] = useState(false);
  const [savedTrailsCount, setSavedTrailsCount] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'none' | 'distance-asc' | 'distance-desc'>('none');
  const [useOpenStreetMap, setUseOpenStreetMap] = useState(true);

  // Search function - only called when search button is pressed (must be before early returns)
  const performSearch = useCallback(async () => {
    // Don't search if only difficulty is selected without name or location
    if (!searchQuery.trim() && !locationFilter.trim()) {
      setTrails([]);
      setOverpassTrails([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setOverpassTrails([]);
    setSavedTrailsCount(null);

    try {
      // Use combined search that automatically fetches from Overpass if needed
      const location = locationFilter.trim() || undefined;
      const searchTerm = searchQuery.trim() || undefined;
      // Convert empty string to undefined for difficulty filter
      const difficulty = difficultyFilter && difficultyFilter.trim() ? (difficultyFilter as any) : undefined;

      // First, always search Firestore
      // When searching by location, fetch more results to ensure we get all matches
      const firestoreLimit = location ? 500 : 50;
      const firestoreResults = await searchTrailsFromFirestore(
        searchTerm,
        location,
        difficulty,
        firestoreLimit
      );

      // If OpenStreetMap is enabled and we have a location or search term, fetch from Overpass
      if (useOpenStreetMap && (location || searchTerm)) {
        setIsLoadingOverpass(true);
        const result = await searchAllTrails(
          searchTerm,
          location,
          difficulty,
          true, // autoFetchOverpass
          200 // maxOverpassResults - save more trails from Overpass
        );
        setTrails(result.trails);
        if (result.savedCount !== undefined && result.savedCount > 0) {
          setSavedTrailsCount(result.savedCount);
          // Clear the message after 5 seconds
          setTimeout(() => setSavedTrailsCount(null), 5000);
        }
        setIsLoadingOverpass(false);
      } else {
        // No location or OpenStreetMap disabled, just use Firestore results
        setTrails(firestoreResults);
      }
    } catch (error) {
      console.error('Search error:', error);
      setTrails([]);
      setIsLoadingOverpass(false);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, locationFilter, difficultyFilter, useOpenStreetMap]);

  // Redirect to welcome if not authenticated (after all hooks)
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  if (loading || !user) {
    return <LoadingScreen message="Loading search..." variant="minimal" />;
  }

  const handleTrailPress = (trailId: string) => {
    router.push(`/trail/${trailId}` as any);
  };

  const formatDistance = (meters: number | undefined | null): string => {
    if (!meters || meters === 0) {
      return '0m';
    }
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Sort trails based on selected sort option
  const getSortedTrails = (trailsToSort: Trail[]): Trail[] => {
    if (sortBy === 'none') {
      return trailsToSort;
    }

    const sorted = [...trailsToSort].sort((a, b) => {
      const distanceA = a.distance || 0;
      const distanceB = b.distance || 0;

      if (sortBy === 'distance-asc') {
        return distanceA - distanceB;
      } else if (sortBy === 'distance-desc') {
        return distanceB - distanceA;
      }
      return 0;
    });

    return sorted;
  };

  const sortedTrails = getSortedTrails(trails);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Hard':
        return 'bg-orange-100 text-orange-800';
      case 'Expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1">
        <View className="px-4 py-6">
          <Text className="text-2xl font-bold text-gray-900 mb-4">Search Trails</Text>
          
          {/* Search Input */}
          <View className="mb-4">
            <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3 bg-white">
              <Ionicons name="search-outline" size={20} color="#6B7280" />
              <TextInput
                className="flex-1 ml-2 text-base"
                placeholder="Search by trail name..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Location Filter */}
          <View className="mb-4">
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="Filter by location (e.g., California, Mountain View)"
              value={locationFilter}
              onChangeText={setLocationFilter}
            />
          </View>

          {/* Difficulty Filter */}
          <View className="mb-6">
            <Text className="text-gray-700 mb-2 font-medium">Difficulty</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <View className="flex-row space-x-2">
                {['', 'Easy', 'Moderate', 'Hard', 'Expert'].map((diff, index) => (
                  <TouchableOpacity
                    key={diff || `all-${index}`}
                    onPress={() => setDifficultyFilter(diff === difficultyFilter ? '' : diff)}
                    className={`px-4 py-2 rounded-full border ${
                      difficultyFilter === diff
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text
                      className={`font-medium ${
                        difficultyFilter === diff ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {diff || 'All'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* OpenStreetMap Toggle */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
              <View className="flex-1 mr-4">
                <Text className="text-gray-700 font-medium mb-1">Search OpenStreetMap</Text>
                <Text className="text-sm text-gray-500">
                  Automatically fetch and save trails from OpenStreetMap when searching by name or location
                </Text>
              </View>
              <Switch
                value={useOpenStreetMap}
                onValueChange={setUseOpenStreetMap}
                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            onPress={performSearch}
            disabled={isSearching}
            className={`py-4 rounded-lg items-center mb-6 ${
              isSearching ? 'bg-gray-400' : 'bg-green-600'
            }`}
          >
            {isSearching ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-white text-lg font-semibold ml-2">Searching...</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text className="text-white text-lg font-semibold ml-2">Search Trails</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Success Message */}
          {savedTrailsCount !== null && savedTrailsCount > 0 && (
            <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text className="ml-2 text-green-800 font-medium">
                  Automatically saved {savedTrailsCount} new trail{savedTrailsCount !== 1 ? 's' : ''} to database
                </Text>
              </View>
            </View>
          )}

          {/* Search Results */}
          {isSearching && (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#10b981" />
              <Text className="mt-4 text-gray-600">Searching trails...</Text>
              {isLoadingOverpass && (
                <Text className="mt-2 text-sm text-gray-500">Fetching from OpenStreetMap...</Text>
              )}
            </View>
          )}

          {!isSearching && hasSearched && trails.length === 0 && !isLoadingOverpass && (
            <View className="items-center py-8">
              <Ionicons name="trail-sign-outline" size={64} color="#D1D5DB" />
              <Text className="mt-4 text-gray-600 text-center">
                No trails found.
              </Text>
              <Text className="mt-2 text-sm text-gray-500 text-center px-4 mb-4">
                {locationFilter.trim() 
                  ? 'No trails found matching your search. Try a different search term or location.'
                  : searchQuery.trim()
                    ? 'No trails found with that name. Try adding a location filter (e.g., "Oregon", "California") to search OpenStreetMap for more trails.'
                    : 'Try adding a location filter (e.g., "Oregon", "California") to search for trails.'}
              </Text>
            </View>
          )}

          {/* Overpass API Results (if any) */}
          {overpassTrails.length > 0 && (
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-600">
                  Found {overpassTrails.length} trail{overpassTrails.length !== 1 ? 's' : ''} from OpenStreetMap
                </Text>
              </View>
              
              {overpassTrails.map((trail, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    Alert.alert(
                      'Save Trail?',
                      `Would you like to save "${trail.name || 'this trail'}" to the database?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Save',
                          onPress: async () => {
                            const trailId = await saveOverpassTrailToFirestore(trail);
                            if (trailId) {
                              Alert.alert('Success', 'Trail saved to database!');
                              performSearch(); // Refresh search
                            }
                          },
                        },
                      ]
                    );
                  }}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3"
                >
                  <View className="flex-row">
                    <View className="w-20 h-20 bg-blue-100 rounded-lg items-center justify-center mr-4">
                      <Ionicons name="map-outline" size={32} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center mb-1">
                        <Text className="text-lg font-semibold text-gray-900 flex-1" numberOfLines={1}>
                          {trail.name || 'Unnamed Trail'}
                        </Text>
                        <View className="bg-blue-500 px-2 py-1 rounded">
                          <Text className="text-xs text-white font-medium">OSM</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center mb-2">
                        <Ionicons name="location-outline" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-600 ml-1" numberOfLines={1}>
                          {trail.location || 'Unknown Location'}
                        </Text>
                      </View>
                      {(trail.distance !== undefined && trail.distance !== null) && (
                        <Text className="text-xs text-gray-500">
                          Tap to save to database
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isSearching && trails.length > 0 && (
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-600">
                  Found {trails.length} trail{trails.length !== 1 ? 's' : ''}
                </Text>
                
                {/* Sort Options */}
                <View className="flex-row items-center">
                  <Text className="text-sm text-gray-600 mr-2">Sort:</Text>
                  <TouchableOpacity
                    onPress={() => setSortBy(sortBy === 'distance-asc' ? 'none' : 'distance-asc')}
                    className={`px-3 py-1 rounded border mr-2 ${
                      sortBy === 'distance-asc'
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <View className="flex-row items-center">
                      <Ionicons 
                        name="arrow-up" 
                        size={14} 
                        color={sortBy === 'distance-asc' ? '#FFFFFF' : '#6B7280'} 
                      />
                      <Text
                        className={`text-xs font-medium ml-1 ${
                          sortBy === 'distance-asc' ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        Distance
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSortBy(sortBy === 'distance-desc' ? 'none' : 'distance-desc')}
                    className={`px-3 py-1 rounded border ${
                      sortBy === 'distance-desc'
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <View className="flex-row items-center">
                      <Ionicons 
                        name="arrow-down" 
                        size={14} 
                        color={sortBy === 'distance-desc' ? '#FFFFFF' : '#6B7280'} 
                      />
                      <Text
                        className={`text-xs font-medium ml-1 ${
                          sortBy === 'distance-desc' ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        Distance
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              
              {sortedTrails.map((trail) => (
                <TouchableOpacity
                  key={trail.id}
                  onPress={() => handleTrailPress(trail.id)}
                  className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm"
                >
                  <View className="flex-row">
                    {/* Trail Image Placeholder */}
                    <View className="w-20 h-20 bg-green-100 rounded-lg items-center justify-center mr-4">
                      <Ionicons name="trail-sign" size={32} color="#10b981" />
                    </View>

                    {/* Trail Info */}
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-gray-900 mb-1" numberOfLines={1}>
                        {trail.name || 'Unnamed Trail'}
                      </Text>
                      <View className="flex-row items-center mb-2">
                        <Ionicons name="location-outline" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-600 ml-1" numberOfLines={1}>
                          {trail.location || 'Unknown Location'}
                        </Text>
                      </View>
                      
                      <View className="flex-row items-center flex-wrap">
                        <View className={`px-2 py-1 rounded ${getDifficultyColor(trail.difficulty || 'Moderate')} mr-2 mb-1`}>
                          <Text className="text-xs font-medium">{trail.difficulty || 'Moderate'}</Text>
                        </View>
                        {(trail.distance !== undefined && trail.distance !== null) && (
                          <View className="flex-row items-center mr-3 mb-1">
                            <Ionicons name="resize-outline" size={14} color="#6B7280" />
                            <Text className="text-xs text-gray-600 ml-1">{formatDistance(trail.distance)}</Text>
                          </View>
                        )}
                        {(trail.elevationGain !== undefined && trail.elevationGain !== null && trail.elevationGain > 0) && (
                          <View className="flex-row items-center mb-1">
                            <Ionicons name="trending-up-outline" size={14} color="#6B7280" />
                            <Text className="text-xs text-gray-600 ml-1">
                              {Math.round(trail.elevationGain)}m
                            </Text>
                          </View>
                        )}
                      </View>

                      {(trail.rating !== undefined && trail.rating !== null && trail.rating > 0 && 
                        trail.ratingCount !== undefined && trail.ratingCount !== null && trail.ratingCount > 0) && (
                        <View className="flex-row items-center mt-1">
                          <Ionicons name="star" size={14} color="#FBBF24" />
                          <Text className="text-xs text-gray-600 ml-1">
                            {trail.rating.toFixed(1)} ({trail.ratingCount})
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!hasSearched && !isSearching && (
            <View className="items-center py-8">
              <Ionicons name="search-outline" size={64} color="#D1D5DB" />
              <Text className="mt-4 text-gray-600 text-center">
                Start typing to search for trails
              </Text>
              <Text className="mt-2 text-sm text-gray-500 text-center px-4">
                Enter a trail name or location to search. You can also filter by difficulty after searching.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default Search;
