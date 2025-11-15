# Firebase Setup Guide

This guide will help you set up your Firebase database in one go.

## Prerequisites

1. **Firebase CLI installed:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project (if not already done):**
   ```bash
   cd HikaApp
   firebase init firestore
   ```
   - Select your existing project: `hika-3770e`
   - Use existing `firestore.rules` file: Yes
   - Use existing `firestore.indexes.json` file: No (or Yes if you have one)

## Step 1: Deploy Security Rules

Deploy the security rules from `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

This will apply all the security rules defined in `firestore.rules` to your Firebase project.

## Step 2: Initialize Database Structure

### Option A: Using the TypeScript Script (Recommended)

1. **Install ts-node (if not already installed):**
   ```bash
   npm install --save-dev ts-node
   ```

2. **Run the initialization script:**
   ```bash
   npx ts-node scripts/initDatabase.ts
   ```

   Or add to `package.json`:
   ```json
   "scripts": {
     "init-db": "ts-node scripts/initDatabase.ts"
   }
   ```
   
   Then run:
   ```bash
   npm run init-db
   ```

### Option B: Using Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `hika-3770e`
3. Go to **Firestore Database**
4. Click **Start collection** and create collections as needed:
   - `achievements` - Add documents manually or use the script
   - `trails` - Will be created automatically when you add trails
   - `users` - Will be created automatically when users sign up
   - `posts` - Will be created automatically when users create posts
   - `trailRatings` - Will be created automatically when users rate trails
   - `activeTrails` - Will be created automatically when users start trails

## Step 3: Set Up Firestore Indexes (If Needed)

Firestore will prompt you to create indexes when you run queries that require them. You can also create them manually:

1. Go to Firebase Console > Firestore Database > Indexes
2. Click **Create Index**
3. Add indexes for common queries:
   - **Collection**: `posts`
     - Fields: `userId` (Ascending), `createdAt` (Descending)
   - **Collection**: `trails`
     - Fields: `location` (Ascending), `createdAt` (Descending)
   - **Collection**: `trailRatings`
     - Fields: `trailId` (Ascending), `createdAt` (Descending)

Or create a `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "posts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "trails",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Then deploy:
```bash
firebase deploy --only firestore:indexes
```

## Step 4: Verify Setup

1. **Check Security Rules:**
   - Go to Firebase Console > Firestore Database > Rules
   - Verify rules are deployed correctly

2. **Check Collections:**
   - Go to Firebase Console > Firestore Database > Data
   - Verify `achievements` collection exists with documents

3. **Test Authentication:**
   - Try signing up a test user
   - Verify a document is created in the `users` collection

## Quick Setup Script

Create a `setup.sh` file for one-command setup:

```bash
#!/bin/bash
echo "🚀 Setting up Firebase..."

# Deploy security rules
echo "📋 Deploying security rules..."
firebase deploy --only firestore:rules

# Initialize database
echo "🗄️  Initializing database..."
npx ts-node scripts/initDatabase.ts

echo "✅ Setup complete!"
```

Make it executable:
```bash
chmod +x setup.sh
./setup.sh
```

## Troubleshooting

### Error: "Firebase project not found"
- Make sure you're logged in: `firebase login`
- Check your project ID in `firebaseConfig.ts`
- Run `firebase use hika-3770e` to set the active project

### Error: "Permission denied"
- Make sure security rules are deployed
- Check that you have the correct permissions in Firebase Console

### Collections not appearing
- Firestore creates collections automatically when you write the first document
- Run the initialization script to create initial data
- Check Firebase Console > Firestore Database > Data

## Next Steps

1. ✅ Security rules deployed
2. ✅ Database structure initialized
3. ✅ Achievements created
4. ⏭️ Test user signup
5. ⏭️ Test creating trails
6. ⏭️ Test creating posts

