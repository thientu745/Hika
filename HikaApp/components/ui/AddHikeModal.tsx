import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { LogHikeModal } from './LogHikeModal';
import { searchTrailsFromFirestore } from '../../services/trailSearch';
import type { Trail } from '../../types';

interface AddHikeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddHikeModal: React.FC<AddHikeModalProps> = ({
  visible,
  onClose,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [mode, setMode] = useState<'select' | 'log' | 'new'>('select'); // select, log, or new
  const [trailSearchQuery, setTrailSearchQuery] = useState('');
  const [trailSearchResults, setTrailSearchResults] = useState<Trail[]>([]);
  const [searchingTrails, setSearchingTrails] = useState(false);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [customHikeName, setCustomHikeName] = useState('');
  const [recentTrails, setRecentTrails] = useState<Trail[]>([]);
  const [loadingRecentTrails, setLoadingRecentTrails] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset modal to initial state when it becomes visible
  useEffect(() => {
    if (visible) {
      setMode('select');
      setTrailSearchQuery('');
      setTrailSearchResults([]);
      setSelectedTrail(null);
      setCustomHikeName('');
      setRecentTrails([]);
      setLoadingRecentTrails(false);
    }
  }, [visible]);

  // Load recent trails when entering log mode with no search query
  useEffect(() => {
    if (mode === 'log' && !trailSearchQuery.trim() && recentTrails.length === 0 && !loadingRecentTrails) {
      const loadRecentTrails = async () => {
        try {
          setLoadingRecentTrails(true);
          // Fetch recent trails (no search term, just get recent ones)
          const results = await searchTrailsFromFirestore(undefined, undefined, undefined, 20);
          setRecentTrails(results);
        } catch (e) {
          console.warn('Error loading recent trails', e);
        } finally {
          setLoadingRecentTrails(false);
        }
      };
      loadRecentTrails();
    }
  }, [mode, trailSearchQuery]);

  // Debounced trail search - works for both 'log' and 'new' modes
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    // Only search if we have a query and we're in a mode that uses search
    if (!trailSearchQuery.trim() || (mode !== 'new' && mode !== 'log')) {
      setTrailSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        setSearchingTrails(true);
        // Increase limit to 50 to get more results, and let the search function handle fetching more trails
        const results = await searchTrailsFromFirestore(trailSearchQuery.trim(), undefined, undefined, 50);
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
  }, [trailSearchQuery, mode]);

  const handleStartNewHike = () => {
    if (mode === 'new') {
      // If a trail was selected from search, use its ID
      if (selectedTrail) {
        router.push({
          pathname: '/track',
          params: { trailId: selectedTrail.id },
        } as any);
      } else if (customHikeName.trim()) {
        // Use custom name - we'll pass it as a parameter
        router.push({
          pathname: '/track',
          params: { trailName: customHikeName.trim() },
        } as any);
      } else {
        // No name provided, just start tracking
        router.push('/track' as any);
      }
      onClose();
    }
  };

  const handleSelectTrailForLog = (trail: Trail) => {
    setSelectedTrail(trail);
    // Mode is already 'log', so LogHikeModal should open
  };

  const handleSelectTrailForNew = (trail: Trail) => {
    setSelectedTrail(trail);
    setTrailSearchQuery(trail.name);
  };

  const resetModal = () => {
    setMode('select');
    setTrailSearchQuery('');
    setTrailSearchResults([]);
    setSelectedTrail(null);
    setCustomHikeName('');
    setRecentTrails([]);
    setLoadingRecentTrails(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible && !(selectedTrail && mode === 'log')}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClose}
        statusBarTranslucent={Platform.OS !== 'web'}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={handleClose}
          />
          <View style={styles.modalContentWrapper}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderText}>
                  {mode === 'select' ? 'Add Hike' : mode === 'log' ? 'Log Hike' : 'Start New Hike'}
                </Text>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {mode === 'select' && (
                  <View style={styles.selectModeContainer}>
                    <Text style={styles.sectionTitle}>Choose an option</Text>
                    
                    {/* Log Existing Hike Button */}
                    <TouchableOpacity
                      style={styles.optionButton}
                      onPress={() => setMode('log')}
                    >
                      <View style={styles.optionIconContainer}>
                        <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>Log Existing Hike</Text>
                        <Text style={styles.optionDescription}>
                          Record a hike you've already completed
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    {/* Start New Hike Button */}
                    <TouchableOpacity
                      style={styles.optionButton}
                      onPress={() => setMode('new')}
                    >
                      <View style={styles.optionIconContainer}>
                        <Ionicons name="play-circle" size={32} color="#3B82F6" />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>Start New Hike</Text>
                        <Text style={styles.optionDescription}>
                          Begin tracking a new hike with GPS
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                )}

                {mode === 'log' && (
                  <View style={styles.logModeContainer}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        setMode('select');
                        setSelectedTrail(null);
                        setTrailSearchQuery('');
                      }}
                    >
                      <Ionicons name="arrow-back" size={20} color="#6B7280" />
                      <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Select a trail to log</Text>
                    <Text style={styles.sectionDescription}>
                      Search for a trail you've completed
                    </Text>

                    {/* Trail Search */}
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search trails..."
                        placeholderTextColor="#9CA3AF"
                        value={trailSearchQuery}
                        onChangeText={setTrailSearchQuery}
                        autoCapitalize="none"
                      />
                      {trailSearchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setTrailSearchQuery('');
                            setTrailSearchResults([]);
                          }}
                          style={styles.clearButton}
                        >
                          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Search Results */}
                    {searchingTrails || loadingRecentTrails ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#10b981" />
                        <Text style={styles.loadingText}>
                          {searchingTrails ? 'Searching trails...' : 'Loading trails...'}
                        </Text>
                      </View>
                    ) : trailSearchQuery.trim() ? (
                      // Show search results when there's a query
                      trailSearchResults.length > 0 ? (
                        <View style={styles.resultsContainer}>
                          {trailSearchResults.map((trail) => (
                            <TouchableOpacity
                              key={trail.id}
                              style={styles.trailResultItem}
                              onPress={() => handleSelectTrailForLog(trail)}
                            >
                              <View style={styles.trailResultContent}>
                                <Text style={styles.trailResultName}>{trail.name}</Text>
                                {trail.location && (
                                  <Text style={styles.trailResultLocation}>{trail.location}</Text>
                                )}
                              </View>
                              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>No trails found</Text>
                          <Text style={styles.emptySubtext}>Try a different search term</Text>
                        </View>
                      )
                    ) : recentTrails.length > 0 ? (
                      // Show recent trails when there's no search query
                      <View style={styles.resultsContainer}>
                        <Text style={styles.sectionSubtitle}>Recent Trails</Text>
                        {recentTrails.map((trail) => (
                          <TouchableOpacity
                            key={trail.id}
                            style={styles.trailResultItem}
                            onPress={() => handleSelectTrailForLog(trail)}
                          >
                            <View style={styles.trailResultContent}>
                              <Text style={styles.trailResultName}>{trail.name}</Text>
                              {trail.location && (
                                <Text style={styles.trailResultLocation}>{trail.location}</Text>
                              )}
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Search for a trail to log</Text>
                      </View>
                    )}
                  </View>
                )}

                {mode === 'new' && (
                  <View style={styles.newModeContainer}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        setMode('select');
                        setSelectedTrail(null);
                        setTrailSearchQuery('');
                        setCustomHikeName('');
                      }}
                    >
                      <Ionicons name="arrow-back" size={20} color="#6B7280" />
                      <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Start a new hike</Text>
                    <Text style={styles.sectionDescription}>
                      Enter a custom name or search for an existing trail
                    </Text>

                    {/* Custom Name Input */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Hike Name (Optional)</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g., Morning Hike, Sunset Trail"
                        placeholderTextColor="#9CA3AF"
                        value={customHikeName}
                        onChangeText={setCustomHikeName}
                        onFocus={() => setSelectedTrail(null)}
                      />
                    </View>

                    {/* Or Divider */}
                    <View style={styles.dividerContainer}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* Trail Search */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Search Existing Trail</Text>
                      <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search trails..."
                          placeholderTextColor="#9CA3AF"
                          value={trailSearchQuery}
                          onChangeText={setTrailSearchQuery}
                          autoCapitalize="none"
                        />
                        {trailSearchQuery.length > 0 && (
                          <TouchableOpacity
                            onPress={() => {
                              setTrailSearchQuery('');
                              setTrailSearchResults([]);
                              setSelectedTrail(null);
                            }}
                            style={styles.clearButton}
                          >
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Search Results */}
                    {searchingTrails ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#10b981" />
                        <Text style={styles.loadingText}>Searching trails...</Text>
                      </View>
                    ) : trailSearchResults.length > 0 ? (
                      <View style={styles.resultsContainer}>
                        {trailSearchResults.map((trail) => (
                          <TouchableOpacity
                            key={trail.id}
                            style={[
                              styles.trailResultItem,
                              selectedTrail?.id === trail.id && styles.trailResultItemSelected,
                            ]}
                            onPress={() => handleSelectTrailForNew(trail)}
                          >
                            <View style={styles.trailResultContent}>
                              <Text style={styles.trailResultName}>{trail.name}</Text>
                              {trail.location && (
                                <Text style={styles.trailResultLocation}>{trail.location}</Text>
                              )}
                            </View>
                            {selectedTrail?.id === trail.id ? (
                              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                            ) : (
                              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : trailSearchQuery.trim() ? (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No trails found</Text>
                      </View>
                    ) : null}

                    {/* Start Button */}
                    <TouchableOpacity
                      style={[
                        styles.startButton,
                        (!selectedTrail && !customHikeName.trim()) && styles.startButtonDisabled,
                      ]}
                      onPress={handleStartNewHike}
                      disabled={!selectedTrail && !customHikeName.trim()}
                    >
                      <Ionicons name="play" size={24} color="#FFFFFF" />
                      <Text style={styles.startButtonText}>Start Tracking</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
            <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom} />
          </View>
        </View>
      </Modal>

      {/* Log Hike Modal */}
      {selectedTrail && (
        <LogHikeModal
          visible={mode === 'log' && selectedTrail !== null}
          onClose={() => {
            setSelectedTrail(null);
            setMode('select');
            setTrailSearchQuery('');
            // Don't close the AddHikeModal, just go back to select mode
          }}
          trail={selectedTrail}
          onSuccess={() => {
            handleClose();
          }}
        />
      )}
    </>
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
    maxHeight: Platform.OS === 'web' ? '85%' : '90%',
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
    padding: 16,
    paddingBottom: 20,
  },
  safeAreaBottom: {
    backgroundColor: '#FFFFFF',
  },
  selectModeContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionIconContainer: {
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  logModeContainer: {
    gap: 16,
  },
  newModeContainer: {
    gap: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  resultsContainer: {
    gap: 8,
  },
  trailResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trailResultItemSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10b981',
  },
  trailResultContent: {
    flex: 1,
  },
  trailResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  trailResultLocation: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    marginTop: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AddHikeModal;

