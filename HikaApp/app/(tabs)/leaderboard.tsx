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
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        {/* Header */}
        <Text className="text-3xl font-bold text-gray-900 mb-6">Leaderboard</Text>

        {/* Type Filter (Global/Friends) */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <View className="flex-row space-x-2">
              {(['global', 'friends'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setLeaderboardType(type)}
                  className={`px-4 py-2 rounded-full border ${
                    leaderboardType === type
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`font-medium capitalize ${
                      leaderboardType === type ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {type === 'global' ? 'Global' : 'Friends'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Period Filter */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Time Period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <View className="flex-row space-x-2">
              {(['daily', 'weekly', 'monthly', 'yearly'] as LeaderboardPeriod[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-full border ${
                    period === p
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`font-medium capitalize ${
                      period === p ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Stat Filter */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Stat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <View className="flex-row space-x-2">
              {(['distance', 'hikes', 'time'] as LeaderboardStat[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStat(s)}
                  className={`px-4 py-2 rounded-full border ${
                    stat === s
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`font-medium capitalize ${
                      stat === s ? 'text-white' : 'text-gray-700'
                    }`}
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
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#10b981" />
            <Text className="text-gray-500 mt-4">Loading leaderboard...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View className="py-12 items-center">
            <Ionicons name="trophy-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-500 mt-4 text-center">
              {leaderboardType === 'friends' 
                ? 'No friends on the leaderboard yet.' 
                : 'No entries found.'}
            </Text>
          </View>
        ) : (
          <View className="space-y-2">
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
                  className={`flex-row items-center p-4 rounded-lg border ${
                    isCurrentUser 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Rank */}
                  <View className="w-12 items-center">
                    {rankIcon ? (
                      <Ionicons name={rankIcon.name} size={24} color={rankIcon.color} />
                    ) : (
                      <Text className={`text-lg font-bold ${
                        isCurrentUser ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {entry.rank}
                      </Text>
                    )}
                  </View>

                  {/* Profile Picture */}
                  {entry.userProfilePictureUrl ? (
                    <Image
                      source={{ uri: entry.userProfilePictureUrl }}
                      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#E5E7EB' }}
                      contentFit="cover"
                      className="mr-3"
                    />
                  ) : (
                    <View className="w-12 h-12 bg-green-500 rounded-full items-center justify-center mr-3">
                      <Text className="text-white font-bold text-lg">
                        {entry.userDisplayName?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* User Info */}
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className={`text-base font-semibold ${
                        isCurrentUser ? 'text-green-700' : 'text-gray-900'
                      }`}>
                        {entry.userDisplayName}
                      </Text>
                      {isCurrentUser && (
                        <Text className="ml-2 text-xs text-green-600 font-medium">(You)</Text>
                      )}
                    </View>
                    <Text className="text-sm text-gray-600 mt-1">
                      {formatValue(entry.value, stat)}
                    </Text>
                  </View>

                  {/* Value */}
                  <View className="items-end">
                    <Text className={`text-lg font-bold ${
                      isCurrentUser ? 'text-green-600' : 'text-gray-900'
                    }`}>
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

