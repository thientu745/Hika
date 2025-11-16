import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from "expo-image";

export const Header: React.FC = () => {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.logo}>Hika</Text>
          <Image
            source={require('../../assets/images/header.png')}
            style={styles.headerImage}
            contentFit="contain"
          />
          <Text style={styles.tagline}>Explore trails & friends</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    zIndex: 10,
  },
  container: {
    width: '100%',
    paddingHorizontal: Platform.OS === 'web' ? 20 : 12,
    paddingVertical: Platform.OS === 'web' ? 4 : 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#516D58',
  },
  headerImage: {
    width: 36,
    height: 36,
  },
  tagline: {
    fontSize: 10,
    color: '#6B7280',
    maxWidth: 90,
    textAlign: 'right',
  },
});

export default Header;
