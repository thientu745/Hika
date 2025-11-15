# Firestore Security Rules Setup Guide

## Error: Missing or insufficient permissions

If you're seeing this error, it means Firestore security rules haven't been configured or are too restrictive.

## Quick Fix: Set Up Security Rules

### Option 1: Using Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`hika-3770e`)
3. Click on **Firestore Database** in the left sidebar
4. Click on the **Rules** tab
5. Copy and paste the rules from `firestore.rules` file in this project
6. Click **Publish**

### Option 2: Using Firebase CLI

If you have Firebase CLI installed:

```bash
firebase deploy --only firestore:rules
```

## Security Rules Overview

The provided rules (`firestore.rules`) include:

### Users Collection
- ✅ **Read**: Any authenticated user can read user profiles
- ✅ **Create/Update/Delete**: Users can only modify their own profile

### Trails Collection
- ✅ **Read**: Any authenticated user can read trails
- ✅ **Create/Update**: Any authenticated user can create/update trails
- ✅ **Delete**: Any authenticated user can delete trails

### Posts Collection
- ✅ **Read**: Any authenticated user can read posts
- ✅ **Create**: Users can only create posts with their own userId
- ✅ **Update/Delete**: Users can only modify their own posts

### Trail Ratings Collection
- ✅ **Read**: Any authenticated user can read ratings
- ✅ **Create/Update/Delete**: Users can only modify their own ratings

### Active Trails Collection
- ✅ **Read/Write**: Users can only access their own active trail

### Achievements Collection
- ✅ **Read**: Any authenticated user can read achievements
- ✅ **Create/Update/Delete**: Disabled (manage via Firebase Console)

## Temporary Development Rules (NOT FOR PRODUCTION)

If you need to test quickly and want to allow all authenticated users full access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **WARNING**: These rules allow any authenticated user to read/write all data. Only use for development/testing!

## Testing Your Rules

After setting up rules, test them:

1. Try signing up a new user
2. Try viewing your profile
3. Try creating a trail
4. Try creating a post

If you still get permission errors, check:
- User is authenticated (check `request.auth != null`)
- User ID matches (check `request.auth.uid`)
- Field names match (check `resource.data.userId` vs `request.resource.data.userId`)

## Common Issues

### Issue: "Missing or insufficient permissions" on signup
**Solution**: Make sure the `users` collection allows `create` for authenticated users with matching userId.

### Issue: "Missing or insufficient permissions" when reading trails
**Solution**: Make sure the `trails` collection allows `read` for authenticated users.

### Issue: "Missing or insufficient permissions" when creating posts
**Solution**: Make sure the `posts` collection allows `create` and that `request.resource.data.userId == request.auth.uid`.

## Production Considerations

For production, consider:

1. **More restrictive rules**: Only allow specific operations
2. **Role-based access**: Add admin roles for managing trails/achievements
3. **Field validation**: Validate data structure in rules
4. **Rate limiting**: Use Cloud Functions for rate limiting
5. **Audit logging**: Log all write operations

## Next Steps

1. Copy the rules from `firestore.rules` to Firebase Console
2. Publish the rules
3. Test the app again
4. Adjust rules as needed for your use case

