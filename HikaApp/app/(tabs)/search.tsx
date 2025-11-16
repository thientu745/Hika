import { View, Text, ScrollView } from "react-native";
import React, { useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { searchTrails } from "../../services/database";

import type { Trail } from "../../types";

const Search = () => {
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [trailResults, setTrailResults] = useState<Trail[]>([]);
  const [searching, setSearching] = useState(false);

  // Redirect to welcome if not authenticated
  if (!loading && !user) {
    return <Redirect href="/welcome" />;
  }

  if (loading || !user) {
    return <LoadingScreen message="Loading search..." variant="minimal" />;
  }

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await searchTrails(searchQuery, undefined, undefined, 30);
      setTrailResults(res);
    } catch (e) {
      console.warn("Search error", e);
      setTrailResults([]);
    }
    setSearching(false);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Search Trails
        </Text>

        <Input
          placeholder={"Search trails by name, description or location"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerClassName="mb-4"
        />

        <Button title="Search" onPress={handleSearch} loading={searching} />

        <View className="mt-6">
          {trailResults.length === 0 && !searching ? (
            <Text className="text-gray-600">No trails found.</Text>
          ) : (
            trailResults.map((t) => (
              <View key={t.id} className="py-3 border-b border-gray-100">
                <Text className="text-gray-900 font-medium">{t.name}</Text>
                <Text className="text-gray-500 text-sm">{t.location}</Text>
                <Text className="text-gray-700 mt-1">{t.description}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Search;
