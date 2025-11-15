/**
 * Authentication Context for managing user authentication state
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getUserProfile, createUserProfile } from '../services/database';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Refresh user profile from Firestore
  const refreshUserProfile = async () => {
    if (user) {
      setProfileLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error loading user profile:', error);
        // Keep existing profile if available, don't clear it on error
      } finally {
        setProfileLoading(false);
      }
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Set loading to false immediately after auth state is known
      // Don't wait for profile to load
      setLoading(false);
      
      if (firebaseUser) {
        // Load user profile in the background (non-blocking)
        setProfileLoading(true);
        try {
          // Add timeout to prevent hanging
          const profilePromise = getUserProfile(firebaseUser.uid);
          const timeoutPromise = new Promise<UserProfile | null>((resolve) => {
            setTimeout(() => resolve(null), 5000); // 5 second timeout
          });
          
          const profile = await Promise.race([profilePromise, timeoutPromise]);
          
          if (profile) {
            setUserProfile(profile);
          } else {
            console.warn('Profile load timed out or failed');
            // Create a minimal profile from auth data as fallback
            setUserProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              bio: '',
              profilePictureUrl: '',
              createdAt: new Date(),
              updatedAt: new Date(),
              totalDistance: 0,
              totalHikes: 0,
              totalTime: 0,
              xp: 0,
              rank: 'Copper',
              achievements: [],
              following: [],
              followers: [],
              favorites: [],
              completed: [],
              wishlist: [],
            });
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          // Create minimal profile as fallback
          setUserProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            bio: '',
            profilePictureUrl: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            totalDistance: 0,
            totalHikes: 0,
            totalTime: 0,
            xp: 0,
            rank: 'Copper',
            achievements: [],
            following: [],
            followers: [],
            favorites: [],
            completed: [],
            wishlist: [],
          });
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // User profile will be loaded by onAuthStateChanged
    } catch (error: any) {
      // Provide more helpful error messages
      let errorMessage = 'An error occurred during sign in';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email and try again.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update Firebase Auth profile
      await updateProfile(userCredential.user, {
        displayName: displayName,
      });

      // Create user profile in Firestore
      await createUserProfile(userCredential.user.uid, email, displayName);
      
      // Refresh user profile
      await refreshUserProfile();
    } catch (error: any) {
      // Provide more helpful error messages
      let errorMessage = 'An error occurred during sign up';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please use a different email or try logging in.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email and try again.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password authentication is not enabled. Please contact support.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

