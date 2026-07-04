# AirDeck: Secure Multi-Platform PPT Controller Ecosystem

A real-time, low-latency, end-to-end encrypted (E2EE) presentation companion system that allows you to control presentations running on your desktop from a mobile application.

- **Desktop App**: Native desktop app (Windows, macOS, Linux) built with a **Go** backend and a **React TypeScript** frontend packaged via **Wails**.
- **Mobile App**: Native mobile app (Android & iOS) built using **React Native (Expo)**.

---

## 🎨 Design Philosophy

Following a premium **Swiss/Flat Minimalist Design System**:
- **Monochrome & Neutral**: A dark UI consisting of shades of black, muted charcoal, and stark whites. No gradients or bright colored accents.
- **Strictly Flat**: No drop shadows, inner shadows, or blurring effects. All elements rest flat against their background.
- **Geometric & Sharp**: Borders have sharp (`0px`) or very subtly softened (`2px` / `16px` for cards) corners.
- **Spacious & Clear**: Generous padding and margins allow for negative space, emphasizing typographic scale and layout clarity.

---

## 🔒 Security & Encryption Architecture

- **End-to-End Encryption (E2EE)**: 
  - Immediately upon connection (WiFi/WebSocket or BLE), the mobile and desktop devices execute an **Elliptic Curve Diffie-Hellman (ECDH)** handshake using the NIST **P-256** curve.
  - They agree on a high-entropy shared secret key, hashed using **SHA-256** to form a 32-byte key.
  - The desktop displays an 8-character verification fingerprint derived from the key. Once accepted, all subsequent communication payloads are encrypted with **AES-256-GCM**.
- **Encrypted Local Storage**: 
  - All local library metadata (starred items, presentation slides, paths, folders, and preferences) on the desktop are stored inside an encrypted JSON database (`library.enc`) in the standard user config path.
  - The database is encrypted using **AES-256-GCM**, unlocked by a passphrase input by the user on startup.

---

## 📡 Network & Transport Layers

1. **Local WiFi/Network**:
   - The desktop app runs a local UDP server listening on port `9999`. The mobile app can broadcast discovery requests to automatically find the desktop IP.
   - For pairing, the desktop launches a temporary WebSocket signaling server and generates a QR code containing local connection endpoints and a unique connection passcode.
   - The mobile app scans this QR code to automatically establish a secure **WebRTC PeerConnection** Data Channel.
   - *Expo Go Fallback*: In standard development runtimes where custom native binary modules (like WebRTC) are not prebuilt, the mobile app automatically falls back to sending E2EE encrypted packets directly over the secure local WebSocket connection, ensuring out-of-the-box development and testing support.
2. **Bluetooth LE (BLE)**:
   - The desktop app configures a GATT peripheral service exposing write and notify characteristics.
   - The mobile app acts as a BLE central device to scan, discover, and pair with the desktop app offline without requiring local network access.

---

## 📁 Workspace Layout

```
ppt-dapp/
├── README.md                   # Ecosystem documentation
├── RUN.md                      # Quick run sheet
├── desktop/                    # Native Desktop Wails Project (AirDeck Presenter)
│   ├── app.go                  # Go main controller & IPC binding functions
│   ├── main.go                 # App entry point
│   ├── wails.json              # Wails project configuration
│   ├── internal/
│   │   ├── ble/                # BLE GATT peripheral driver
│   │   ├── crypto/             # AES-256-GCM and P-256 ECDH modules
│   │   ├── discovery/          # UDP local network discovery service
│   │   ├── pptx/               # PowerPoint XML parser (zip extraction)
│   │   ├── storage/            # Encrypted local JSON storage
│   │   └── webrtc/             # WebRTC PeerConnection & WS signaling server
│   └── frontend/               # React + TS Frontend
│       ├── src/
│       │   ├── App.tsx         # Main dashboard, lockscreen, presentation view
│       │   └── style.css       # Flat minimalist CSS variables & styles
│       └── package.json
└── mobile-stable/              # React Native Expo Mobile Project (AirDeck Controller)
    ├── app/                    # Expo Router application code
    │   ├── App.tsx             # Main entry navigation & state wrapper
    │   ├── screens/            # Application screens (Connect, Controller, etc.)
    │   └── components/         # Shared components (QRScannerModal, Tabs, etc.)
    ├── package.json
    └── src/
        └── services/
            └── connection.ts   # Secure client connection helper (WebRTC, BLE, WS)
```

---

## 🚀 Running the Apps

### 1. Run the Desktop App
Ensure you have Wails installed. To start the app in hot-reload development mode:
```bash
cd desktop
wails dev
```
To compile into a standalone native executable:
```bash
wails build
```

### 2. Run the Mobile App
Ensure you have Expo CLI installed and dependencies configured:
```bash
cd mobile-stable
npm install
npm run android   # to run on Android device/simulator
# or
npm run ios       # to run on iOS device/simulator
```
- Open the application on your physical device.
- Ensure your device is on the same local network as the presenter laptop.
- In **Wi-Fi Mode**, tap **Scan Pairing QR Code** and scan the QR code displayed on the AirDeck desktop presenter app. It will securely establish connection and pair automatically.
- Alternatively, switch to **Bluetooth Mode**, tap **SCAN**, and select your presenter laptop from the scanned devices list.
- Confirm the 8-character verification fingerprint shown on the desktop matches, and start presenting!
