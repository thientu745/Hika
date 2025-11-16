import React from 'react';
import { View, Text, Platform } from 'react-native';

export const Header: React.FC = () => {
  return (
    <View
      className={
        'w-full bg-white border-b border-gray-200 ' +
        (Platform.OS === 'web' ? 'px-6 py-4' : 'px-4 py-3')
      }
      style={{ zIndex: 10 }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-extrabold text-green-600">Hika</Text>
        <Text className="text-sm text-gray-500">Explore trails & friends</Text>
      </View>
    </View>
  );
};

export default Header;
