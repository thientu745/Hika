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
  let q = query(trailsRef, orderBy('createdAt', 'desc'), limit(limitCount));

  if (location) {
    q = query(trailsRef, where('location', '==', location), orderBy('createdAt', 'desc'), limit(limitCount));
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

  // Basic client-side filtering for search term
  if (searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return trails.filter(
      (trail) =>
        trail.name.toLowerCase().includes(lowerSearchTerm) ||
        trail.description.toLowerCase().includes(lowerSearchTerm) ||
        trail.location.toLowerCase().includes(lowerSearchTerm)
    );
  }

  return trails;
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
 */
export const createPost = async (post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const postsRef = collection(db, 'posts');
  const docRef = await addDoc(postsRef, {
    ...post,
    likes: [],
    comments: [],
    shares: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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

