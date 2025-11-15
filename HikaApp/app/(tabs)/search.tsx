import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const Search = () => {
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect to welcome if not authenticated
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  if (loading || !user) {
    return <LoadingScreen message="Loading search..." variant="minimal" />;
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Search Trails</Text>
        
        {/* Search Input */}
        <View className="mb-6">
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Search for trails..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text className="text-gray-600">
          Trail search functionality coming soon...
        </Text>
      </View>
    </ScrollView>
  );
};

export default Search;