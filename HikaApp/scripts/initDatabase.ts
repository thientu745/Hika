/**
 * Database Initialization Script
 * 
 * This script initializes the Firestore database with:
 * - Security rules (deploy via Firebase CLI)
 * - Initial achievements
 * - Sample data (optional)
 * 
 * Run with: npx ts-node scripts/initDatabase.ts
 * Or: npm run init-db
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration (same as in firebaseConfig.ts)
const firebaseConfig = {
  apiKey: "AIzaSyBltQfm1l5St0t93CQ0ujUeXzT7ssz6MAo",
  authDomain: "hika-3770e.firebaseapp.com",
  projectId: "hika-3770e",
  storageBucket: "hika-3770e.firebasestorage.app",
  messagingSenderId: "82152859870",
  appId: "1:82152859870:web:fe225b10f52ed335437a4f",
  measurementId: "G-FKTG88EQDP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Authenticate with Firebase (required for Firestore writes)
 */
async function authenticate() {
  try {
    // Try to sign in anonymously for script execution
    await signInAnonymously(auth);
    console.log('✓ Authenticated for database initialization\n');
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    console.log('\nNote: Make sure Anonymous Authentication is enabled in Firebase Console:');
    console.log('Firebase Console > Authentication > Sign-in method > Anonymous > Enable\n');
    throw error;
  }
}

// Achievement definitions
const achievements = [
  {
    id: 'first_hike',
    name: 'First Steps',
    description: 'Complete your first hike',
    icon: '🚶',
    xpReward: 50,
    category: 'Hikes',
    requirement: {
      type: 'hikes',
      value: 1,
      description: 'Complete 1 hike',
    },
  },
  {
    id: 'five_hikes',
    name: 'Trail Explorer',
    description: 'Complete 5 hikes',
    icon: '🏔️',
    xpReward: 100,
    category: 'Hikes',
    requirement: {
      type: 'hikes',
      value: 5,
      description: 'Complete 5 hikes',
    },
  },
  {
    id: 'ten_hikes',
    name: 'Mountain Veteran',
    description: 'Complete 10 hikes',
    icon: '⛰️',
    xpReward: 200,
    category: 'Hikes',
    requirement: {
      type: 'hikes',
      value: 10,
      description: 'Complete 10 hikes',
    },
  },
  {
    id: 'distance_5k',
    name: '5K Walker',
    description: 'Hike 5 kilometers total',
    icon: '📏',
    xpReward: 75,
    category: 'Distance',
    requirement: {
      type: 'distance',
      value: 5000,
      description: 'Hike 5 kilometers',
    },
  },
  {
    id: 'distance_25k',
    name: '25K Explorer',
    description: 'Hike 25 kilometers total',
    icon: '🗺️',
    xpReward: 150,
    category: 'Distance',
    requirement: {
      type: 'distance',
      value: 25000,
      description: 'Hike 25 kilometers',
    },
  },
  {
    id: 'distance_100k',
    name: 'Century Hiker',
    description: 'Hike 100 kilometers total',
    icon: '🌟',
    xpReward: 500,
    category: 'Distance',
    requirement: {
      type: 'distance',
      value: 100000,
      description: 'Hike 100 kilometers',
    },
  },
  {
    id: 'time_10h',
    name: '10 Hour Explorer',
    description: 'Spend 10 hours hiking',
    icon: '⏰',
    xpReward: 100,
    category: 'Time',
    requirement: {
      type: 'time',
      value: 36000,
      description: 'Spend 10 hours hiking',
    },
  },
  {
    id: 'social_follow_5',
    name: 'Social Butterfly',
    description: 'Follow 5 other hikers',
    icon: '👥',
    xpReward: 50,
    category: 'Social',
    requirement: {
      type: 'social',
      value: 5,
      description: 'Follow 5 users',
    },
  },
  {
    id: 'social_post_10',
    name: 'Storyteller',
    description: 'Share 10 trail posts',
    icon: '📸',
    xpReward: 150,
    category: 'Social',
    requirement: {
      type: 'social',
      value: 10,
      description: 'Create 10 posts',
    },
  },
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Join Hika in the first month',
    icon: '🎉',
    xpReward: 100,
    category: 'Special',
    requirement: {
      type: 'custom',
      value: 1,
      description: 'Special achievement',
    },
  },
];

/**
 * Initialize achievements in Firestore
 */
async function initAchievements() {
  console.log('Initializing achievements...');
  const achievementsRef = collection(db, 'achievements');
  
  for (const achievement of achievements) {
    const achievementRef = doc(achievementsRef, achievement.id);
    const existing = await getDoc(achievementRef);
    
    if (!existing.exists()) {
      await setDoc(achievementRef, {
      ...achievement,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
      console.log(`✓ Created achievement: ${achievement.name}`);
    } else {
      console.log(`- Achievement already exists: ${achievement.name}`);
    }
  }
  
  console.log(`\n✓ Initialized ${achievements.length} achievements\n`);
}

/**
 * Create sample trails
 */
async function initSampleTrails() {
  console.log('Creating sample trails...');
  
  const sampleTrails = [
    {
      name: 'Sunset Peak Trail',
      description: 'A beautiful moderate trail with stunning sunset views at the summit. Perfect for an afternoon hike. The trail winds through oak woodlands and offers panoramic views of the valley below.',
      location: 'Mountain View, CA',
      coordinates: { latitude: 37.4056, longitude: -122.0775 },
      distance: 5000, // 5km
      elevationGain: 300,
      elevationLoss: 300,
      difficulty: 'Moderate',
      images: [],
      rating: 0,
      ratingCount: 0,
      path: [
        { latitude: 37.4056, longitude: -122.0775 },
        { latitude: 37.4060, longitude: -122.0780 },
        { latitude: 37.4065, longitude: -122.0785 },
      ],
    },
    {
      name: 'Forest Loop Trail',
      description: 'An easy loop through a peaceful forest. Great for beginners and families. The trail is well-maintained and features interpretive signs about local wildlife.',
      location: 'Redwood City, CA',
      coordinates: { latitude: 37.4842, longitude: -122.2281 },
      distance: 3000, // 3km
      elevationGain: 100,
      elevationLoss: 100,
      difficulty: 'Easy',
      images: [],
      rating: 0,
      ratingCount: 0,
      path: [
        { latitude: 37.4842, longitude: -122.2281 },
        { latitude: 37.4845, longitude: -122.2285 },
        { latitude: 37.4848, longitude: -122.2289 },
      ],
    },
    {
      name: 'Summit Challenge',
      description: 'A challenging trail for experienced hikers. Steep inclines and rocky terrain. Requires good physical condition and proper hiking gear. The reward is breathtaking 360-degree views from the summit.',
      location: 'Palo Alto, CA',
      coordinates: { latitude: 37.4419, longitude: -122.1430 },
      distance: 12000, // 12km
      elevationGain: 800,
      elevationLoss: 800,
      difficulty: 'Hard',
      images: [],
      rating: 0,
      ratingCount: 0,
      path: [
        { latitude: 37.4419, longitude: -122.1430 },
        { latitude: 37.4425, longitude: -122.1435 },
        { latitude: 37.4430, longitude: -122.1440 },
        { latitude: 37.4435, longitude: -122.1445 },
      ],
    },
    {
      name: 'Coastal Bluff Trail',
      description: 'Scenic coastal trail with ocean views. Moderate difficulty with some elevation changes. Perfect for watching sunsets over the Pacific.',
      location: 'Half Moon Bay, CA',
      coordinates: { latitude: 37.4636, longitude: -122.4286 },
      distance: 8000, // 8km
      elevationGain: 200,
      elevationLoss: 200,
      difficulty: 'Moderate',
      images: [],
      rating: 0,
      ratingCount: 0,
      path: [
        { latitude: 37.4636, longitude: -122.4286 },
        { latitude: 37.4640, longitude: -122.4290 },
        { latitude: 37.4645, longitude: -122.4295 },
      ],
    },
    {
      name: 'Waterfall Canyon',
      description: 'Easy trail leading to a beautiful waterfall. Great for photography and picnics. The trail follows a creek through a shaded canyon.',
      location: 'San Jose, CA',
      coordinates: { latitude: 37.3382, longitude: -121.8863 },
      distance: 4000, // 4km
      elevationGain: 150,
      elevationLoss: 150,
      difficulty: 'Easy',
      images: [],
      rating: 0,
      ratingCount: 0,
      path: [
        { latitude: 37.3382, longitude: -121.8863 },
        { latitude: 37.3385, longitude: -121.8866 },
        { latitude: 37.3388, longitude: -121.8869 },
      ],
    },
    {
      name: 'Eagle Peak Trail',
      description: 'Expert-level trail with technical sections. Requires scrambling and route-finding skills. Not recommended for beginners. Spectacular views reward those who complete it.',
      location: 'Los Gatos, CA',
      coordinates: { latitude: 37.2266, longitude: -121.9746 },
      distance: 15000, // 15km
      elevationGain: 1200,
      elevationLoss: 1200,
      difficulty: 'Expert',
      images: [],
      rating: 0,
      ratingCount: 0,
      path: [
        { latitude: 37.2266, longitude: -121.9746 },
        { latitude: 37.2270, longitude: -121.9750 },
        { latitude: 37.2275, longitude: -121.9755 },
        { latitude: 37.2280, longitude: -121.9760 },
        { latitude: 37.2285, longitude: -121.9765 },
      ],
    },
  ];
  
  const trailsRef = collection(db, 'trails');
  let createdCount = 0;
  
  for (const trail of sampleTrails) {
    // Check if trail with same name exists
    const trailRef = doc(trailsRef);
    await setDoc(trailRef, {
      ...trail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`✓ Created trail: ${trail.name}`);
    createdCount++;
  }
  
  console.log(`\n✓ Created ${createdCount} sample trails\n`);
}

/**
 * Initialize all database collections with sample data
 */
async function initAllCollections() {
  console.log('Initializing all database collections...\n');
  
  // Initialize achievements
  await initAchievements();
  
  // Initialize sample trails
  await initSampleTrails();
  
  console.log('✅ All collections initialized!');
  console.log('\nCollections created:');
  console.log('  ✓ achievements - 10 achievement definitions');
  console.log('  ✓ trails - 6 sample trails');
  console.log('\nNote: Other collections (users, posts, trailRatings, activeTrails)');
  console.log('      will be created automatically when users interact with the app.\n');
}

/**
 * Main initialization function
 */
async function initDatabase() {
  try {
    console.log('🚀 Starting database initialization...\n');
    
    // Authenticate first (required for Firestore writes)
    await authenticate();
    
    // Initialize all collections
    await initAllCollections();
    
    console.log('✅ Database initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Firebase Console > Firestore Database');
    console.log('2. Test the app and verify collections are accessible');
    console.log('3. Users, posts, and other collections will be created automatically');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

// Run if called directly
initDatabase();

export { initDatabase, initAchievements, initSampleTrails, initAllCollections };

