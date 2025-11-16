/**
 * Database service functions for Firestore operations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type {
  UserProfile,
  Trail,
  Post,
  Comment,
  Achievement,
  Leaderboard,
  LeaderboardEntry,
  ActiveTrail,
  TrailRating,
  Notification,
  Message,
  Conversation,
  SharedPostData,
} from '../types';

// ==================== User Profile Operations ====================

/**
 * Create a new user profile
 */
export const createUserProfile = async (uid: string, email: string, displayName: string): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  const userProfile: Omit<UserProfile, 'uid'> = {
    email,
    displayName,
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
  };

  await setDoc(userRef, {
    ...userProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Get user profile by UID
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      uid: userSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserProfile;
  }
  return null;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Calculate rank based on XP
 */
const calculateRank = (xp: number): UserProfile['rank'] => {
  if (xp >= 150000) return 'Diamond';
  if (xp >= 50000) return 'Platinum';
  if (xp >= 15000) return 'Gold';
  if (xp >= 5000) return 'Silver';
  if (xp >= 1000) return 'Bronze';
  return 'Copper';
};

/**
 * Update user stats when a hike is logged
 * @param uid - User ID
 * @param distance - Distance in meters (optional)
 * @param time - Time in seconds (optional)
 * @param elevationGain - Elevation gain in meters (optional)
 */
export const updateUserStatsFromHike = async (
  uid: string,
  distance?: number,
  time?: number,
  elevationGain?: number
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  
  // Calculate XP for this hike
  let xpGained = 10; // Base XP for completing a hike
  
  if (distance !== undefined && distance > 0) {
    // 1 XP per 100 meters
    xpGained += Math.floor(distance / 100);
  }
  
  if (time !== undefined && time > 0) {
    // 1 XP per 10 minutes (600 seconds)
    xpGained += Math.floor(time / 600);
  }
  
  if (elevationGain !== undefined && elevationGain > 0) {
    // 1 XP per 10 meters of elevation gain
    xpGained += Math.floor(elevationGain / 10);
  }
  
  // Get current user profile to calculate new rank
  const userSnap = await getDoc(userRef);
  let currentXp = 0;
  if (userSnap.exists()) {
    currentXp = userSnap.data().xp || 0;
  }
  
  const newXp = currentXp + xpGained;
  const newRank = calculateRank(newXp);
  
  // Build update object with increments
  const updates: any = {
    totalHikes: increment(1),
    xp: increment(xpGained),
    rank: newRank,
    updatedAt: serverTimestamp(),
  };
  
  // Only increment distance and time if they are provided and valid
  if (distance !== undefined && distance > 0) {
    updates.totalDistance = increment(distance);
  }
  
  if (time !== undefined && time > 0) {
    updates.totalTime = increment(time);
  }
  
  await updateDoc(userRef, updates);
};

/**
 * Add trail to user's list (favorites, completed, or wishlist)
 */
export const addTrailToList = async (
  uid: string,
  trailId: string,
  listType: 'favorites' | 'completed' | 'wishlist'
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    [listType]: arrayUnion(trailId),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Remove trail from user's list
 */
export const removeTrailFromList = async (
  uid: string,
  trailId: string,
  listType: 'favorites' | 'completed' | 'wishlist'
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    [listType]: arrayRemove(trailId),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Follow a user
 */
export const followUser = async (currentUserId: string, targetUserId: string): Promise<void> => {
  const currentUserRef = doc(db, 'users', currentUserId);
  const targetUserRef = doc(db, 'users', targetUserId);

  await Promise.all([
    updateDoc(currentUserRef, {
      following: arrayUnion(targetUserId),
      updatedAt: serverTimestamp(),
    }),
    updateDoc(targetUserRef, {
      followers: arrayUnion(currentUserId),
      updatedAt: serverTimestamp(),
    }),
  ]);
};

/**
 * Unfollow a user
 */
export const unfollowUser = async (currentUserId: string, targetUserId: string): Promise<void> => {
  const currentUserRef = doc(db, 'users', currentUserId);
  const targetUserRef = doc(db, 'users', targetUserId);

  await Promise.all([
    updateDoc(currentUserRef, {
      following: arrayRemove(targetUserId),
      updatedAt: serverTimestamp(),
    }),
    updateDoc(targetUserRef, {
      followers: arrayRemove(currentUserId),
      updatedAt: serverTimestamp(),
    }),
  ]);
};

/**
 * Search users by displayName or username (client-side filtering).
 * Note: Firestore recommended approach is to maintain search index (Algolia) for large datasets.
 */
export const searchUsers = async (searchTerm?: string, limitCount: number = 20): Promise<UserProfile[]> => {
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  const users: UserProfile[] = [];

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    users.push({
      uid: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as UserProfile);
  });

  if (!searchTerm || searchTerm.trim() === '') {
    return users.slice(0, limitCount);
  }

  const lower = searchTerm.toLowerCase();
  const filtered = users.filter((u) => {
    const dn = (u.displayName || '').toLowerCase();
    const un = (u as any).username ? (u as any).username.toLowerCase() : '';
    return dn.includes(lower) || un.includes(lower);
  });

  return filtered.slice(0, limitCount);
};

// ==================== Trail Operations ====================

/**
 * Create a new trail
 */
export const createTrail = async (trail: Omit<Trail, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const trailsRef = collection(db, 'trails');
  const docRef = await addDoc(trailsRef, {
    ...trail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Get trail by ID
 */
export const getTrail = async (trailId: string): Promise<Trail | null> => {
  const trailRef = doc(db, 'trails', trailId);
  const trailSnap = await getDoc(trailRef);

  if (trailSnap.exists()) {
    const data = trailSnap.data();
    return {
      id: trailSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Trail;
  }
  return null;
};

/**
 * Search trails (basic implementation - can be enhanced with Algolia)
 */
export const searchTrails = async (
  searchTerm?: string,
  location?: string,
  difficulty?: string,
  limitCount: number = 20
): Promise<Trail[]> => {
  const trailsRef = collection(db, 'trails');
  let q;

  // Normalize location for matching (handle "Oregon" vs "Oregon, USA")
  const normalizedLocation = location ? location.trim() : undefined;

  // Build query based on available filters
  // Note: When we have a search term, we fetch more trails and filter client-side
  // This ensures we don't miss trails due to exact match requirements in Firestore
  // For location and difficulty, we do client-side filtering to handle format variations
  if (searchTerm) {
    // When searching by name, fetch many trails and filter everything client-side
    // This ensures we find all matching trails regardless of difficulty/location format
    let fetchLimit = limitCount * 10;
    if (normalizedLocation) {
      fetchLimit = limitCount * 15; // Even more when searching by name + location
    }
    q = query(trailsRef, orderBy('createdAt', 'desc'), limit(fetchLimit));
  } else if (difficulty && normalizedLocation) {
    // Both difficulty and location, no search term - use difficulty in query, filter location client-side
    const fetchLimit = limitCount * 6;
    q = query(
      trailsRef,
      where('difficulty', '==', difficulty),
      orderBy('createdAt', 'desc'),
      limit(fetchLimit)
    );
  } else if (difficulty) {
    // Only difficulty, no search term - use it in query
    const fetchLimit = limitCount * 5;
    q = query(
      trailsRef,
      where('difficulty', '==', difficulty),
      orderBy('createdAt', 'desc'),
      limit(fetchLimit)
    );
  } else {
    // No difficulty or search term - if we have a location, fetch more trails
    let fetchLimit = limitCount * 3;
    if (normalizedLocation) {
      // When searching by location only, fetch many more trails to ensure we get all matches
      fetchLimit = limitCount * 20; // Fetch even more when searching by location only
    }
    q = query(trailsRef, orderBy('createdAt', 'desc'), limit(fetchLimit));
  }

  const querySnapshot = await getDocs(q);
  const trails: Trail[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    trails.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Trail);
  });

  // Client-side filtering for search term, location, and difficulty (to handle format variations and edge cases)
  let filteredTrails = trails;

  // Filter by difficulty if provided (client-side as fallback to catch any edge cases)
  // This ensures trails with slightly different difficulty values or formatting are still found
  if (difficulty) {
    filteredTrails = filteredTrails.filter((trail) => {
      if (!trail.difficulty) return false;
      return trail.difficulty.toLowerCase() === difficulty.toLowerCase();
    });
  }

  // Filter by location if provided (handle format variations like "Oregon" vs "Oregon, USA")
  if (normalizedLocation) {
    const lowerLocation = normalizedLocation.toLowerCase();
    filteredTrails = filteredTrails.filter((trail) => {
      if (!trail.location) return false;
      const trailLocation = trail.location.toLowerCase();
      // Check if location matches exactly or if trail location contains the search location
      // This handles "Oregon" matching "Oregon, USA" and vice versa
      return trailLocation === lowerLocation || 
             trailLocation.includes(lowerLocation) || 
             lowerLocation.includes(trailLocation.split(',')[0].trim());
    });
  }

  // Filter by search term if provided
  if (searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    filteredTrails = filteredTrails.filter(
      (trail) =>
        (trail.name && trail.name.toLowerCase().includes(lowerSearchTerm)) ||
        (trail.description && trail.description.toLowerCase().includes(lowerSearchTerm)) ||
        (trail.location && trail.location.toLowerCase().includes(lowerSearchTerm))
    );
  }

  // Limit results
  // When searching by location, allow more results to be returned
  const finalLimit = normalizedLocation ? limitCount * 3 : limitCount;
  return filteredTrails.slice(0, finalLimit);
};

/**
 * Update trail rating
 */
export const updateTrailRating = async (trailId: string, newRating: number, ratingCount: number): Promise<void> => {
  const trailRef = doc(db, 'trails', trailId);
  await updateDoc(trailRef, {
    rating: newRating,
    ratingCount: ratingCount,
    updatedAt: serverTimestamp(),
  });
};

// ==================== Post Operations ====================

/**
 * Create a new post
 * @param post - Post data without id, createdAt, and updatedAt
 * @param options - Optional parameters for retroactive logging
 * @param options.createdAt - Optional custom creation date (for retroactive logging)
 * @param options.updatedAt - Optional custom update date (for retroactive logging)
 */
export const createPost = async (
  post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>,
  options?: { createdAt?: Date; updatedAt?: Date }
): Promise<string> => {
  const postsRef = collection(db, 'posts');
  const createdAt = options?.createdAt 
    ? Timestamp.fromDate(options.createdAt)
    : serverTimestamp();
  const updatedAt = options?.updatedAt
    ? Timestamp.fromDate(options.updatedAt)
    : serverTimestamp();
  
  const docRef = await addDoc(postsRef, {
    ...post,
    likes: [],
    comments: [],
    shares: 0,
    createdAt,
    updatedAt,
  });
  return docRef.id;
};

/**
 * Get post by ID
 */
export const getPost = async (postId: string): Promise<Post | null> => {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);

  if (postSnap.exists()) {
    const data = postSnap.data();
    return {
      id: postSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      comments: (data.comments || []).map((c: any) => ({
        ...c,
        createdAt: c.createdAt?.toDate() || new Date(),
      })),
    } as Post;
  }
  return null;
};

/**
 * Get posts by user ID
 */
export const getUserPosts = async (userId: string, limitCount: number = 20): Promise<Post[]> => {
  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(limitCount));
  const querySnapshot = await getDocs(q);
  const posts: Post[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    posts.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      comments: (data.comments || []).map((c: any) => ({
        ...c,
        createdAt: c.createdAt?.toDate() || new Date(),
      })),
    } as Post);
  });

  return posts;
};

/**
 * Get feed posts (posts from users being followed)
 */
export const getFeedPosts = async (followingUserIds: string[], limitCount: number = 20): Promise<Post[]> => {
  if (followingUserIds.length === 0) {
    return [];
  }

  const postsRef = collection(db, 'posts');
  const q = query(
    postsRef,
    where('userId', 'in', followingUserIds.slice(0, 10)), // Firestore 'in' query limit is 10
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  const posts: Post[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    posts.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      comments: (data.comments || []).map((c: any) => ({
        ...c,
        createdAt: c.createdAt?.toDate() || new Date(),
      })),
    } as Post);
  });

  return posts;
};

/**
 * Get real-time feed posts with onSnapshot listener
 * Handles chunked queries for following lists > 10 users (Firestore 'in' limit)
 */
export const subscribeToFeedPosts = (
  followingUserIds: string[],
  callback: (posts: Post[]) => void,
  limitCount: number = 50
): (() => void) => {
  if (followingUserIds.length === 0) {
    callback([]);
    return () => {};
  }

  const postsRef = collection(db, 'posts');
  const unsubscribers: (() => void)[] = [];
  const allPosts: Map<string, Post> = new Map();

  // Split following list into chunks of 10 (Firestore 'in' limit)
  const chunks: string[][] = [];
  for (let i = 0; i < followingUserIds.length; i += 10) {
    chunks.push(followingUserIds.slice(i, i + 10));
  }

  // Subscribe to each chunk
  chunks.forEach((chunk) => {
    const q = query(
      postsRef,
      where('userId', 'in', chunk),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        // Update posts from this chunk
        snap.forEach((doc) => {
          const data = doc.data();
          const post: Post = {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            comments: (data.comments || []).map((c: any) => ({
              ...c,
              createdAt: c.createdAt?.toDate() || new Date(),
            })),
          } as Post;
          allPosts.set(doc.id, post);
        });

        // Sort all posts by createdAt desc and return top limitCount
        const sorted = Array.from(allPosts.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        callback(sorted.slice(0, limitCount));
      },
      (err) => {
        console.warn('Feed listener error:', err);
      }
    );

    unsubscribers.push(unsubscribe);
  });

  // Return unsubscribe function that unsubscribes from all chunks
  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
  };
};

/**
 * Like a post
 */
export const likePost = async (postId: string, userId: string): Promise<void> => {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    likes: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Unlike a post
 */
export const unlikePost = async (postId: string, userId: string): Promise<void> => {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    likes: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Add comment to post
 */
export const addComment = async (postId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<void> => {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);

  if (postSnap.exists()) {
    const post = postSnap.data() as Post;
    const newComment: Comment = {
      id: Date.now().toString(), // Simple ID generation
      ...comment,
      createdAt: new Date(),
    };
    await updateDoc(postRef, {
      comments: arrayUnion(newComment),
      updatedAt: serverTimestamp(),
    });
  }
};

/**
 * Increment share count for a post
 */
export const incrementPostShares = async (postId: string): Promise<void> => {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    shares: increment(1),
    updatedAt: serverTimestamp(),
  });
};

// ==================== Achievement Operations ====================

/**
 * Get all achievements
 */
export const getAchievements = async (): Promise<Achievement[]> => {
  const achievementsRef = collection(db, 'achievements');
  const querySnapshot = await getDocs(achievementsRef);
  const achievements: Achievement[] = [];

  querySnapshot.forEach((doc) => {
    achievements.push({
      id: doc.id,
      ...doc.data(),
    } as Achievement);
  });

  return achievements;
};

/**
 * Add achievement to user
 */
export const addUserAchievement = async (uid: string, achievementId: string, xpReward: number): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    achievements: arrayUnion(achievementId),
    xp: increment(xpReward),
    updatedAt: serverTimestamp(),
  });
};

// ==================== Leaderboard Operations ====================

/**
 * Get leaderboard entries
 * Note: This is a simplified version. For production, consider using Cloud Functions
 * to calculate leaderboards periodically and store them in a separate collection.
 */
export const getLeaderboard = async (
  period: LeaderboardPeriod,
  stat: LeaderboardStat,
  limitCount: number = 100
): Promise<LeaderboardEntry[]> => {
  // This would typically query a pre-calculated leaderboard collection
  // For now, we'll query users and sort client-side (not ideal for large datasets)
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  const entries: LeaderboardEntry[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    let value = 0;

    switch (stat) {
      case 'distance':
        value = data.totalDistance || 0;
        break;
      case 'hikes':
        value = data.totalHikes || 0;
        break;
      case 'time':
        value = data.totalTime || 0;
        break;
    }

    entries.push({
      userId: doc.id,
      userDisplayName: data.displayName || 'Unknown',
      userProfilePictureUrl: data.profilePictureUrl || '',
      value,
      rank: 0, // Will be set after sorting
    });
  });

  // Sort by value descending
  entries.sort((a, b) => b.value - a.value);

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries.slice(0, limitCount);
};

// ==================== Active Trail Operations ====================

/**
 * Create or update active trail
 */
export const setActiveTrail = async (userId: string, activeTrail: Omit<ActiveTrail, 'userId'>): Promise<void> => {
  const activeTrailRef = doc(db, 'activeTrails', userId);
  await setDoc(activeTrailRef, {
    userId,
    ...activeTrail,
    startTime: serverTimestamp(),
  });
};

/**
 * Get active trail for user
 */
export const getActiveTrail = async (userId: string): Promise<ActiveTrail | null> => {
  const activeTrailRef = doc(db, 'activeTrails', userId);
  const activeTrailSnap = await getDoc(activeTrailRef);

  if (activeTrailSnap.exists()) {
    const data = activeTrailSnap.data();
    return {
      ...data,
      startTime: data.startTime?.toDate() || new Date(),
      path: (data.path || []).map((p: any) => ({
        ...p,
        timestamp: p.timestamp?.toDate() || new Date(),
      })),
    } as ActiveTrail;
  }
  return null;
};

/**
 * Delete active trail (when trail is completed or cancelled)
 */
export const deleteActiveTrail = async (userId: string): Promise<void> => {
  const activeTrailRef = doc(db, 'activeTrails', userId);
  await deleteDoc(activeTrailRef);
};

// ==================== Trail Rating Operations ====================

/**
 * Create or update trail rating
 */
export const createOrUpdateTrailRating = async (
  trailId: string,
  userId: string,
  rating: number,
  review?: string
): Promise<void> => {
  const ratingRef = doc(db, 'trailRatings', `${trailId}_${userId}`);
  await setDoc(ratingRef, {
    trailId,
    userId,
    rating,
    review: review || '',
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Recalculate trail average rating
  const ratingsRef = collection(db, 'trailRatings');
  const q = query(ratingsRef, where('trailId', '==', trailId));
  const querySnapshot = await getDocs(q);
  
  let totalRating = 0;
  let count = 0;
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    totalRating += data.rating || 0;
    count++;
  });

  const averageRating = count > 0 ? totalRating / count : 0;
  await updateTrailRating(trailId, averageRating, count);
};

// ==================== Messaging Operations ====================

/**
 * Generate conversation ID from two user IDs (sorted to ensure consistency)
 */
const generateConversationId = (userId1: string, userId2: string): string => {
  const ids = [userId1, userId2].sort();
  return `${ids[0]}_${ids[1]}`;
};

/**
 * Send a message (text or shared post) between two users
 */
export const sendMessage = async (
  senderId: string,
  recipientId: string,
  senderDisplayName: string,
  senderProfilePictureUrl: string | undefined,
  text?: string,
  sharedPost?: SharedPostData
): Promise<string> => {
  const conversationId = generateConversationId(senderId, recipientId);
  const conversationRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');

  // Create message
  const messageData: Omit<Message, 'id'> = {
    conversationId,
    senderId,
    senderDisplayName,
    senderProfilePictureUrl,
    text,
    sharedPost,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const messageRef = await addDoc(messagesRef, {
    ...messageData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Get recipient profile to update conversation
  const recipientProfile = await getUserProfile(recipientId);
  const senderProfile = await getUserProfile(senderId);

  // Update or create conversation document
  await setDoc(conversationRef, {
    id: conversationId,
    participants: [senderId, recipientId],
    participantNames: [senderDisplayName, recipientProfile?.displayName || 'Unknown'],
    participantAvatars: [senderProfilePictureUrl, recipientProfile?.profilePictureUrl],
    lastMessage: text || '📷 Shared a post',
    lastMessageTime: new Date(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return messageRef.id;
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (userId: string): Promise<Conversation[]> => {
  const conversationsRef = collection(db, 'conversations');
  const q = query(conversationsRef, where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  const conversations: Conversation[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    conversations.push({
      id: doc.id,
      participants: data.participants,
      participantNames: data.participantNames,
      participantAvatars: data.participantAvatars,
      lastMessage: data.lastMessage,
      lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Conversation);
  });

  return conversations;
};

/**
 * Get conversation between two users
 */
export const getConversation = async (userId1: string, userId2: string): Promise<Conversation | null> => {
  const conversationId = generateConversationId(userId1, userId2);
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationSnap = await getDoc(conversationRef);

  if (conversationSnap.exists()) {
    const data = conversationSnap.data();
    return {
      id: conversationSnap.id,
      participants: data.participants,
      participantNames: data.participantNames,
      participantAvatars: data.participantAvatars,
      lastMessage: data.lastMessage,
      lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Conversation;
  }
  return null;
};

/**
 * Get messages in a conversation
 */
export const getConversationMessages = async (userId1: string, userId2: string, limitCount: number = 50): Promise<Message[]> => {
  const conversationId = generateConversationId(userId1, userId2);
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(limitCount));
  const querySnapshot = await getDocs(q);
  const messages: Message[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    messages.push({
      id: doc.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderDisplayName: data.senderDisplayName,
      senderProfilePictureUrl: data.senderProfilePictureUrl,
      text: data.text,
      sharedPost: data.sharedPost,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Message);
  });

  // Reverse to get chronological order (oldest first)
  return messages.reverse();
};

/**
 * Subscribe to messages in a conversation (real-time updates)
 */
export const subscribeToConversationMessages = (
  userId1: string,
  userId2: string,
  callback: (messages: Message[]) => void,
  limitCount: number = 50
): (() => void) => {
  const conversationId = generateConversationId(userId1, userId2);
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(limitCount));

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const messages: Message[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          senderDisplayName: data.senderDisplayName,
          senderProfilePictureUrl: data.senderProfilePictureUrl,
          text: data.text,
          sharedPost: data.sharedPost,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Message);
      });
      callback(messages);
    },
    (err) => {
      console.warn('Conversation listener error:', err);
    }
  );

  return unsubscribe;
};

/**
 * Subscribe to user's conversations (real-time updates)
 */
export const subscribeToUserConversations = (
  userId: string,
  callback: (conversations: Conversation[]) => void
): (() => void) => {
  const conversationsRef = collection(db, 'conversations');
  const q = query(conversationsRef, where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const conversations: Conversation[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          participants: data.participants,
          participantNames: data.participantNames,
          participantAvatars: data.participantAvatars,
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Conversation);
      });
      callback(conversations);
    },
    (err) => {
      console.warn('Conversations listener error:', err);
    }
  );

  return unsubscribe;
};

