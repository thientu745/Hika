import React from 'react';
import { View, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const Header: React.FC = () => {
  return (
    <SafeAreaView edges={['top']} className="bg-white border-b border-gray-200" style={{ zIndex: 10 }}>
      <View
        className={
          'w-full ' +
          (Platform.OS === 'web' ? 'px-6 py-4' : 'px-4 py-3')
        }
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-extrabold text-hika-darkgreen">Hika</Text>
          <Text className="text-sm text-gray-500">Explore trails & friends</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Header;
