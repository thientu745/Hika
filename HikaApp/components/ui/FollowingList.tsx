import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
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
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
          <Text className="text-xl font-bold text-gray-900">Following</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView className="flex-1">
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
    </Modal>
  );
};

export default FollowingList;

