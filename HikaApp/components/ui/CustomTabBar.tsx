import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  onAddHikePress: () => void;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, descriptors, navigation, onAddHikePress }) => {
  return (
    <View style={styles.safeArea}>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFFFFF' }}>
        <View style={styles.tabBarContainer}>
        <View style={styles.tabBarContent}>
        {/* Left tabs: Home and Search */}
        {state.routes.slice(0, 2).map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = route.name === 'home' 
            ? (isFocused ? 'home' : 'home-outline')
            : (isFocused ? 'search' : 'search-outline');

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={[
                styles.tabButton,
                isFocused && styles.tabButtonActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={iconName}
                size={isFocused ? 26 : 22}
                color={isFocused ? "#92C59F" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { 
                    color: isFocused ? "#92C59F" : "#6B7280",
                    fontWeight: isFocused ? '700' : '600',
                  },
                ]}
              >
                {options.title || route.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Center Add Hike Button */}
        <TouchableOpacity
          style={styles.centerButton}
          onPress={onAddHikePress}
          accessibilityRole="button"
          accessibilityLabel="Add Hike"
          activeOpacity={0.8}
        >
          <View style={styles.centerButtonInner}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Right tabs: Leaderboard and Profile */}
        {state.routes.slice(2).map((route, index) => {
          const actualIndex = index + 2;
          const { options } = descriptors[route.key];
          const isFocused = state.index === actualIndex;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = route.name === 'leaderboard'
            ? (isFocused ? 'trophy' : 'trophy-outline')
            : (isFocused ? 'person' : 'person-outline');

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={[
                styles.tabButton,
                isFocused && styles.tabButtonActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={iconName}
                size={isFocused ? 26 : 22}
                color={isFocused ? "#92C59F" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { 
                    color: isFocused ? "#92C59F" : "#6B7280",
                    fontWeight: isFocused ? '700' : '600',
                  },
                ]}
              >
                {options.title || route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        </View>
      </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  tabBarContainer: {
    height: 70,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minWidth: 0,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#F0FDF4',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  centerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 0,
  },
  centerButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4ADE80',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4ADE80',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

