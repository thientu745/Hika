/**
 * Database Verification Script
 * 
 * This script verifies that all collections and their structures match DATABASE_SETUP.md
 * 
 * Run with: npx ts-node scripts/verifyDatabase.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBltQfm1l5St0t93CQ0ujUeXzT7ssz6MAo",
  authDomain: "hika-3770e.firebaseapp.com",
  projectId: "hika-3770e",
  storageBucket: "hika-3770e.firebasestorage.app",
  messagingSenderId: "82152859870",
  appId: "1:82152859870:web:fe225b10f52ed335437a4f",
  measurementId: "G-FKTG88EQDP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function authenticate() {
  try {
    await signInAnonymously(auth);
    console.log('✓ Authenticated\n');
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

async function verifyCollection(collectionName: string, expectedFields: string[]) {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    console.log(`\n📁 ${collectionName}:`);
    console.log(`   Documents: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      const firstDoc = snapshot.docs[0];
      const data = firstDoc.data();
      const actualFields = Object.keys(data);
      
      console.log(`   Sample document ID: ${firstDoc.id}`);
      console.log(`   Fields found: ${actualFields.length}`);
      
      // Check for expected fields
      const missingFields = expectedFields.filter(field => !actualFields.includes(field));
      if (missingFields.length > 0) {
        console.log(`   ⚠️  Missing fields: ${missingFields.join(', ')}`);
      } else {
        console.log(`   ✓ All expected fields present`);
      }
    } else {
      console.log(`   ℹ️  Collection exists but is empty (will be populated when used)`);
    }
    
    return snapshot.size;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.log(`   ⚠️  Permission denied (check security rules)`);
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
    return 0;
  }
}

async function verifyDatabase() {
  try {
    console.log('🔍 Verifying database structure...\n');
    
    await authenticate();
    
    // Expected collections from DATABASE_SETUP.md
    const collections = [
      {
        name: 'users',
        fields: ['uid', 'email', 'displayName', 'totalDistance', 'totalHikes', 'totalTime', 'xp', 'rank', 'achievements', 'following', 'followers', 'favorites', 'completed', 'wishlist']
      },
      {
        name: 'trails',
        fields: ['name', 'description', 'location', 'coordinates', 'distance', 'elevationGain', 'difficulty', 'images', 'rating', 'ratingCount']
      },
      {
        name: 'posts',
        fields: ['userId', 'userDisplayName', 'trailId', 'trailName', 'location', 'images', 'description', 'likes', 'comments', 'shares']
      },
      {
        name: 'trailRatings',
        fields: ['trailId', 'userId', 'rating', 'review']
      },
      {
        name: 'activeTrails',
        fields: ['userId', 'trailId', 'startTime', 'startLocation', 'currentLocation', 'distanceTraveled', 'timeElapsed', 'elevationGain', 'path']
      },
      {
        name: 'achievements',
        fields: ['name', 'description', 'icon', 'xpReward', 'category', 'requirement']
      }
    ];
    
    let totalDocs = 0;
    for (const collection of collections) {
      const count = await verifyCollection(collection.name, collection.fields);
      totalDocs += count;
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Collections checked: ${collections.length}`);
    console.log(`   Total documents: ${totalDocs}`);
    console.log(`\n✅ Database verification complete!\n`);
    
  } catch (error) {
    console.error('❌ Error verifying database:', error);
    process.exit(1);
  }
}

verifyDatabase();

