# 📱 AirDeck Controller (Mobile Remote)

[![Mobile OS](https://img.shields.io/badge/Mobile-Android%20%7C%20iOS-lightgrey)](#)
[![Expo Mobile](https://img.shields.io/badge/Mobile-React%20Native%20%7C%20Expo-000020.svg?logo=expo)](#)
[![Security](https://img.shields.io/badge/Security-E2EE%20%7C%20AES--256--GCM%20%7C%20P--256%20ECDH-success)](#)
[![Transport](https://img.shields.io/badge/Transport-WebRTC%20%7C%20BLE%20%7C%20WebSocket-orange)](#)

AirDeck Controller is the mobile remote control application for the AirDeck presentation companion ecosystem. Built using **React Native & Expo**, the app pairs with the presenter desktop client to navigate slides, view speaker notes, browse Table of Contents, and guide the laser pointer remotely.

---

## ✨ Interface & Gesture Features

- **Pairing Camera Scanner**: Features a built-in camera layout that instantly parses connection endpoints and derived credentials from the desktop QR code.
- **Gesture touchpad**: Swipe horizontally to change slides and tap to trigger animations.
- **Presenter notes dashboard**: Pulls speaker notes and text sections in real-time, matching notes to the currently visible slide index.
- **Table of contents browser**: Displays slide previews, allowing users to scroll and tap specific slide rows to jump directly to slides.
- **Laser Pointer tracker**: Tracks touch drag positions (X, Y coordinates), encrypting and syncing them to draw a virtual pointer on the presentation desktop monitor.

---

## 📡 Transport Compatibility & Fallbacks

AirDeck is designed to adapt depending on the runtime environment:

### 1. Expo Go Sandbox (WebSockets Fallback)
When run inside the standard **Expo Go** application sandbox, native binary modules (like native WebRTC peer drivers and Bluetooth LE Central managers) are not bundled. 
- **Behavior**: The controller detects this environment and falls back to transmitting E2EE packets directly over a local network WebSocket connection.
- **Benefit**: Simplifies rapid UI/UX iterations and remote testing without compilation delays.

### 2. Compiled Native Builds (Full WebRTC & BLE Support)
To utilize direct peer-to-peer WebRTC connections or completely offline Bluetooth LE connectivity, the application must be compiled locally with its native layers.
- **WebRTC Mode**: Creates a direct Peer-to-Peer Data Channel with the desktop app, ensuring minimal latencies.
- **BLE Mode**: Runs offline by scanning for the desktop peripheral and transmitting commands directly using Bluetooth GATT services.

---

## 🔒 Permission Requirements

To enable all features, make sure your device permits:
- **Camera Access**: Needed to scan the pairing QR code.
- **Bluetooth / Location Access**: Needed for scanning and connecting to the presenter via Bluetooth Low Energy (BLE).

---

## 🚀 Getting Started

Ensure you are inside the `mobile-stable` directory before running commands:
```bash
cd mobile-stable
```

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Expo Go Dev Server
```bash
npm run start
# or
npx expo start
```
Scan the resulting terminal QR code using **Expo Go** (Android) or the native Camera app (iOS) to load the UI.

### 3. Run Native Local Compilation
To compile native modules locally (highly recommended to test BLE/WebRTC capabilities):
```bash
# Android
npm run android

# iOS
npm run ios
```

---

## 📁 Source Code Directory Layout

- [app/App.tsx](file:///e:/Projects/ppt-dapp/mobile-stable/app/App.tsx): Main entry, routing wrapper, and global connection contexts.
- [app/_layout.tsx](file:///e:/Projects/ppt-dapp/mobile-stable/app/_layout.tsx): Root layout setup.
- [app/index.tsx](file:///e:/Projects/ppt-dapp/mobile-stable/app/index.tsx): Launch screen routing logic.
- [app/screens/ConnectScreen.tsx](file:///e:/Projects/ppt-dapp/mobile-stable/app/screens/ConnectScreen.tsx): Wi-Fi QR pairing scanner and Bluetooth discovery list.
- [app/screens/AuthenticatingScreen.tsx](file:///e:/Projects/ppt-dapp/mobile-stable/app/screens/AuthenticatingScreen.tsx): P-256 ECDH handshake progress screen.
- [app/screens/ControllerScreen.tsx](file:///e:/Projects/ppt-dapp/mobile-stable/app/screens/ControllerScreen.tsx): Laser touchpad, presentation controls, and presenter notes tabs.
- [src/services/connection.ts](file:///e:/Projects/ppt-dapp/mobile-stable/src/services/connection.ts): Network adapters orchestrating WebSocket, WebRTC, and BLE channels.
- [src/services/crypto.ts](file:///e:/Projects/ppt-dapp/mobile-stable/src/services/crypto.ts): Mobile side SHA-256 KDF and AES-GCM decryption/encryption helpers.
