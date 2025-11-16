import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, displayName.trim());
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-hika-green px-6 justify-center">
      <View className="items-center">
        <Image
          source={require('../assets/images/signup.png')}
          style={{ width: 125, height: 125 }}
          resizeMode="contain"
        />
      </View>

      <View className="max-w-sm w-full mx-auto mb-14">
        {/* Header */}
        <Text className="text-3xl font-bold text-black mb-2 self-center">Create Account</Text>
        <Text className="text-black mb-8 self-center">Join Hika and start exploring trails</Text>

        {/* Display Name Input */}
        <View className="mb-4">
          <Text className="text-black mb-2 font-medium">Display Name</Text>
          <TextInput
            className="border border-black rounded-lg px-4 py-3 text-black bg-white"
            placeholder="Enter your display name"
            placeholderTextColor={"black"}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>

        {/* Email Input */}
        <View className="mb-4">
          <Text className="text-black mb-2 font-medium">Email</Text>
          <TextInput
            className="border border-black rounded-lg px-4 py-3 text-black bg-white"
            placeholder="Enter your email"
            placeholderTextColor={"black"}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        {/* Password Input */}
        <View className="mb-6">
          <Text className="text-black mb-2 font-medium">Password</Text>
          <TextInput
            className="border border-black rounded-lg px-4 py-3 text-black bg-white"
            placeholder="Enter your password (min. 6 characters)"
            placeholderTextColor={"black"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />
        </View>

        {/* Sign Up Button */}
        <TouchableOpacity
          className="bg-hika-darkgreen py-4 px-6 rounded-lg items-center mb-4"
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-semibold">Sign Up</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View className="flex-row justify-center items-center">
          <Text className="text-black">Already have an account? </Text>
          <Link href="/login" asChild>
            <TouchableOpacity>
              <Text className="text-black font-semibold">Log In</Text>
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

