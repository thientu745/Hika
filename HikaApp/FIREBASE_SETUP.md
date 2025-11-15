# Firebase Setup Guide

## Common 400 Bad Request Error Fixes

If you're getting a `400 (Bad Request)` error when trying to sign up or sign in, follow these steps:

### 1. Enable Email/Password Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`hika-3770e`)
3. Navigate to **Authentication** in the left sidebar
4. Click on **Sign-in method** tab
5. Find **Email/Password** in the list
6. Click on it and **Enable** it
7. Click **Save**

### 2. Authorize Your Domain (For Web)

If you're running the app on web (localhost or a custom domain):

1. In Firebase Console, go to **Authentication** > **Settings**
2. Scroll down to **Authorized domains**
3. Make sure these domains are listed:
   - `localhost` (for local development)
   - Your custom domain (if deploying)
   - `hika-3770e.firebaseapp.com` (default Firebase domain)

### 3. Check API Key Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Find your API key (`AIzaSyBltQfm1l5St0t93CQ0ujUeXzT7ssz6MAo`)
5. Check if there are any restrictions:
   - **Application restrictions**: Should allow your domain or be set to "None"
   - **API restrictions**: Should include "Identity Toolkit API" or be set to "Don't restrict key"

### 4. Verify Firebase Configuration

Make sure your `firebaseConfig.ts` has the correct values:
- `apiKey`: Should match your Firebase project
- `authDomain`: Should be `{projectId}.firebaseapp.com`
- `projectId`: Should be `hika-3770e`

### 5. Check Browser Console for Detailed Errors

The improved error handling will now show more specific error messages. Common errors:

- **"Email/Password authentication is not enabled"**: Follow step 1 above
- **"Invalid email address"**: Check email format
- **"Email already in use"**: User already exists, try logging in instead
- **"Network error"**: Check internet connection

## Testing Authentication

After enabling Email/Password authentication:

1. Restart your Expo development server
2. Try signing up with a new email
3. Check the Firebase Console > Authentication > Users to see if the user was created

## Additional Setup for Production

### Enable Additional Sign-in Methods (Optional)

You can also enable:
- **Google Sign-In**
- **Apple Sign-In** (for iOS)
- **Phone Authentication**

### Set Up Email Templates

1. Go to **Authentication** > **Templates**
2. Customize email templates for:
   - Email verification
   - Password reset
   - Email change

### Configure OAuth Redirect URLs

If using OAuth providers:
1. Go to **Authentication** > **Settings** > **Authorized domains**
2. Add your production domain
3. Configure OAuth redirect URLs in provider settings

## Troubleshooting

### Error: "auth/operation-not-allowed"
- **Solution**: Enable Email/Password authentication (Step 1)

### Error: "auth/unauthorized-domain"
- **Solution**: Add your domain to authorized domains (Step 2)

### Error: "auth/api-key-not-valid"
- **Solution**: Check API key restrictions (Step 3)

### Error: "auth/network-request-failed"
- **Solution**: Check internet connection, firewall, or VPN settings

## Security Best Practices

1. **Enable Email Verification**: Require users to verify their email
2. **Set Password Requirements**: Configure minimum password strength
3. **Enable Rate Limiting**: Prevent brute force attacks
4. **Set Up Firestore Security Rules**: Protect user data
5. **Use Environment Variables**: Don't commit API keys to version control (for production)

