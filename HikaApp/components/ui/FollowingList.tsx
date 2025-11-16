import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile, searchUsers } from '../../services/database';
import { getRankBorderStyle } from '../../utils/rankStyles';
import type { UserProfile, UserRank } from '../../types';

interface FollowingListProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export const FollowingList: React.FC<FollowingListProps> = ({
  visible,
  userId,
  onClose,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (visible && userId) {
      loadFollowingUsers();
    }
  }, [visible, userId]);

  const loadFollowingUsers = async () => {
    setLoading(true);
    try {
      const profile = await getUserProfile(userId);
      if (profile && profile.following && profile.following.length > 0) {
        const users: UserProfile[] = [];
        for (const uid of profile.following) {
          try {
            const user = await getUserProfile(uid);
            if (user) {
              users.push(user);
            }
          } catch (err) {
            console.warn(`Failed to load user ${uid}:`, err);
          }
        }
        setFollowingUsers(users);
      } else {
        setFollowingUsers([]);
      }
    } catch (error) {
      console.error('Error loading following users:', error);
      setFollowingUsers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContentWrapper}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderText}>Following</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
          {loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#10b981" />
              <Text className="text-gray-500 mt-2">Loading...</Text>
            </View>
          ) : followingUsers.length === 0 ? (
            <View className="py-8 items-center">
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-500 mt-2 text-center">
                Not following anyone yet
              </Text>
            </View>
          ) : (
            <View className="px-4 py-4">
              {followingUsers.map((user) => (
                <TouchableOpacity
                  key={user.uid}
                  onPress={() => {
                    onClose();
                    router.push(`/profile/${user.uid}` as any);
                  }}
                  className="flex-row items-center p-3 rounded-lg mb-2 bg-gray-50"
                >
                  {user.profilePictureUrl ? (
                    <Image
                      source={{ uri: user.profilePictureUrl }}
                      style={[
                        {
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                        },
                        getRankBorderStyle((user.rank || 'Copper') as UserRank),
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        {
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: '#10b981',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                        getRankBorderStyle((user.rank || 'Copper') as UserRank),
                      ]}
                    >
                      <Text className="text-white font-bold text-lg">
                        {user.displayName?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="text-gray-900 font-semibold">
                      {user.displayName}
                    </Text>
                    {user.bio && (
                      <Text className="text-gray-600 text-sm mt-1" numberOfLines={1}>
                        {user.bio}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          )}
            </ScrollView>
          </View>
          <SafeAreaView edges={['bottom']} style={styles.safeAreaBottom} />
        </View>
      </View>
    </Modal>
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
    maxHeight: Platform.OS === 'web' ? '70%' : '75%',
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
    maxHeight: Platform.OS === 'web' ? 500 : 400,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  safeAreaBottom: {
    backgroundColor: '#FFFFFF',
  },
});

export default FollowingList;

