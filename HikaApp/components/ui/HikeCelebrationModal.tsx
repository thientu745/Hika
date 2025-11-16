import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile } from '../../services/database';
import type { UserProfile, UserRank } from '../../types';

interface HikeCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  xpGained: number;
  userId: string;
  trailName: string;
}

// Rank thresholds
const RANK_THRESHOLDS: Record<
  UserRank,
  { min: number; max: number; next?: UserRank }
> = {
  Copper: { min: 0, max: 999, next: 'Bronze' },
  Bronze: { min: 1000, max: 4999, next: 'Silver' },
  Silver: { min: 5000, max: 14999, next: 'Gold' },
  Gold: { min: 15000, max: 49999, next: 'Platinum' },
  Platinum: { min: 50000, max: 149999, next: 'Diamond' },
  Diamond: { min: 150000, max: Infinity },
};

// Rank visual indicators
const getRankVisuals = (rank: UserRank) => {
  const visuals: Record<
    UserRank,
    {
      icon: keyof typeof Ionicons.glyphMap;
      color: string;
      bgColor: string;
    }
  > = {
    Copper: {
      icon: 'trophy',
      color: '#B87333',
      bgColor: '#F5E6D3',
    },
    Bronze: {
      icon: 'trophy',
      color: '#CD7F32',
      bgColor: '#F5E6D3',
    },
    Silver: {
      icon: 'trophy',
      color: '#C0C0C0',
      bgColor: '#F0F0F0',
    },
    Gold: { icon: 'trophy', color: '#FFD700', bgColor: '#FFF9E6' },
    Platinum: {
      icon: 'star',
      color: '#E5E4E2',
      bgColor: '#F5F5F5',
    },
    Diamond: {
      icon: 'star',
      color: '#B9F2FF',
      bgColor: '#E6F7FF',
    },
  };
  return visuals[rank];
};

// Helper function to calculate XP progress
const getXPProgress = (currentXP: number, currentRank: UserRank) => {
  const rankInfo = RANK_THRESHOLDS[currentRank];
  const xpInCurrentRank = currentXP - rankInfo.min;
  const xpNeededForCurrentRank = rankInfo.max - rankInfo.min + 1;
  const progressPercent = Math.min(
    100,
    (xpInCurrentRank / xpNeededForCurrentRank) * 100
  );

  let xpNeededForNextRank: number | null = null;
  let nextRank: UserRank | null = null;

  if (rankInfo.next) {
    nextRank = rankInfo.next;
    const nextRankInfo = RANK_THRESHOLDS[rankInfo.next];
    xpNeededForNextRank = nextRankInfo.min - currentXP;
  }

  return {
    currentXP,
    currentRank,
    xpInCurrentRank,
    xpNeededForCurrentRank,
    progressPercent,
    xpNeededForNextRank,
    nextRank,
    rankMin: rankInfo.min,
    rankMax: rankInfo.max === Infinity ? currentXP : rankInfo.max,
  };
};

export const HikeCelebrationModal: React.FC<HikeCelebrationModalProps> = ({
  visible,
  onClose,
  xpGained,
  userId,
  trailName,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRankUp, setShowRankUp] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const xpTextAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && userId) {
      // Reset state when modal opens
      setShowRankUp(false);
      progressAnim.setValue(0);
      xpTextAnim.setValue(0);
      confettiAnim.setValue(0);
      loadUserProfile();
    }
  }, [visible, userId]);

  useEffect(() => {
    if (visible && userProfile) {
      // Check if rank changed
      const oldXP = (userProfile.xp || 0) - xpGained;
      const newXP = userProfile.xp || 0;
      
      // Calculate old and new ranks
      const calculateRankFromXP = (xp: number): UserRank => {
        if (xp >= 150000) return 'Diamond';
        if (xp >= 50000) return 'Platinum';
        if (xp >= 15000) return 'Gold';
        if (xp >= 5000) return 'Silver';
        if (xp >= 1000) return 'Bronze';
        return 'Copper';
      };
      
      const oldRank = calculateRankFromXP(oldXP);
      const newRank = calculateRankFromXP(newXP);

      // Check if we crossed a rank threshold
      if (oldRank !== newRank) {
        setShowRankUp(true);
      }

      // Animate XP text
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(xpTextAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate progress bar
      const currentRank = (userProfile.rank || 'Copper') as UserRank;
      const oldProgress = getXPProgress(oldXP, currentRank);
      const newProgress = getXPProgress(newXP, currentRank);

      progressAnim.setValue(oldProgress.progressPercent);
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(progressAnim, {
          toValue: newProgress.progressPercent,
          duration: 2000,
          useNativeDriver: false,
        }),
      ]).start();

      // Animate confetti if rank up
      if (oldRank !== newRank) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(confettiAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(confettiAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    }
  }, [visible, userProfile, xpGained]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const profile = await getUserProfile(userId);
      if (profile) {
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || loading || !userProfile) {
    return null;
  }

  const currentRank = (userProfile.rank || 'Copper') as UserRank;
  const currentXP = userProfile.xp || 0;
  const oldXP = currentXP - xpGained;
  const progress = getXPProgress(currentXP, currentRank);
  const oldProgress = getXPProgress(oldXP, currentRank);
  const rankVisuals = getRankVisuals(currentRank);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const xpTextOpacity = xpTextAnim;
  const confettiRotation = confettiAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Confetti effect for rank up */}
          {showRankUp && (
            <Animated.View
              style={[
                styles.confettiContainer,
                {
                  transform: [{ rotate: confettiRotation }],
                },
              ]}
            >
              <Ionicons name="star" size={40} color="#FFD700" style={styles.confetti1} />
              <Ionicons name="star" size={35} color="#FFD700" style={styles.confetti2} />
              <Ionicons name="star" size={30} color="#FFD700" style={styles.confetti3} />
            </Animated.View>
          )}

          {/* Celebration Icon */}
          <View style={styles.iconContainer}>
            {showRankUp ? (
              <View style={[styles.rankBadge, { backgroundColor: rankVisuals.bgColor }]}>
                <Ionicons name={rankVisuals.icon} size={64} color={rankVisuals.color} />
              </View>
            ) : (
              <View style={styles.celebrationIcon}>
                <Ionicons name="trophy" size={64} color="#FFD700" />
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {showRankUp ? '🎉 Rank Up! 🎉' : 'Hike Completed!'}
          </Text>

          {/* Trail Name */}
          <Text style={styles.trailName}>{trailName}</Text>

          {/* XP Gained */}
          <Animated.View
            style={[
              styles.xpContainer,
              {
                opacity: xpTextOpacity,
              },
            ]}
          >
            <Text style={styles.xpLabel}>XP Gained</Text>
            <Text style={styles.xpValue}>+{xpGained} XP</Text>
          </Animated.View>

          {/* Rank Display */}
          <View style={styles.rankContainer}>
            <View style={[styles.rankBadge, { backgroundColor: rankVisuals.bgColor }]}>
              <Ionicons name={rankVisuals.icon} size={24} color={rankVisuals.color} />
              <Text style={[styles.rankText, { color: rankVisuals.color }]}>
                {currentRank}
              </Text>
            </View>
            <Text style={styles.xpTotal}>{currentXP.toLocaleString()} XP</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressWidth,
                    backgroundColor: rankVisuals.color,
                  },
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>
                {progress.rankMin.toLocaleString()} XP
              </Text>
              <Text style={styles.progressLabel}>
                {progress.rankMax === Infinity
                  ? '∞'
                  : progress.rankMax.toLocaleString()}{' '}
                XP
              </Text>
            </View>
            {progress.nextRank && progress.xpNeededForNextRank !== null && (
              <Text style={styles.nextRankText}>
                {progress.xpNeededForNextRank.toLocaleString()} XP until {progress.nextRank}
              </Text>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Awesome!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  confettiContainer: {
    position: 'absolute',
    top: -20,
    width: '100%',
    height: '100%',
  },
  confetti1: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  confetti2: {
    position: 'absolute',
    top: 30,
    right: 30,
  },
  confetti3: {
    position: 'absolute',
    bottom: 40,
    left: '50%',
  },
  iconContainer: {
    marginBottom: 16,
  },
  celebrationIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  trailName: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  xpContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  xpLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  xpValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#10b981',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  xpTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBarBackground: {
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 12,
    minWidth: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  nextRankText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default HikeCelebrationModal;

