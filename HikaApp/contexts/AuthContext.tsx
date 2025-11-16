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
import { auth, db } from '../firebaseConfig';
import { getUserProfile, createUserProfile } from '../services/database';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  followRefreshToken: number;
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
  const [followRefreshToken, setFollowRefreshToken] = useState(0);

  // Refresh user profile from Firestore
  const refreshUserProfile = async () => {
    if (user) {
      setProfileLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        setFollowRefreshToken((t) => t + 1);
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
    let unsubscribeAuth = () => {};
    let unsubscribeProfile: (() => void) | null = null;

    unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      // Set loading to false immediately after auth state is known
      // Don't wait for profile to load
      setLoading(false);

      if (firebaseUser) {
        // Use realtime listener to keep user profile in sync
        setProfileLoading(true);
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          unsubscribeProfile = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setUserProfile({
                uid: snap.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                updatedAt: data.updatedAt?.toDate?.() || new Date(),
              } as UserProfile);
              setFollowRefreshToken((t) => t + 1);
            } else {
              // If no document yet, fall back to minimal profile from auth
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
            setProfileLoading(false);
          });
        } catch (error) {
          console.error('Error setting up profile listener:', error);
          // Fallback: try one-time fetch
          try {
            const profile = await getUserProfile(firebaseUser.uid);
            setUserProfile(profile);
          } catch (err) {
            console.error('Error loading user profile:', err);
          }
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
        setProfileLoading(false);
        if (unsubscribeProfile) {
          try {
            unsubscribeProfile();
          } catch {}
          unsubscribeProfile = null;
        }
      }
    });

    return () => {
      try {
        unsubscribeAuth();
      } catch {}
      if (unsubscribeProfile) {
        try {
          unsubscribeProfile();
        } catch {}
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      // User profile will be loaded by onAuthStateChanged
    } catch (error: any) {
      // Log full error for debugging
      console.error('Firebase sign in error:', {
        code: error?.code,
        message: error?.message,
        fullError: error,
      });
      
      // Provide more helpful error messages
      let errorMessage = 'Invalid email or password. Please try again.';
      
      // Handle authentication errors with specific messages
      // Note: Firebase's Email Enumeration Protection prevents us from reliably checking if email exists
      // So we only provide specific messages when Firebase gives us clear error codes
      if (error?.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error?.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error?.code === 'auth/invalid-credential') {
        // auth/invalid-credential is used for both wrong password and non-existent email
        // With Email Enumeration Protection, we can't differentiate, so use generic message
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error?.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check your email and try again.';
      } else if (error?.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (error?.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error?.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Always throw an error with a message
      const loginError = new Error(errorMessage);
      console.error('Throwing login error:', errorMessage);
      throw loginError;
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
    followRefreshToken,
    signIn,
    signUp,
    signOut,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

