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
- **Windows**: `desktop/build/bin/desktop.exe`
- **macOS**: `desktop/build/bin/desktop.app`
- **Linux**: `desktop/build/bin/desktop`

---

## 📱 2. Running the Mobile Application

Ensure you are inside the `mobile` directory:
```bash
cd mobile
```

### Step 1: Start the Expo Packager
Start the local Expo development server:
```bash
npm run start
```

### Step 2: Open on your physical phone
1. Download the free **Expo Go** app from the App Store (iOS) or Google Play Store (Android).
2. Ensure your phone is connected to the **same WiFi network** as your laptop.
3. Open your phone camera or the Expo Go app, and scan the QR code printed in your terminal window.

---

## 🔗 3. Connecting the Ecosystem

1. **Unlock Desktop Storage**:
   - On the desktop app window, enter a passphrase (min 6 characters) to initialize and unlock your encrypted presentation storage.
2. **Load your Slides**:
   - Tap **Upload PPTX** to open the native OS file selector and pick a `.pptx` slide file, or tap **Link Google Slides** to enter a title and a web-published slides link.
3. **Open the Presenter Session**:
   - Hover over the loaded presentation card and click **Present**.
   - Note the **Room ID**, **Passcode**, and **WiFi Local IPs** displayed on the right sidebar (e.g. `192.168.1.50:12345`).
4. **Link the Mobile Remote**:
   - In the mobile app, enter your remote friendly name, the **Local IP & Port** (e.g., `192.168.1.50:12345`), and the **Passcode** shown on the presenter window.
   - Tap **Connect Remote**.
5. **Approve Pairing Dialog**:
   - Check your laptop screen. A popup prompt will appear asking: *"Pair with [Phone Name]?"* displaying a matching security fingerprint.
   - Click **Accept** to finish the E2EE key derivation.
6. **Start Controlling**:
   - Swipe or tap next/prev to navigate slides.
   - Check the **Slides** tab to view the Table of Contents outline.
   - Touch and drag on the **Laser** tab to guide the laser pointer on the presentation screen!
