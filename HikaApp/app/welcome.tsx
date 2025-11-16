import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useEffect } from "react";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/home");
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingScreen message="Loading..." variant="minimal" />;
  }

  if (user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Top Section - Logo and Branding */}
          <View style={styles.topSection}>
            {/* Logo Icon */}
            <View style={styles.logoContainer}>
              <Ionicons name="trail-sign" size={56} color="#516D58" />
            </View>
            
            {/* App Name */}
            <Text style={styles.appName}>Hika</Text>
            <Text style={styles.tagline}>Your Hiking Companion</Text>
          </View>

          {/* Middle Section - Image */}
          <View style={styles.middleSection}>
            <Image
              source={require("../assets/images/welcome.png")}
              style={styles.welcomeImage}
              resizeMode="contain"
            />
          </View>

          {/* Bottom Section - Quote and Buttons */}
          <View style={styles.bottomSection}>
            {/* Quote Card */}
            <View style={styles.quoteCard}>
              <View style={styles.quoteIconContainer}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#516D58" />
              </View>
              <Text style={styles.quoteText}>
                "Take only pictures,{"\n"}leave only footprints."
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {/* Primary CTA */}
              <Link href="/signup" asChild>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                </TouchableOpacity>
              </Link>

              {/* Secondary CTA */}
              <Link href="/login" asChild>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  middleSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    marginVertical: 20,
    paddingVertical: 20,
  },
  welcomeImage: {
    width: Math.min(SCREEN_WIDTH * 0.7, 300),
    height: Math.min(SCREEN_WIDTH * 0.7, 300),
  },
  bottomSection: {
    alignItems: 'center',
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  quoteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#516D58',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#516D58',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#516D58',
    fontSize: 15,
    fontWeight: '600',
  },
});
