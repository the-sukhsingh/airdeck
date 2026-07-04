# AirDeck: Startup & Running Guide

Follow these steps to run and connect the native Go desktop application and the Expo mobile remote controller.

---

## 💻 1. Running the Desktop Application

Ensure you are inside the `desktop` directory:
```bash
cd desktop
```

### Option A: Run in Development Mode (Recommended)
This runs the application with live hot-reloading for both the Go backend and React frontend.
```bash
wails dev
```
*Wails will compile the code, open a desktop app window, and automatically rebuild whenever you change Go or React files.*

### Option B: Build a Standalone Executable
To package the app into a production binary:
```bash
wails build
```
Once compilation completes, the standalone executable will be generated at:
- **Windows**: `desktop/build/bin/AirDeck.exe`
- **macOS**: `desktop/build/bin/AirDeck.app`
- **Linux**: `desktop/build/bin/AirDeck`

---

## 📱 2. Running the Mobile Application

Ensure you are inside the `mobile-stable` directory:
```bash
cd mobile-stable
```

### Option A: Running on a Physical Device (Recommended for BLE/Camera)
For full support of native modules like WebRTC PeerConnections and Bluetooth Low Energy (BLE) scanning, run native builds directly on your device:
```bash
# For Android
npm run android

# For iOS
npm run ios
```

### Option B: Running via Expo Go
To test in the lightweight sandbox mode:
```bash
npm run start
```
Open your phone camera or the **Expo Go** app, and scan the QR code printed in your terminal window.

---

## 🔗 3. Connecting the Ecosystem

1. **Unlock Desktop Storage**:
   - On the desktop app window, enter a passphrase (min 6 characters) to initialize and unlock your encrypted presentation storage library.
2. **Load your Slides**:
   - Click **Upload PPTX** to pick a `.pptx` file from your computer, or **Link Google Slides** to enter a title and a web-published slides URL.
3. **Open the Presenter Session**:
   - Hover over the loaded presentation card and click **Present** to start.
   - This will open the presentation dashboard and display a secure **Pairing QR Code** on the laptop screen.
4. **Link the Mobile Remote**:
   - **Method A (Wi-Fi QR Scan - Recommended)**:
     - On the mobile app, make sure you are in the **Wi-Fi** tab.
     - Tap **Scan Pairing QR Code**.
     - Point your phone's camera at the QR code displayed on the desktop app. It will pair and connect automatically!
   - **Method B (Bluetooth LE - Offline)**:
     - On the mobile app, switch to the **Bluetooth** tab.
     - Tap **SCAN** to search for nearby presenters.
     - Tap on your laptop in the list to pair.
5. **Approve Pairing Dialog**:
   - Check your laptop screen. A popup prompt will appear asking: *"Pair with [Phone Name]?"* displaying a matching security fingerprint.
   - Click **Accept** to finish the E2EE key derivation.
6. **Start Controlling**:
   - Swipe or tap next/prev on the mobile touchpad to navigate slides.
   - Check the **Slides** tab on your phone to view the Table of Contents.
   - Touch and drag on the **Laser** tab on your phone to guide the laser pointer on the presentation screen!
