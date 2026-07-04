# AirDeck Controller (Mobile)

This is the mobile remote controller app for the **AirDeck** secure presentation ecosystem. It enables you to control presentation slides running on your laptop directly from your phone over local Wi-Fi or Bluetooth.

Built with **React Native (Expo)**, TypeScript, and styled using a clean minimalist design.

---

## ✨ Features

- **Minimal QR Pairing:** Point your phone camera at the QR code displayed on the desktop app to pair instantly over Wi-Fi. No manual IP typing or passcode entries required.
- **Offline Bluetooth Mode (BLE):** Scan and connect to your laptop directly using Bluetooth Low Energy (BLE) for environments without a shared Wi-Fi network.
- **Slide Notes & Table of Contents:** Displays real-time presenter notes and slide titles on your phone screen so you stay on track.
- **Gesture Control Touchpad:** Swipe and tap on the controller touchpad to navigate slides seamlessly.
- **End-to-End Encrypted (E2EE):** Automatically negotiates a cryptographic shared key (ECDH P-256) on connection, encrypting all control packets using AES-256-GCM.

---

## 🛠️ Prerequisites

To run the mobile application locally, you will need:
- **Node.js** (LTS) & npm.
- **Expo Go** app installed on your physical iOS/Android device, or configured local Emulators (Android Studio / Xcode).
- **Physical Device Permissions:** The app requires access to the **Camera** (for QR scanning) and **Location/Bluetooth** (for BLE scanning and connecting).

---

## 🚀 Getting Started

### 1. Install Dependencies
Navigate into the mobile directory and install the packages:
```bash
cd mobile-stable
npm install
```

### 2. Start the Development Server
```bash
npm run start
# or
npx expo start
```
*This starts the Expo bundler. Scan the terminal's QR code using your phone's camera (iOS) or the Expo Go app (Android) to load the app.*

### 3. Run Native Builds (Recommended for BLE/WebRTC support)
To compile the native app binaries locally on your computer:
```bash
# Android Build
npm run android

# iOS Build
npm run ios
```
*Note: Using a native build is recommended because features like native WebRTC and BLE plx drivers require native compilation.*

---

## 📁 File Structure

- `/app`: Main application screens and routing logic:
  - `App.tsx`: App entry, handles global theme, screen routing, and connection service hooks.
  - `/screens/ConnectScreen.tsx`: The minimalist welcome page for scanning QR codes and BLE presenters.
  - `/screens/AuthenticatingScreen.tsx`: Secure handshake progress page.
  - `/screens/ControllerScreen.tsx`: Touchpad gesture pad, slide list view, notes panel, and status dashboard.
  - `/components/QRScannerModal.tsx`: Native camera view overlay for scanning pairing codes.
- `/src/services`: Connection and crypto utilities:
  - `connection.ts`: Manages WebRTC connection states, WebSocket handshakes, and BLE services.
  - `crypto.ts`: Implements SHA-256 hashing, P-256 ECDH, and AES-GCM decryption/encryption helpers.
