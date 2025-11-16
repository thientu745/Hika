import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    setError(null); // Clear previous errors
    
    if (!email || !password) {
      const errorMsg = 'Please fill in all fields';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    if (!validateEmail(email)) {
      const errorMsg = 'Please enter a valid email address';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      // Ensure error message is always displayed
      const errorMessage = error?.message || error?.toString() || 'Invalid email or password. Please try again.';
      console.error('Login error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', errorMessage);
      
      // Set error state for on-screen display
      setError(errorMessage);
      
      // Also show Alert as backup
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-hika-green px-6 justify-center">
      <View className="max-w-sm w-full mx-auto">
        {/* Header */}
        <Text className="text-3xl font-bold text-black mb-2">Welcome Back</Text>
        <Text className="text-black mb-8">Sign in to continue your hiking journey</Text>

        {/* Email Input */}
        <View className="mb-4">
          <Text className="text-black mb-2 font-medium">Email</Text>
          <TextInput
            className="border border-black rounded-lg px-4 py-3 text-black bg-white"
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null); // Clear error when user types
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        {/* Password Input */}
        <View className="mb-4">
          <Text className="text-gray-700 mb-2 font-medium">Password</Text>
          <TextInput
            className="border border-black rounded-lg px-4 py-3 text-black bg-white"
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null); // Clear error when user types
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />
        </View>

        {/* Error Message */}
        {error && (
          <View className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        )}

        {/* Login Button */}
        <TouchableOpacity
          className="bg-hika-darkgreen py-4 px-6 rounded-lg items-center mb-4"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-semibold">Log In</Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View className="flex-row justify-center items-center">
          <Text className="text-black">Don't have an account? </Text>
          <Link href="/signup" asChild>
            <TouchableOpacity>
              <Text className="text-black font-bold">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Back to Welcome */}
        <View className="mt-6">
          <Link href="/welcome" asChild>
            <TouchableOpacity>
              <Text className="text-black text-center">Back to Welcome</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

