# Database Setup Documentation

## Overview
This document outlines the database structure and setup for the Hika hiking trails app.

## Firebase Configuration
- **Firestore Database**: Initialized in `firebaseConfig.ts`
- **Firebase Storage**: Initialized for image storage
- **Firebase Authentication**: Already configured

## Database Collections

### 1. `users` Collection
Stores user profiles with the following structure:
- `uid` (string): User ID from Firebase Auth
- `email` (string): User email
- `displayName` (string): User's display name
- `bio` (string, optional): User biography
- `profilePictureUrl` (string, optional): URL to profile picture
- `createdAt` (timestamp): Account creation date
- `updatedAt` (timestamp): Last update date
- `totalDistance` (number): Total distance hiked in meters
- `totalHikes` (number): Total number of hikes completed
- `totalTime` (number): Total time spent hiking in seconds
- `xp` (number): Experience points
- `rank` (string): User rank (Copper, Bronze, Silver, Gold, Platinum, Diamond)
- `achievements` (array): Array of achievement IDs
- `following` (array): Array of user UIDs being followed
- `followers` (array): Array of user UIDs following this user
- `favorites` (array): Array of trail IDs in favorites
- `completed` (array): Array of trail IDs completed
- `wishlist` (array): Array of trail IDs in wishlist

### 2. `trails` Collection
Stores hiking trail information:
- `id` (string): Trail ID
- `name` (string): Trail name
- `description` (string): Trail description
- `location` (string): Location (city, state, or coordinates)
- `coordinates` (object): `{ latitude: number, longitude: number }`
- `distance` (number): Trail distance in meters
- `elevationGain` (number): Elevation gain in meters
- `elevationLoss` (number, optional): Elevation loss in meters
- `difficulty` (string): Easy, Moderate, Hard, or Expert
- `images` (array): Array of image URLs
- `rating` (number): Average rating (0-5)
- `ratingCount` (number): Number of ratings
- `path` (array, optional): Array of coordinates for trail path
- `createdAt` (timestamp): Creation date
- `updatedAt` (timestamp): Last update date

### 3. `posts` Collection
Stores user posts about completed hikes:
- `id` (string): Post ID
- `userId` (string): User ID who created the post
- `userDisplayName` (string): User's display name
- `userProfilePictureUrl` (string, optional): User's profile picture URL
- `trailId` (string): Trail ID
- `trailName` (string): Trail name
- `location` (string): Location
- `images` (array): Array of image URLs
- `description` (string): Post description
- `distance` (number, optional): Distance hiked in meters
- `time` (number, optional): Time taken in seconds
- `elevationGain` (number, optional): Elevation gained in meters
- `likes` (array): Array of user UIDs who liked the post
- `comments` (array): Array of comment objects
- `shares` (number): Number of shares
- `createdAt` (timestamp): Creation date
- `updatedAt` (timestamp): Last update date

### 4. `trailRatings` Collection
Stores individual trail ratings:
- `id` (string): Rating ID (format: `{trailId}_{userId}`)
- `trailId` (string): Trail ID
- `userId` (string): User ID
- `rating` (number): Rating (1-5 stars)
- `review` (string, optional): Review text
- `createdAt` (timestamp): Creation date
- `updatedAt` (timestamp): Last update date

### 5. `activeTrails` Collection
Stores currently active trail sessions:
- `userId` (string): User ID (used as document ID)
- `trailId` (string): Trail ID
- `startTime` (timestamp): Trail start time
- `startLocation` (object): `{ latitude: number, longitude: number }`
- `currentLocation` (object): `{ latitude: number, longitude: number }`
- `distanceTraveled` (number): Distance traveled in meters
- `timeElapsed` (number): Time elapsed in seconds
- `elevationGain` (number): Elevation gained in meters
- `path` (array): Array of location points with timestamps

### 6. `achievements` Collection
Stores achievement definitions:
- `id` (string): Achievement ID
- `name` (string): Achievement name
- `description` (string): Achievement description
- `icon` (string): Icon name or URL
- `xpReward` (number): XP reward for unlocking
- `category` (string): Distance, Hikes, Time, Social, or Special
- `requirement` (object): Achievement requirement details

## Database Service Functions

All database operations are handled through functions in `services/database.ts`:

### User Operations
- `createUserProfile()`: Create a new user profile
- `getUserProfile()`: Get user profile by UID
- `updateUserProfile()`: Update user profile
- `addTrailToList()`: Add trail to favorites/completed/wishlist
- `removeTrailFromList()`: Remove trail from list
- `followUser()`: Follow a user
- `unfollowUser()`: Unfollow a user

### Trail Operations
- `createTrail()`: Create a new trail
- `getTrail()`: Get trail by ID
- `searchTrails()`: Search trails (basic implementation)
- `updateTrailRating()`: Update trail average rating

### Post Operations
- `createPost()`: Create a new post
- `getPost()`: Get post by ID
- `getUserPosts()`: Get posts by user ID
- `getFeedPosts()`: Get feed posts from followed users
- `likePost()`: Like a post
- `unlikePost()`: Unlike a post
- `addComment()`: Add comment to post

### Achievement Operations
- `getAchievements()`: Get all achievements
- `addUserAchievement()`: Add achievement to user

### Leaderboard Operations
- `getLeaderboard()`: Get leaderboard entries (simplified version)

### Active Trail Operations
- `setActiveTrail()`: Create or update active trail
- `getActiveTrail()`: Get active trail for user
- `deleteActiveTrail()`: Delete active trail

### Trail Rating Operations
- `createOrUpdateTrailRating()`: Create or update trail rating

## Authentication

Authentication is handled through Firebase Auth and managed via `contexts/AuthContext.tsx`:
- `useAuth()` hook provides access to:
  - `user`: Firebase Auth user object
  - `userProfile`: User profile from Firestore
  - `loading`: Loading state
  - `signIn()`: Sign in function
  - `signUp()`: Sign up function
  - `signOut()`: Sign out function
  - `refreshUserProfile()`: Refresh user profile

## Next Steps

1. **Set up Firestore Security Rules**: Configure rules to protect user data
2. **Implement Cloud Functions**: For leaderboard calculations and other server-side operations
3. **Set up Algolia**: For advanced trail search functionality
4. **Add Image Upload**: Implement Firebase Storage upload for profile pictures and trail images
5. **Implement Real-time Updates**: Use Firestore listeners for real-time feed updates

## Security Rules Example (to be added to Firebase Console)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trails collection
    match /trails/{trailId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Posts collection
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Active trails
    match /activeTrails/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

