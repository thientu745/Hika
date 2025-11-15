// Using React Native's built-in Animated API as fallback
// This works without needing to rebuild the app
import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
  variant?: 'default' | 'minimal';
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  showLogo = false,
  variant = 'default',
}) => {
  // Animation values using React Native's Animated API
  const fadeAnim = useRef(new Animated.Value(0.3)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in/out animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Scale pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Staggered dot animations
    const createDotAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createDotAnimation(dot1Anim, 0).start();
    createDotAnimation(dot2Anim, 200).start();
    createDotAnimation(dot3Anim, 400).start();
  }, []);

  if (variant === 'minimal') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
        {message && (
          <Animated.Text
            style={{ opacity: fadeAnim }}
            className="mt-4 text-gray-600"
          >
            {message}
          </Animated.Text>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white">
      {showLogo && (
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
          className="mb-8"
        >
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center">
            <Text className="text-4xl font-bold text-white">H</Text>
          </View>
        </Animated.View>
      )}

      {/* Animated dots */}
      <View className="flex-row items-center mb-4">
        <Animated.View
          style={{
            transform: [{ scale: dot1Anim }],
            opacity: dot1Anim.interpolate({
              inputRange: [1, 1.3],
              outputRange: [0.5, 1],
            }),
            marginHorizontal: 4,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#10b981',
          }}
        />
        <Animated.View
          style={{
            transform: [{ scale: dot2Anim }],
            opacity: dot2Anim.interpolate({
              inputRange: [1, 1.3],
              outputRange: [0.5, 1],
            }),
            marginHorizontal: 4,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#10b981',
          }}
        />
        <Animated.View
          style={{
            transform: [{ scale: dot3Anim }],
            opacity: dot3Anim.interpolate({
              inputRange: [1, 1.3],
              outputRange: [0.5, 1],
            }),
            marginHorizontal: 4,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#10b981',
          }}
        />
      </View>

      {/* Loading text */}
      <Animated.Text style={{ opacity: fadeAnim }} className="text-gray-600 text-base">
        {message}
      </Animated.Text>
    </View>
  );
};

