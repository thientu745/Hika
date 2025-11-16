/**
 * Storage service for Firebase Storage operations
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';

/**
 * Request permissions for image picker
 */
export const requestImagePickerPermissions = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Sorry, we need camera roll permissions to upload images!');
    return false;
  }
  return true;
};

/**
 * Pick an image from the device
 */
export const pickImage = async (): Promise<string | null> => {
  const hasPermission = await requestImagePickerPermissions();
  if (!hasPermission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0].uri;
};

/**
 * Pick multiple images from the device
 */
export const pickMultipleImages = async (maxImages: number = 10): Promise<string[]> => {
  const hasPermission = await requestImagePickerPermissions();
  if (!hasPermission) {
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
    selectionLimit: maxImages,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(asset => asset.uri);
};

/**
 * Upload an image to Firebase Storage
 * @param uri - Local file URI
 * @param path - Storage path (e.g., 'profile-pictures/userId.jpg')
 * @returns Download URL of the uploaded image
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  try {
    console.log('Starting image upload, URI:', uri, 'Path:', path);
    
    // For React Native, we need to use fetch with proper blob handling
    // Convert URI to blob - this works in React Native
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('Converted to blob, size:', blob.size, 'type:', blob.type);

    // Create a reference to the file
    const storageRef = ref(storage, path);
    console.log('Created storage reference:', path);

    // Upload the blob
    console.log('Uploading to Firebase Storage...');
    console.log('Storage path:', path);
    console.log('Current user authenticated:', true); // We'll check auth in the error handler
    
    await uploadBytes(storageRef, blob);
    console.log('✅ Upload completed successfully');

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Got download URL:', downloadURL);
    return downloadURL;
  } catch (error: any) {
    console.error('❌ ERROR UPLOADING IMAGE');
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    console.error('Full error:', error);
    
    // Check for specific Firebase Storage error codes
    if (error?.code === 'storage/unauthorized') {
      console.error('🚫 UPLOAD DENIED: Unauthorized - Check Storage security rules');
      console.error('   Make sure the user is authenticated and rules allow write access');
      throw new Error('Upload denied: Unauthorized. Check Storage security rules.');
    } else if (error?.code === 'storage/canceled') {
      console.error('🚫 UPLOAD DENIED: Canceled by user');
      throw new Error('Upload was canceled.');
    } else if (error?.code === 'storage/unknown') {
      console.error('🚫 UPLOAD DENIED: Unknown error');
      throw new Error('Upload failed: Unknown error. Check Storage security rules and network connection.');
    } else if (error?.code?.includes('permission') || error?.code?.includes('denied')) {
      console.error('🚫 UPLOAD DENIED: Permission denied');
      console.error('   Storage path:', path);
      console.error('   Check Storage security rules in Firebase Console');
      throw new Error('Upload denied: Permission denied. Check Storage security rules.');
    }
    
    throw error;
  }
};

/**
 * Delete an image from Firebase Storage
 * @param path - Storage path of the image to delete
 */
export const deleteImage = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

/**
 * Upload a profile picture
 * @param userId - User ID
 * @param imageUri - Local image URI
 * @returns Download URL of the uploaded profile picture
 */
export const uploadProfilePicture = async (userId: string, imageUri: string): Promise<string> => {
  console.log('Uploading profile picture for user:', userId);
  console.log('Image URI:', imageUri);
  
  // Extract file extension from URI or use jpg as default
  // Handle different URI formats (file://, content://, etc.)
  let extension = 'jpg';
  const uriParts = imageUri.split('.');
  if (uriParts.length > 1) {
    extension = uriParts[uriParts.length - 1].split('?')[0]; // Remove query params if any
    // Limit extension length (some URIs might have weird formats)
    if (extension.length > 5) {
      extension = 'jpg';
    }
  }
  
  const path = `profile-pictures/${userId}.${extension}`;
  console.log('Storage path:', path);
  
  return await uploadImage(imageUri, path);
};

/**
 * Upload multiple images for a post
 * @param userId - User ID
 * @param postId - Post ID
 * @param imageUris - Array of local image URIs
 * @returns Array of download URLs of the uploaded images
 */
export const uploadPostImages = async (
  userId: string,
  postId: string,
  imageUris: string[]
): Promise<string[]> => {
  const uploadPromises = imageUris.map(async (uri, index) => {
    // Extract file extension from URI or use jpg as default
    let extension = 'jpg';
    const uriParts = uri.split('.');
    if (uriParts.length > 1) {
      extension = uriParts[uriParts.length - 1].split('?')[0];
      if (extension.length > 5) {
        extension = 'jpg';
      }
    }
    
    // Generate unique filename with timestamp and index
    const timestamp = Date.now();
    const filename = `${timestamp}_${index}.${extension}`;
    const path = `post-images/${userId}/${postId}/${filename}`;
    
    return await uploadImage(uri, path);
  });
  
  return await Promise.all(uploadPromises);
};

/**
 * Delete a post image from Firebase Storage
 * @param imageUrl - Full download URL of the image
 */
export const deletePostImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract the path from the full URL
    // Firebase Storage URLs have the format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?...
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
    if (pathMatch) {
      // Decode the path (Firebase Storage URLs are URL-encoded)
      const encodedPath = pathMatch[1];
      const decodedPath = decodeURIComponent(encodedPath);
      await deleteImage(decodedPath);
    } else {
      throw new Error('Invalid image URL format');
    }
  } catch (error) {
    console.error('Error deleting post image:', error);
    throw error;
  }
};

