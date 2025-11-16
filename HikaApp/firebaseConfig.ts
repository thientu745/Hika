// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; <- Don't need analytics
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
// const analytics = getAnalytics(app); <- Don't need analytics

// Initialize Auth with platform-specific persistence
// For web: use getAuth (default browser persistence)
// For React Native: use initializeAuth with AsyncStorage persistence
let auth;
if (Platform.OS === 'web') {
  // Web platform: use getAuth with default browser persistence
  auth = getAuth(app);
} else {
  // React Native platform: use initializeAuth with AsyncStorage
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  } catch (error: any) {
    // If auth is already initialized, use getAuth instead
    if (error.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}
export { auth };

// Export Firestore database
export const db = getFirestore(app);

// Export Firebase Storage
export const storage = getStorage(app);