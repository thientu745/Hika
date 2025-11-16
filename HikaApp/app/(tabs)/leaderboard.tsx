import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRootNavigationState } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { getLeaderboard } from '../../services/database';
import { Image } from 'expo-image';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardStat } from '../../types';

// Inner component (doesn't use useRouter hook to avoid navigation context issues)
function LeaderboardContent() {
  const { user, userProfile, loading } = useAuth();
  
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'friends'>('global');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [stat, setStat] = useState<LeaderboardStat>('distance');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  // Load leaderboard data
  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!user) return;

      setLoadingLeaderboard(true);
      try {
        let friendUserIds: string[] | undefined;
        
        if (leaderboardType === 'friends') {
          // Include current user and their following list
          const following = userProfile?.following || [];
          friendUserIds = [user.uid, ...following];
          
          // If no friends, return empty early
          if (friendUserIds.length === 1 && !userProfile?.following?.length) {
            setEntries([]);
            setLoadingLeaderboard(false);
            return;
          }
        }

        const leaderboardEntries = await getLeaderboard(period, stat, 100, friendUserIds);
        setEntries(leaderboardEntries);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        setEntries([]);
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    // Only load if userProfile is loaded (for friends leaderboard)
    if (leaderboardType === 'friends' && !userProfile) {
      return; // Wait for userProfile to load
    }

    loadLeaderboard();
  }, [user, userProfile?.following, leaderboardType, period, stat]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      // Use dynamic require only when needed
      try {
        const { router } = require('expo-router');
        router.replace('/welcome');
      } catch (e) {
        console.warn('Navigation error:', e);
      }
    }
  }, [loading, user]);

  // Show loading while checking auth
  if (loading) {
    return <LoadingScreen message="Loading leaderboard..." variant="minimal" />;
  }

  if (!user) {
    return <LoadingScreen message="Redirecting..." variant="minimal" />;
  }

  const formatValue = (value: number, statType: LeaderboardStat): string => {
    switch (statType) {
      case 'distance':
        return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
      case 'hikes':
        return value.toString();
      case 'time':
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
      default:
        return value.toString();
    }
  };

  const getStatLabel = (statType: LeaderboardStat): string => {
    switch (statType) {
      case 'distance':
        return 'Distance';
      case 'hikes':
        return 'Hikes';
      case 'time':
        return 'Time';
      default:
        return 'Distance';
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return { name: 'trophy' as const, color: '#FFD700' };
    if (rank === 2) return { name: 'trophy' as const, color: '#C0C0C0' };
    if (rank === 3) return { name: 'trophy' as const, color: '#CD7F32' };
    return null;
  };

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#516D58' }}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 24 }}>
          Leaderboard
        </Text>

        {/* Type Filter (Global/Friends) */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 }}>
            Filter
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['global', 'friends'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setLeaderboardType(type)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: leaderboardType === type ? '#92C59F' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: leaderboardType === type ? '#92C59F' : '#E5E7EB',
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: leaderboardType === type ? '#FFFFFF' : '#374151',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type === 'global' ? 'Global' : 'Friends'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Period Filter */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 }}>
            Time Period
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as LeaderboardPeriod[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: period === p ? '#92C59F' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: period === p ? '#92C59F' : '#E5E7EB',
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: period === p ? '#FFFFFF' : '#374151',
                      textTransform: 'capitalize',
                    }}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Stat Filter */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 }}>
            Stat
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['distance', 'hikes', 'time'] as LeaderboardStat[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStat(s)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: stat === s ? '#92C59F' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: stat === s ? '#92C59F' : '#E5E7EB',
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: stat === s ? '#FFFFFF' : '#374151',
                      textTransform: 'capitalize',
                    }}
                  >
                    {getStatLabel(s)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Leaderboard List */}
        {loadingLeaderboard ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>
              Loading leaderboard...
            </Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={{
            paddingVertical: 48,
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            paddingHorizontal: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 2,
          }}>
            <Ionicons name="trophy-outline" size={64} color="#D1D5DB" />
            <Text style={{ 
              color: '#374151', 
              marginTop: 16, 
              fontSize: 16, 
              fontWeight: '600',
              textAlign: 'center' 
            }}>
              {leaderboardType === 'friends' 
                ? 'No friends on the leaderboard yet.' 
                : 'No entries found.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {entries.map((entry) => {
              const rankIcon = getRankIcon(entry.rank);
              const isCurrentUser = entry.userId === user?.uid;
              
              return (
                <TouchableOpacity
                  key={entry.userId}
                  onPress={() => {
                    // Use dynamic require only when needed
                    try {
                      const { router } = require('expo-router');
                      router.push(`/profile/${entry.userId}` as any);
                    } catch (e) {
                      console.warn('Navigation error:', e);
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: '#FFFFFF',
                    borderWidth: isCurrentUser ? 2 : 1,
                    borderColor: isCurrentUser ? '#92C59F' : '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                  activeOpacity={0.7}
                >
                  {/* Rank */}
                  <View style={{ width: 48, alignItems: 'center' }}>
                    {rankIcon ? (
                      <Ionicons name={rankIcon.name} size={28} color={rankIcon.color} />
                    ) : (
                      <Text style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: isCurrentUser ? '#516D58' : '#6B7280',
                      }}>
                        {entry.rank}
                      </Text>
                    )}
                  </View>

                  {/* Profile Picture */}
                  <View style={{ width: 48, height: 48, marginRight: 12 }}>
                    {entry.userProfilePictureUrl ? (
                      <Image
                        source={{ uri: entry.userProfilePictureUrl }}
                        style={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: 24,
                          borderWidth: 2,
                          borderColor: '#E5E7EB'
                        }}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{
                        width: 48,
                        height: 48,
                        backgroundColor: '#92C59F',
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}>
                          {entry.userDisplayName?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* User Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                        {entry.userDisplayName}
                      </Text>
                      {isCurrentUser && (
                        <Text style={{ 
                          marginLeft: 8, 
                          fontSize: 12, 
                          color: '#516D58', 
                          fontWeight: '600' 
                        }}>
                          (You)
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                      {formatValue(entry.value, stat)}
                    </Text>
                  </View>

                  {/* Value */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                      {formatValue(entry.value, stat)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// Wrapper component that ensures navigation is ready before rendering content
// Memoized to prevent re-renders that might cause navigation context issues
const Leaderboard = React.memo(() => {
  const rootNavigationState = useRootNavigationState();
  
  // Wait for navigation to be ready
  if (!rootNavigationState?.key) {
    return <LoadingScreen message="Loading leaderboard..." variant="minimal" />;
  }
  
  // Only render content when navigation is ready
  return <LeaderboardContent />;
});

export default Leaderboard;

