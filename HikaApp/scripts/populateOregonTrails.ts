/**
 * Script to populate Firestore with trails from Oregon using Overpass API
 * 
 * Run with: npx ts-node --project scripts/tsconfig.json scripts/populateOregonTrails.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { US_STATE_BBOX } from '../services/fetch-trails';
import type { Trail } from '../types';

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

/**
 * Authenticate with Firebase
 */
async function authenticate() {
  try {
    await signInAnonymously(auth);
    console.log('✓ Authenticated for database population\n');
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Calculate distance from path coordinates using Haversine formula
 */
function calculateDistance(path: { latitude: number; longitude: number }[]): number {
  if (path.length < 2) return 0;

  let totalDistance = 0;
  const R = 6371000; // Earth radius in meters

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    
    const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
    const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(prev.latitude * Math.PI / 180) *
        Math.cos(curr.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }

  return Math.round(totalDistance);
}

/**
 * Determine difficulty from Overpass tags
 */
function determineDifficulty(element: any): 'Easy' | 'Moderate' | 'Hard' | 'Expert' {
  if (element.tags?.difficulty) {
    const diff = element.tags.difficulty.toLowerCase();
    if (diff.includes('easy')) return 'Easy';
    if (diff.includes('moderate')) return 'Moderate';
    if (diff.includes('hard') || diff.includes('difficult')) return 'Hard';
    if (diff.includes('expert') || diff.includes('extreme')) return 'Expert';
  }

  // Default based on distance and elevation
  const distance = element.tags?.distance ? parseFloat(element.tags.distance) : 0;
  if (distance > 10000) return 'Hard';
  if (distance > 5000) return 'Moderate';
  return 'Easy';
}

/**
 * Convert Overpass element to Trail format
 */
function convertToTrail(element: any, stateName: string): Partial<Trail> | null {
  if (!element.tags || !element.tags.name) {
    return null; // Skip trails without names
  }

  // Extract coordinates and path
  let coordinates = { latitude: 0, longitude: 0 };
  let path: { latitude: number; longitude: number }[] = [];

  if (element.geometry && element.geometry.length > 0) {
    // Use first point as main coordinates
    const firstPoint = element.geometry[0];
    coordinates = {
      latitude: firstPoint.lat,
      longitude: firstPoint.lon,
    };

    // Build path from geometry
    path = element.geometry.map((point: any) => ({
      latitude: point.lat,
      longitude: point.lon,
    }));
  } else if (element.lat && element.lon) {
    // Single point
    coordinates = {
      latitude: element.lat,
      longitude: element.lon,
    };
    path = [coordinates];
  } else {
    return null; // No coordinates available
  }

  // Calculate distance
  let distance = 0;
  if (element.tags?.distance) {
    distance = parseFloat(element.tags.distance) * 1000; // Convert km to meters
  } else if (path.length > 1) {
    distance = calculateDistance(path);
  }

  // Get elevation gain
  let elevationGain = 0;
  if (element.tags?.ele) {
    elevationGain = parseFloat(element.tags.ele);
  } else if (element.tags?.['ele:start'] && element.tags?.['ele:end']) {
    elevationGain = Math.max(0, parseFloat(element.tags['ele:end']) - parseFloat(element.tags['ele:start']));
  }

  // Determine difficulty
  const difficulty = determineDifficulty(element);

  // Build location string
  let location = stateName;
  if (element.tags?.['addr:city']) {
    location = `${element.tags['addr:city']}, ${stateName}`;
  } else if (element.tags?.place) {
    location = `${element.tags.place}, ${stateName}`;
  }

  return {
    name: element.tags.name,
    description: element.tags.description || element.tags.note || element.tags.ref || `Hiking trail in ${stateName}`,
    location: `${location}, USA`,
    coordinates,
    distance,
    elevationGain: Math.round(elevationGain),
    difficulty,
    images: [],
    rating: 0,
    ratingCount: 0,
    path: path.length > 1 ? path : undefined,
  };
}

/**
 * Check if trail already exists in Firestore
 */
async function trailExists(trailName: string, coordinates: { latitude: number; longitude: number }): Promise<boolean> {
  try {
    const trailsRef = collection(db, 'trails');
    const q = query(trailsRef, where('name', '==', trailName));
    const querySnapshot = await getDocs(q);

    // Check if any existing trail is very close (within ~100m)
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (data.coordinates) {
        const existingLat = data.coordinates.latitude;
        const existingLon = data.coordinates.longitude;
        
        // Simple distance check (rough approximation)
        const latDiff = Math.abs(existingLat - coordinates.latitude);
        const lonDiff = Math.abs(existingLon - coordinates.longitude);
        
        // ~100m threshold (roughly 0.001 degrees)
        if (latDiff < 0.001 && lonDiff < 0.001) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking trail existence:', error);
    return false;
  }
}

/**
 * Fetch and save Oregon trails
 */
async function populateOregonTrails() {
  try {
    console.log('🚀 Starting Oregon trail population...\n');

    // Authenticate
    await authenticate();

    // Find Oregon bounding box
    const oregon = US_STATE_BBOX.find((s) => s.name === 'Oregon');
    if (!oregon) {
      console.error('❌ Oregon not found in state list');
      return;
    }

    console.log(`📍 Fetching trails from Oregon (${oregon.name})...`);
    console.log(`   Bounding box: [${oregon.bbox.join(', ')}]\n`);

    // Build Overpass query
    const [south, west, north, east] = oregon.bbox;
    const overpassQuery = `
      [out:json][timeout:60];
      (
        relation["route"="hiking"](${south}, ${west}, ${north}, ${east});
        way["highway"="path"]["hiking"="yes"](${south}, ${west}, ${north}, ${east});
        way["route"="hiking"](${south}, ${west}, ${north}, ${east});
      );
      out geom;
    `;

    console.log('⏳ Fetching from Overpass API (this may take a minute)...\n');

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Overpass API error:', response.status, response.statusText);
      console.error('Server response:', errorText);
      return;
    }

    const data = await response.json();
    console.log(`✓ Found ${data.elements.length} trail elements from Overpass API\n`);

    if (data.elements.length === 0) {
      console.log('No trails found. Exiting.');
      return;
    }

    // Process and save trails
    const trailsRef = collection(db, 'trails');
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('💾 Processing and saving trails to Firestore...\n');

    for (let i = 0; i < data.elements.length; i++) {
      const element = data.elements[i];
      
      try {
        const trail = convertToTrail(element, oregon.name);
        
        if (!trail || !trail.name || !trail.coordinates) {
          skippedCount++;
          continue;
        }

        // Check if trail already exists
        const exists = await trailExists(trail.name, trail.coordinates);
        if (exists) {
          skippedCount++;
          continue;
        }

        // Save to Firestore
        const trailRef = doc(trailsRef);
        await setDoc(trailRef, {
          ...trail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        savedCount++;
        if (savedCount % 10 === 0) {
          console.log(`   ✓ Saved ${savedCount} trails...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing trail ${i + 1}:`, error);
      }

      // Small delay to avoid rate limiting
      if (i % 50 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n✅ Oregon trail population complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   ✓ Saved: ${savedCount} trails`);
    console.log(`   - Skipped (duplicates/no data): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📍 Total processed: ${data.elements.length}\n`);

  } catch (error) {
    console.error('❌ Error populating Oregon trails:', error);
    process.exit(1);
  }
}

// Run the script
populateOregonTrails();

