# Firebase Storage Security Rules Setup Guide

## Why You Need Storage Security Rules

**Yes, you need to set up Storage security rules!** Without them:
- ❌ Anyone with your Firebase config could upload/delete files
- ❌ Users could overwrite each other's profile pictures
- ❌ Storage costs could skyrocket from unauthorized uploads
- ❌ Security vulnerabilities could be exploited

## Quick Setup

### Option 1: Using Firebase Console (Recommended for First Time)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`hika-3770e`)
3. Click on **Storage** in the left sidebar
4. Click on the **Rules** tab
5. Copy and paste the rules from `storage.rules` file in this project
6. Click **Publish**

### Option 2: Using Firebase CLI

If you have Firebase CLI installed and configured:

```bash
firebase deploy --only storage:rules
```

Or deploy everything:
```bash
firebase deploy
```

## Security Rules Overview

The provided rules (`storage.rules`) include:

### Profile Pictures (`profile-pictures/{userId}.{extension}`)
- ✅ **Read**: Any authenticated user can view profile pictures
- ✅ **Write/Delete**: Users can only upload/delete their own profile picture
- 🔒 **Security**: Prevents users from overwriting others' pictures

### Post Images (`post-images/{userId}/{postId}/{fileName}`)
- ✅ **Read**: Any authenticated user can view post images
- ✅ **Write/Delete**: Users can only upload/delete images for their own posts
- 🔒 **Security**: Prevents users from uploading to others' posts

### Trail Images (`trail-images/{trailId}/{fileName}`)
- ✅ **Read**: Any authenticated user can view trail images
- ✅ **Write/Delete**: Any authenticated user can upload/delete trail images
- 🔒 **Security**: Allows community contributions to trail images

### Default Rule
- ❌ **All other paths**: Denied by default for security

## Testing Your Rules

After setting up rules, test them:

1. **Profile Picture Upload**: Try uploading your own profile picture ✅
2. **Profile Picture View**: Try viewing another user's profile picture ✅
3. **Unauthorized Upload**: Try uploading to someone else's profile path ❌ (should fail)
4. **Unauthenticated Access**: Try accessing without being logged in ❌ (should fail)

## Common Issues

### Issue: "User does not have permission to access this object"
**Solution**: Make sure:
- User is authenticated (`request.auth != null`)
- User ID matches the path (`request.auth.uid == userId`)
- Rules are published in Firebase Console

### Issue: "Permission denied" when uploading profile picture
**Solution**: Check that:
- The file path matches `profile-pictures/{userId}.{extension}`
- The userId in the path matches the authenticated user's ID
- Storage rules are published

### Issue: Can't read images
**Solution**: Make sure read rules allow authenticated users:
```javascript
allow read: if isAuthenticated();
```

## Temporary Development Rules (NOT FOR PRODUCTION)

If you need to test quickly and want to allow all authenticated users full access:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **WARNING**: These rules allow any authenticated user to read/write all files. Only use for development/testing!

## Production Considerations

For production, consider:

1. **File size limits**: Add validation for maximum file sizes
2. **File type restrictions**: Only allow specific image formats (jpg, png, etc.)
3. **Content validation**: Use Cloud Functions to validate image content
4. **Rate limiting**: Limit uploads per user to prevent abuse
5. **CDN integration**: Use Firebase Hosting CDN for faster image delivery

## File Size Limits

Firebase Storage has default limits:
- Maximum file size: 32 MB (can be increased with billing)
- Recommended for profile pictures: < 2 MB
- Recommended for post images: < 5 MB

Consider compressing images before upload (already implemented in `storage.ts` with `quality: 0.8`).

## Next Steps

1. ✅ Copy the rules from `storage.rules` to Firebase Console
2. ✅ Publish the rules
3. ✅ Test profile picture upload
4. ✅ Adjust rules as needed for your use case

## Current Implementation

The app currently uses:
- **Profile pictures**: `profile-pictures/{userId}.{extension}`
- **Image picker**: `expo-image-picker` with 1:1 aspect ratio
- **Image quality**: 0.8 (80% quality for smaller file sizes)
- **Storage service**: `services/storage.ts`

