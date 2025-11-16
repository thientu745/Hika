/**
 * Trail Search Service
 * Integrates Firestore trail search with Overpass API (OpenStreetMap) trail fetching
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { searchTrails, getTrail, createTrail } from './database';
import { fetchTrailData, US_STATE_BBOX } from './fetch-trails';
import type { Trail, TrailDifficulty } from '../types';

/**
 * Search trails from Firestore
 */
export async function searchTrailsFromFirestore(
  searchTerm?: string,
  location?: string,
  difficulty?: TrailDifficulty,
  limitCount: number = 20
): Promise<Trail[]> {
  return await searchTrails(searchTerm, location, difficulty, limitCount);
}

/**
 * Convert Overpass API trail data to Trail format
 */
function convertOverpassToTrail(element: any, stateName: string): Partial<Trail> | null {
  if (!element.tags || !element.tags.name) {
    return null; // Skip trails without names
  }

  // Extract coordinates
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
  }

  // Calculate distance from path (rough estimate)
  let distance = 0;
  if (path.length > 1) {
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      // Haversine formula for distance
      const R = 6371000; // Earth radius in meters
      const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(prev.latitude * Math.PI / 180) *
          Math.cos(curr.latitude * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance += R * c;
    }
  }

  // Determine difficulty
  // Priority: 1) Explicit difficulty tag, 2) Distance-based heuristic, 3) Default to Moderate
  let difficulty: TrailDifficulty = 'Moderate';
  
  // First, check if there's an explicit difficulty tag
  if (element.tags.difficulty) {
    const diff = element.tags.difficulty.toLowerCase();
    if (diff.includes('easy')) difficulty = 'Easy';
    else if (diff.includes('moderate')) difficulty = 'Moderate';
    else if (diff.includes('hard') || diff.includes('difficult')) difficulty = 'Hard';
    else if (diff.includes('expert') || diff.includes('extreme')) difficulty = 'Expert';
  } else {
    // If no explicit difficulty tag, estimate based on distance and elevation
    const distanceKm = distance / 1000; // Convert to kilometers
    const elevationGain = element.tags.ele ? parseFloat(element.tags.ele) : 0;
    
    // Calculate difficulty based on distance and elevation gain
    // Longer trails or trails with significant elevation gain are harder
    if (distanceKm > 15 || elevationGain > 1000) {
      difficulty = 'Expert';
    } else if (distanceKm > 10 || elevationGain > 500) {
      difficulty = 'Hard';
    } else if (distanceKm > 5 || elevationGain > 200) {
      difficulty = 'Moderate';
    } else {
      difficulty = 'Easy';
    }
  }

  return {
    name: element.tags.name,
    description: element.tags.description || element.tags.note || `Trail in ${stateName}`,
    location: `${stateName}, USA`,
    coordinates,
    distance: Math.round(distance),
    elevationGain: element.tags.ele ? parseFloat(element.tags.ele) : 0,
    difficulty,
    images: [],
    rating: 0,
    ratingCount: 0,
    path,
  };
}

/**
 * Extract state name from location string (e.g., "Oregon, USA" -> "Oregon")
 */
function extractStateName(location: string): string | null {
  if (!location) return null;
  
  // Try to find a matching state name in the location string
  const normalizedLocation = location.toLowerCase().trim();
  
  // Check for exact match first
  const exactMatch = US_STATE_BBOX.find(
    (s) => s.name.toLowerCase() === normalizedLocation
  );
  if (exactMatch) return exactMatch.name;
  
  // Check if location contains a state name
  for (const state of US_STATE_BBOX) {
    const stateNameLower = state.name.toLowerCase();
    // Check if state name is in the location string
    if (normalizedLocation.includes(stateNameLower) || stateNameLower.includes(normalizedLocation)) {
      return state.name;
    }
  }
  
  return null;
}

/**
 * Search trails using Overpass API (OpenStreetMap)
 * This searches for trails in a specific state or area
 * If no location is provided but a searchTerm is, searches all US states
 */
export async function searchTrailsFromOverpass(
  location?: string,
  searchTerm?: string
): Promise<Partial<Trail>[]> {
  try {
    // If we have a location, search that specific state
    if (location) {
      // Extract state name from location string
      const stateName = extractStateName(location);
      
      // Find state bounding box
      const stateData = stateName
        ? US_STATE_BBOX.find((s) => s.name.toLowerCase() === stateName.toLowerCase())
        : null;

      if (!stateData) {
        console.warn(`State not found for location "${location}"`);
        return [];
      }

      return await searchOverpassInState(stateData, searchTerm);
    }
    
    // If no location but we have a search term, search all US states
    // This is slower but allows searching by name only
    if (searchTerm) {
      console.log(`Searching all US states for trail name: "${searchTerm}"`);
      const allTrails: Partial<Trail>[] = [];
      
      // Search each state (limit to first 10 states to avoid timeout)
      // In practice, you might want to search more intelligently or use a different approach
      const statesToSearch = US_STATE_BBOX.slice(0, 10); // Limit to avoid timeout
      
      for (const stateData of statesToSearch) {
        try {
          const stateTrails = await searchOverpassInState(stateData, searchTerm);
          allTrails.push(...stateTrails);
          
          // If we found trails, we can stop early (optional optimization)
          if (allTrails.length > 50) {
            break;
          }
        } catch (error) {
          console.warn(`Error searching ${stateData.name}:`, error);
          // Continue with next state
        }
      }
      
      return allTrails;
    }
    
    // No location and no search term, return empty
    return [];
  } catch (error) {
    console.error('Error searching trails from Overpass:', error);
    return [];
  }
}

/**
 * Helper function to search Overpass API in a specific state
 */
async function searchOverpassInState(
  stateData: { name: string; bbox: readonly [number, number, number, number] },
  searchTerm?: string
): Promise<Partial<Trail>[]> {
  const [south, west, north, east] = stateData.bbox;
  
  // Build Overpass query - include name filter if searchTerm is provided
  let query = `
    [out:json][timeout:25];
    (
      relation["route"="hiking"]${searchTerm ? `["name"~"${searchTerm}",i]` : ''}(${south}, ${west}, ${north}, ${east});
      way["highway"="path"]["hiking"="yes"]${searchTerm ? `["name"~"${searchTerm}",i]` : ''}(${south}, ${west}, ${north}, ${east});
    );
    out geom;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    console.error('Overpass API error:', response.status);
    return [];
  }

  const data = await response.json();
  const trails: Partial<Trail>[] = [];

  // Convert Overpass elements to Trail format
  for (const element of data.elements || []) {
    const trail = convertOverpassToTrail(element, stateData.name);
    if (trail) {
      // Additional client-side filtering by search term if provided
      if (!searchTerm || trail.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
        trails.push(trail);
      }
    }
  }

  return trails;
}

/**
 * Combined search: searches both Firestore and Overpass API
 * Automatically fetches from Overpass if few results, and saves them to Firestore
 */
export async function searchAllTrails(
  searchTerm?: string,
  location?: string,
  difficulty?: TrailDifficulty,
  autoFetchOverpass: boolean = true,
  maxOverpassResults: number = 200
): Promise<{ trails: Trail[]; savedCount?: number }> {
  // First, search Firestore (faster, already stored)
  // Convert undefined difficulty to undefined (not empty string)
  // When searching by location, fetch more results
  const firestoreLimit = location ? 500 : 20;
  const firestoreTrails = await searchTrailsFromFirestore(
    searchTerm, 
    location, 
    difficulty || undefined, 
    firestoreLimit
  );

  // If OpenStreetMap is enabled, fetch from Overpass when we have a location or search term
  // This helps build up the database with available trails
  if (autoFetchOverpass && (location || searchTerm)) {
    try {
      const searchContext = location ? `location: ${location}` : `name: ${searchTerm}`;
      console.log(`Auto-fetching from Overpass for ${searchContext}`);
      const overpassTrails = await searchTrailsFromOverpass(location, searchTerm);
      console.log(`Found ${overpassTrails.length} trails from Overpass`);
      
      if (overpassTrails.length > 0) {
        // Save trails from Overpass - use maxOverpassResults as limit, but try to save as many as possible
        // For large states, we want to save more trails to build up the database
        const trailsToSave = overpassTrails.slice(0, maxOverpassResults);
        
        console.log(`Attempting to save ${trailsToSave.length} trails from ${overpassTrails.length} found`);
        
        // Automatically save Overpass trails to Firestore
        const savedCount = await saveOverpassTrailsToFirestore(trailsToSave);
        console.log(`Saved ${savedCount} new trails to Firestore (${trailsToSave.length - savedCount} were duplicates or failed)`);
        
        // Re-search Firestore to get the newly saved trails
        // Add a small delay to ensure Firestore has processed the writes
        if (savedCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for Firestore to index
          const updatedTrails = await searchTrailsFromFirestore(searchTerm, location, difficulty, firestoreLimit);
          console.log(`Re-searched Firestore, found ${updatedTrails.length} trails`);
          return { trails: updatedTrails, savedCount };
        } else {
          // Even if no new trails were saved (all duplicates), return the Overpass trails
          // converted to full Trail format for display
          return { trails: firestoreTrails, savedCount: 0 };
        }
      } else {
        console.log('No trails found from Overpass API');
      }
    } catch (error) {
      console.error('Error auto-fetching Overpass trails:', error);
      // Continue with Firestore results even if Overpass fails
    }
  }

  return { trails: firestoreTrails };
}

/**
 * Check if a trail already exists in Firestore (by name and coordinates)
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
 * Save Overpass trail to Firestore (with duplicate check)
 */
export async function saveOverpassTrailToFirestore(overpassTrail: Partial<Trail>): Promise<string | null> {
  if (!overpassTrail.name || !overpassTrail.coordinates) {
    return null;
  }

  try {
    // Check if trail already exists
    const exists = await trailExists(overpassTrail.name, overpassTrail.coordinates);
    if (exists) {
      console.log(`Trail "${overpassTrail.name}" already exists, skipping save`);
      return null;
    }

    // Build trail data, ensuring no undefined values (Firestore doesn't allow undefined)
    const trailData: any = {
      name: overpassTrail.name,
      description: overpassTrail.description || '',
      location: overpassTrail.location || 'Unknown',
      coordinates: overpassTrail.coordinates,
      distance: overpassTrail.distance || 0,
      elevationGain: overpassTrail.elevationGain || 0,
      difficulty: overpassTrail.difficulty || 'Moderate',
      images: overpassTrail.images || [],
      rating: 0,
      ratingCount: 0,
    };

    // Only include elevationLoss if it's defined and not null
    if (overpassTrail.elevationLoss !== undefined && overpassTrail.elevationLoss !== null) {
      trailData.elevationLoss = overpassTrail.elevationLoss;
    } else {
      trailData.elevationLoss = 0; // Default to 0 if not provided
    }

    // Only include path if it exists and has points
    if (overpassTrail.path && Array.isArray(overpassTrail.path) && overpassTrail.path.length > 0) {
      trailData.path = overpassTrail.path;
    }

    const trailId = await createTrail(trailData);

    return trailId;
  } catch (error) {
    console.error('Error saving Overpass trail to Firestore:', error);
    return null;
  }
}

/**
 * Automatically save multiple Overpass trails to Firestore
 * Returns count of successfully saved trails
 */
export async function saveOverpassTrailsToFirestore(overpassTrails: Partial<Trail>[]): Promise<number> {
  let savedCount = 0;
  
  for (const trail of overpassTrails) {
    const trailId = await saveOverpassTrailToFirestore(trail);
    if (trailId) {
      savedCount++;
    }
  }
  
  return savedCount;
}

