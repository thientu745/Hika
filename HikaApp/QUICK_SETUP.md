# Quick Firebase Setup Guide

## One-Command Setup

### Prerequisites
1. Install Firebase CLI globally (recommended):
   ```bash
   npm install -g firebase-tools
   ```
   Then login:
   ```bash
   firebase login
   ```

   **OR** use npx (no installation needed):
   - The scripts will use `npx firebase-tools` automatically

2. Install ts-node (already added to devDependencies):
   ```bash
   npm install
   ```

### Setup Steps

#### Option 1: Using NPM Scripts (Recommended)

```bash
# 1. Deploy Security Rules
npm run deploy-rules

# 2. Initialize Database (Creates Achievements)
npm run init-db

# 3. Deploy Indexes (Optional but Recommended)
npm run deploy-indexes
```

#### Option 2: Using Firebase CLI Directly

If you have Firebase CLI installed globally:

```bash
# 1. Deploy Security Rules
firebase deploy --only firestore:rules

# 2. Initialize Database
npm run init-db

# 3. Deploy Indexes
firebase deploy --only firestore:indexes
```

#### Option 3: Using npx (No Global Installation)

```bash
# 1. Deploy Security Rules
npx firebase-tools deploy --only firestore:rules

# 2. Initialize Database
npm run init-db

# 3. Deploy Indexes
npx firebase-tools deploy --only firestore:indexes
```

## What Gets Created

### ✅ Security Rules
- Deployed from `firestore.rules`
- Protects all collections with proper permissions

### ✅ Achievements Collection
- 10 pre-defined achievements
- Categories: Hikes, Distance, Time, Social, Special
- XP rewards and requirements

### ✅ Firestore Indexes
- Optimized queries for posts, trails, and ratings
- Deployed from `firestore.indexes.json`

## Collections Created Automatically

These collections are created automatically when you use the app:
- `users` - Created when users sign up
- `trails` - Created when trails are added
- `posts` - Created when users post
- `trailRatings` - Created when users rate trails
- `activeTrails` - Created when users start a trail

## Verify Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `hika-3770e`
3. Check **Firestore Database**:
   - Rules tab: Should show your security rules
   - Data tab: Should show `achievements` collection with 10 documents
   - Indexes tab: Should show your indexes (may take a few minutes to build)

## Troubleshooting

**"firebase is not recognized"**
- Use `npm run deploy-rules` (uses npx automatically)
- Or install globally: `npm install -g firebase-tools`
- Or use: `npx firebase-tools deploy --only firestore:rules`

**"Firebase project not found"**
- The project is already set in `.firebaserc` and scripts use `--project hika-3770e`
- If needed, run: `npx firebase-tools use hika-3770e` (but should work without it)

**"Permission denied"**
- Make sure you're logged in: `npx firebase-tools login`
- Or: `firebase login` (if installed globally)
- Check you have admin access to the project

**Collections not showing**
- Firestore creates collections on first write
- Run `npm run init-db` to create achievements
- Other collections appear when you use the app

**"ts-node not found"**
- Run: `npm install` to install devDependencies
- Or: `npm install --save-dev ts-node`

## Next Steps

1. ✅ Security rules deployed
2. ✅ Achievements initialized
3. ✅ Indexes created
4. ⏭️ Test the app!
5. ⏭️ Sign up a test user
6. ⏭️ Create some trails
