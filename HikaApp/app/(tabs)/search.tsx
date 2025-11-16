import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch, Modal, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { searchTrailsFromFirestore, searchTrailsFromOverpass, saveOverpassTrailToFirestore, searchAllTrails } from '../../services/trailSearch';
import { Ionicons } from '@expo/vector-icons';
import type { Trail } from '../../types';

// List of all US states
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
].sort();

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
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Search function - only called when search button is pressed (must be before early returns)
  const performSearch = useCallback(async () => {
    // Allow searching if we have difficulty filter, search query, or location
    if (!searchQuery.trim() && !locationFilter.trim() && !difficultyFilter.trim()) {
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
      // When searching by difficulty only, fetch more results too
      const firestoreLimit = location ? 500 : difficulty ? 200 : 50;
      const firestoreResults = await searchTrailsFromFirestore(
        searchTerm,
        location,
        difficulty,
        firestoreLimit
      );

      // If OpenStreetMap is enabled and we have a location or search term, fetch from Overpass
      // Note: Overpass doesn't support difficulty filtering, so we only use it when we have location/search term
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
        // No location/search term or OpenStreetMap disabled, just use Firestore results
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
  // Default: sort by distance descending (longest to shortest)
  const getSortedTrails = (trailsToSort: Trail[]): Trail[] => {
    const sorted = [...trailsToSort].sort((a, b) => {
      const distanceA = a.distance || 0;
      const distanceB = b.distance || 0;

      // Handle trails without distance - put them at the end
      if (distanceA === 0 && distanceB === 0) return 0;
      if (distanceA === 0) return 1; // a goes to end
      if (distanceB === 0) return -1; // b goes to end

      if (sortBy === 'distance-asc') {
        return distanceA - distanceB;
      } else {
        // Default: sort by distance descending (longest to shortest)
        return distanceB - distanceA;
      }
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
    <View style={{ flex: 1, backgroundColor: '#516D58' }}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 20 }}>
            Search Trails
          </Text>
          
          {/* Search Input */}
          <View style={{ marginBottom: 16 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              paddingHorizontal: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}>
              <Ionicons name="search" size={20} color="#6B7280" style={{ marginRight: 12 }} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: '#111827',
                  paddingVertical: 12,
                }}
                placeholder="Search by trail name..."
                placeholderTextColor="#9CA3AF"
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

          {/* Location Filter - State Picker */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 }}>
              State
            </Text>
            <TouchableOpacity
              onPress={() => setShowStatePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                paddingHorizontal: 16,
                paddingVertical: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize: 16,
                color: locationFilter ? '#111827' : '#9CA3AF',
                fontWeight: locationFilter ? '500' : '400',
              }}>
                {locationFilter || 'Select a state...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
            {locationFilter && (
              <TouchableOpacity
                onPress={() => setLocationFilter('')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 8,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 13, color: '#FFFFFF', marginLeft: 6, fontWeight: '500' }}>
                  Clear state filter
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* State Picker Modal */}
          {showStatePicker && (
            <Modal
              visible={showStatePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowStatePicker(false)}
              statusBarTranslucent={Platform.OS !== 'web'}
            >
              <View style={styles.modalOverlay}>
                <TouchableOpacity
                  style={styles.backdrop}
                  activeOpacity={1}
                  onPress={() => setShowStatePicker(false)}
                />
                <View style={styles.modalContentWrapper}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalHeaderText}>Select State</Text>
                      <TouchableOpacity onPress={() => setShowStatePicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close" size={24} color="#1F2937" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView 
                      style={styles.modalScrollView}
                      contentContainerStyle={styles.modalScrollContent}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      <TouchableOpacity
                        style={[styles.stateOption, !locationFilter && styles.stateOptionSelected]}
                        onPress={() => {
                          setLocationFilter('');
                          setShowStatePicker(false);
                        }}
                      >
                        <Text style={[styles.stateOptionText, !locationFilter && styles.stateOptionTextSelected]}>
                          All States
                        </Text>
                      </TouchableOpacity>
                      {US_STATES.map((state) => (
                        <TouchableOpacity
                          key={state}
                          style={[styles.stateOption, locationFilter === state && styles.stateOptionSelected]}
                          onPress={() => {
                            setLocationFilter(state);
                            setShowStatePicker(false);
                          }}
                        >
                          <View style={styles.stateOptionRow}>
                            <Text style={[styles.stateOptionText, locationFilter === state && styles.stateOptionTextSelected]}>
                              {state}
                            </Text>
                            {locationFilter === state && (
                              <Ionicons name="checkmark" size={20} color="#10b981" />
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom} />
                </View>
              </View>
            </Modal>
          )}

          {/* Difficulty Filter */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 }}>
              Difficulty
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['', 'Easy', 'Moderate', 'Hard', 'Expert'].map((diff, index) => (
                  <TouchableOpacity
                    key={diff || `all-${index}`}
                    onPress={async () => {
                      const newFilter = diff === difficultyFilter ? '' : diff;
                      setDifficultyFilter(newFilter);
                      
                      // Automatically trigger search when difficulty filter changes
                      if (newFilter || searchQuery.trim() || locationFilter.trim()) {
                        // Create a search function with the new filter value
                        setIsSearching(true);
                        setHasSearched(true);
                        setOverpassTrails([]);
                        setSavedTrailsCount(null);

                        try {
                          const location = locationFilter.trim() || undefined;
                          const searchTerm = searchQuery.trim() || undefined;
                          const difficulty = newFilter && newFilter.trim() ? (newFilter as any) : undefined;

                          const firestoreLimit = location ? 500 : difficulty ? 200 : 50;
                          const firestoreResults = await searchTrailsFromFirestore(
                            searchTerm,
                            location,
                            difficulty,
                            firestoreLimit
                          );

                          if (useOpenStreetMap && (location || searchTerm)) {
                            setIsLoadingOverpass(true);
                            const result = await searchAllTrails(
                              searchTerm,
                              location,
                              difficulty,
                              true,
                              200
                            );
                            setTrails(result.trails);
                            if (result.savedCount !== undefined && result.savedCount > 0) {
                              setSavedTrailsCount(result.savedCount);
                              setTimeout(() => setSavedTrailsCount(null), 5000);
                            }
                            setIsLoadingOverpass(false);
                          } else {
                            setTrails(firestoreResults);
                          }
                        } catch (error) {
                          console.error('Search error:', error);
                          setTrails([]);
                          setIsLoadingOverpass(false);
                        } finally {
                          setIsSearching(false);
                        }
                      } else {
                        // Clear results if all filters are cleared
                        setTrails([]);
                        setHasSearched(false);
                      }
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: difficultyFilter === diff ? '#92C59F' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: difficultyFilter === diff ? '#92C59F' : '#E5E7EB',
                      marginRight: 8,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: difficultyFilter === diff ? '#FFFFFF' : '#374151',
                      }}
                    >
                      {diff || 'All'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* OpenStreetMap Toggle */}
          <View style={{ marginBottom: 20 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                  Search OpenStreetMap
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 18 }}>
                  Automatically fetch and save trails from OpenStreetMap when searching by name or location
                </Text>
              </View>
              <Switch
                value={useOpenStreetMap}
                onValueChange={setUseOpenStreetMap}
                trackColor={{ false: '#D1D5DB', true: '#92C59F' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            onPress={performSearch}
            disabled={isSearching}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSearching ? '#D1D5DB' : '#92C59F',
              borderRadius: 12,
              paddingVertical: 16,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isSearching ? 0 : 0.2,
              shadowRadius: 8,
              elevation: isSearching ? 0 : 6,
            }}
            activeOpacity={0.8}
          >
            {isSearching ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginLeft: 12 }}>
                  Searching...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginLeft: 12 }}>
                  Search Trails
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Success Message */}
          {savedTrailsCount !== null && savedTrailsCount > 0 && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#ECFDF5',
              borderWidth: 1,
              borderColor: '#A7F3D0',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={{ marginLeft: 8, fontSize: 14, color: '#065F46', fontWeight: '500', flex: 1 }}>
                Automatically saved {savedTrailsCount} new trail{savedTrailsCount !== 1 ? 's' : ''} to database
              </Text>
            </View>
          )}

          {/* Search Results - No trails found */}
          {!isSearching && hasSearched && trails.length === 0 && !isLoadingOverpass && (
            <View style={{
              alignItems: 'center',
              paddingVertical: 48,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              <Ionicons name="trail-sign-outline" size={64} color="#D1D5DB" />
              <Text style={{ marginTop: 16, fontSize: 18, color: '#374151', fontWeight: '600', textAlign: 'center' }}>
                No trails found.
              </Text>
              <Text style={{ marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 }}>
                {locationFilter.trim() 
                  ? 'No trails found matching your search. Try a different search term or state.'
                  : searchQuery.trim()
                    ? 'No trails found with that name. Try selecting a state to search OpenStreetMap for more trails.'
                    : 'Try selecting a state to search for trails.'}
              </Text>
            </View>
          )}

          {/* Loading state */}
          {isSearching && (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={{ marginTop: 16, fontSize: 16, color: '#FFFFFF', fontWeight: '500' }}>
                Searching trails...
              </Text>
              {isLoadingOverpass && (
                <Text style={{ marginTop: 8, fontSize: 14, color: '#E5E7EB' }}>
                  Fetching from OpenStreetMap...
                </Text>
              )}
            </View>
          )}

          {/* Trail Results */}
          {!isSearching && trails.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                paddingVertical: 8,
              }}>
                <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: '500' }}>
                  Found {trails.length} trail{trails.length !== 1 ? 's' : ''}
                </Text>
                
                {/* Sort Options */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, color: '#FFFFFF', marginRight: 4 }}>Sort:</Text>
                  <TouchableOpacity
                    onPress={() => setSortBy(sortBy === 'distance-asc' ? 'none' : 'distance-asc')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: sortBy === 'distance-asc' ? '#92C59F' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: sortBy === 'distance-asc' ? '#92C59F' : '#E5E7EB',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="arrow-up" 
                      size={12} 
                      color={sortBy === 'distance-asc' ? '#FFFFFF' : '#6B7280'} 
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        marginLeft: 4,
                        color: sortBy === 'distance-asc' ? '#FFFFFF' : '#374151',
                      }}
                    >
                      Distance
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSortBy(sortBy === 'distance-desc' ? 'none' : 'distance-desc')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: sortBy === 'distance-desc' ? '#92C59F' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: sortBy === 'distance-desc' ? '#92C59F' : '#E5E7EB',
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="arrow-down" 
                      size={12} 
                      color={sortBy === 'distance-desc' ? '#FFFFFF' : '#6B7280'} 
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        marginLeft: 4,
                        color: sortBy === 'distance-desc' ? '#FFFFFF' : '#374151',
                      }}
                    >
                      Distance
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {sortedTrails.map((trail) => (
                <TouchableOpacity
                  key={trail.id}
                  onPress={() => handleTrailPress(trail.id)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row' }}>
                    {/* Trail Image Placeholder */}
                    <View style={{
                      width: 80,
                      height: 80,
                      backgroundColor: '#E8F5E9',
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="trail-sign" size={36} color="#516D58" />
                    </View>

                    {/* Trail Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#111827',
                        marginBottom: 6,
                      }} numberOfLines={1}>
                        {trail.name || 'Unnamed Trail'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons name="location" size={14} color="#6B7280" />
                        <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 4 }} numberOfLines={1}>
                          {trail.location || 'Unknown Location'}
                        </Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: trail.difficulty === 'Easy' ? '#D1FAE5' : 
                                         trail.difficulty === 'Moderate' ? '#FEF3C7' :
                                         trail.difficulty === 'Hard' ? '#FED7AA' :
                                         trail.difficulty === 'Expert' ? '#FEE2E2' : '#F3F4F6',
                        }}>
                          <Text style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: trail.difficulty === 'Easy' ? '#065F46' : 
                                   trail.difficulty === 'Moderate' ? '#92400E' :
                                   trail.difficulty === 'Hard' ? '#9A3412' :
                                   trail.difficulty === 'Expert' ? '#991B1B' : '#374151',
                          }}>
                            {trail.difficulty || 'Moderate'}
                          </Text>
                        </View>
                        {(trail.distance !== undefined && trail.distance !== null) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="resize-outline" size={14} color="#6B7280" />
                            <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>
                              {formatDistance(trail.distance)}
                            </Text>
                          </View>
                        )}
                        {(trail.elevationGain !== undefined && trail.elevationGain !== null && trail.elevationGain > 0) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="trending-up-outline" size={14} color="#6B7280" />
                            <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>
                              {Math.round(trail.elevationGain)}m
                            </Text>
                          </View>
                        )}
                      </View>
                      {(trail.rating !== undefined && trail.rating !== null && trail.rating > 0 && 
                        trail.ratingCount !== undefined && trail.ratingCount !== null && trail.ratingCount > 0) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <Ionicons name="star" size={14} color="#FBBF24" />
                          <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>
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

          {/* Initial state */}
          {!hasSearched && !isSearching && (
            <View style={{
              alignItems: 'center',
              paddingVertical: 48,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 2,
            }}>
              <Ionicons name="search-outline" size={64} color="#516D58" />
              <Text style={{ marginTop: 16, fontSize: 18, color: '#111827', fontWeight: '600', textAlign: 'center' }}>
                Search for trails
              </Text>
              <Text style={{ marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 }}>
                Enter a trail name, select a location, or choose a difficulty level to filter trails.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContentWrapper: {
    width: '100%',
    maxHeight: Platform.OS === 'web' ? '90%' : '85%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalScrollView: {
    maxHeight: Platform.OS === 'web' ? 600 : 500,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  stateOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  stateOptionSelected: {
    backgroundColor: '#ECFDF5',
  },
  stateOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stateOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  stateOptionTextSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  safeAreaBottom: {
    backgroundColor: '#FFFFFF',
  },
});

export default Search;
