/**
 * TypeScript types and interfaces for Hika app
 */

// User Profile Types
export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  bio?: string;
  profilePictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Stats
  totalDistance: number; // in meters
  totalHikes: number;
  totalTime: number; // in seconds
  
  // Game Features
  xp: number;
  rank: UserRank;
  achievements: string[]; // Array of achievement IDs
  
  // Social
  following: string[]; // Array of user UIDs
  followers: string[]; // Array of user UIDs
  
  // Lists
  favorites: string[]; // Array of trail IDs
  completed: string[]; // Array of trail IDs
  wishlist: string[]; // Array of trail IDs
}

export type UserRank = 'Copper' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

// Trail Types
export interface Trail {
  id: string;
  name: string;
  description: string;
  location: string; // City, State or coordinates
  coordinates: {
    latitude: number;
    longitude: number;
  };
  distance: number; // in meters
  elevationGain: number; // in meters
  elevationLoss?: number; // in meters
  difficulty: TrailDifficulty;
  images: string[]; // Array of image URLs
  rating: number; // Average rating (0-5)
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Trail path coordinates for map rendering
  path?: {
    latitude: number;
    longitude: number;
  }[];
}

export type TrailDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'Expert';

// Post Types
export interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfilePictureUrl?: string;
  trailId: string;
  trailName: string;
  location: string;
  
  // Content
  images: string[]; // Array of image URLs
  description: string;
  
  // Stats from the hike
  distance?: number; // in meters
  time?: number; // in seconds
  elevationGain?: number; // in meters
  
  // Engagement
  likes: string[]; // Array of user UIDs who liked
  comments: Comment[];
  shares: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  userDisplayName: string;
  userProfilePictureUrl?: string;
  text: string;
  createdAt: Date;
}

// Achievement Types
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // Icon name or URL
  xpReward: number;
  category: AchievementCategory;
  requirement: AchievementRequirement;
}

export type AchievementCategory = 'Distance' | 'Hikes' | 'Time' | 'Social' | 'Special';

export interface AchievementRequirement {
  type: 'distance' | 'hikes' | 'time' | 'social' | 'custom';
  value: number;
  description: string;
}

// Leaderboard Types
export interface LeaderboardEntry {
  userId: string;
  userDisplayName: string;
  userProfilePictureUrl?: string;
  value: number; // The stat value (distance, hikes, or time)
  rank: number;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type LeaderboardStat = 'distance' | 'hikes' | 'time';

export interface Leaderboard {
  period: LeaderboardPeriod;
  stat: LeaderboardStat;
  entries: LeaderboardEntry[];
  updatedAt: Date;
}

// Active Trail Types
export interface ActiveTrail {
  userId: string;
  trailId: string;
  startTime: Date;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  currentLocation: {
    latitude: number;
    longitude: number;
  };
  distanceTraveled: number; // in meters
  timeElapsed: number; // in seconds
  elevationGain: number; // in meters
  path: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  }[];
}

// Trail Rating Types
export interface TrailRating {
  id: string;
  trailId: string;
  userId: string;
  rating: number; // 1-5 stars
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types (for future use)
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string; // ID of related post, user, trail, etc.
  read: boolean;
  createdAt: Date;
}

export type NotificationType = 'like' | 'comment' | 'follow' | 'achievement' | 'leaderboard';

