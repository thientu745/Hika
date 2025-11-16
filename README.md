# Hika

## Getting Started

### 1. Setup Environment
```bash
git clone https://github.com/thientu745/Hika.git
cd Hika
```

### 2. Install Dependencies
```bash
cd HikaApp
npm install
```

### 3. Building Locally

After installing dependencies, you can run the app on different platforms:

#### Start the Development Server

```bash
cd HikaApp
npx expo start
```

This will start the Expo development server and display a QR code in your terminal.

#### Running on Web

To run the app in your web browser:

```bash
cd HikaApp
npx expo start --web
```

Or press `w` in the terminal after starting the development server.

The app will automatically open in your default web browser at `http://localhost:8081` (or the next available port).

#### Running on Android

**Option 1: Using Android Emulator**
1. Make sure you have [Android Studio](https://developer.android.com/studio) installed with an Android emulator set up
2. Start your Android emulator
3. Run:
   ```bash
   cd HikaApp
   npx expo start
   ```
4. Press `a` in the terminal to open the app in the Android emulator

**Option 2: Using Physical Device**
1. Enable Developer Options and USB Debugging on your Android device
2. Connect your device via USB
3. Run:
   ```bash
   cd HikaApp
   npx expo start
   ```
4. Press `a` in the terminal, or scan the QR code with the Expo Go app

#### Running on iOS

**Option 1: Using iOS Simulator (macOS only)**
1. Make sure you have [Xcode](https://developer.apple.com/xcode/) installed
2. Run:
   ```bash
   cd HikaApp
   npx expo start
   ```
3. Press `i` in the terminal to open the app in the iOS simulator

**Option 2: Using Physical Device (Recommended)**
1. Install the [Expo Go](https://apps.apple.com/app/expo-go/id982107779) app on your iOS device from the App Store
2. Make sure your iOS device and computer are on the same Wi-Fi network
3. Run with tunnel mode:
   ```bash
   cd HikaApp
   npx expo start --tunnel
   ```
4. Scan the QR code displayed in the terminal using:
   - **iOS Camera app**: Point your camera at the QR code and tap the notification
   - **Expo Go app**: Open Expo Go and tap "Scan QR Code"
5. The app will load on your device

> **Note**: The `--tunnel` flag is recommended for iOS as it works even when your device and computer are on different networks, making it easier to test on physical devices.





