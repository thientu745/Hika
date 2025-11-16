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
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
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
              style={styles.tabButton}
            >
              <Ionicons
                name={iconName}
                size={isFocused ? 28 : 24}
                color={isFocused ? "#92C59F" : "#516D58"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? "#92C59F" : "#516D58" },
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
        >
          <View style={styles.centerButtonInner}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
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
            ? 'trophy-outline'
            : (isFocused ? 'person' : 'person-outline');

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              style={styles.tabButton}
            >
              <Ionicons
                name={iconName}
                size={isFocused ? 28 : 24}
                color={isFocused ? "#92C59F" : "#516D58"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? "#92C59F" : "#516D58" },
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
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#ffffff',
  },
  tabBarContainer: {
    height: 60,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 12,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

