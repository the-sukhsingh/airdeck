# AirDeck: Secure Multi-Platform PPT Controller Ecosystem

A real-time, low-latency, end-to-end encrypted (E2EE) presentation companion system that allows you to control presentations running on your desktop from a mobile application.

- **Desktop App**: Native desktop app (Windows, macOS, Linux) built with a **Go** backend and a **React TypeScript** frontend packaged via **Wails**.
- **Mobile App**: Native mobile app (Android & iOS) built using **React Native (Expo)**.

---

## 🎨 Design Philosophy

Following a premium **Swiss/Flat Minimalist Design System**:
- **Monochrome & Neutral**: A dark UI consisting of shades of black, muted charcoal, and stark whites. No gradients or bright colored accents.
- **Strictly Flat**: No drop shadows, inner shadows, or blurring effects. All elements rest flat against their background.
- **Geometric & Sharp**: Borders have sharp (`0px`) or very subtly softened (`2px`) corners. 
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
   - For pairing, the desktop launches a temporary WebSocket signaling server.
   - The devices establish a **WebRTC PeerConnection** Data Channel for remote controls.
   - *Expo Go Fallback*: In standard development runtimes (like Expo Go) where custom native binary modules (like WebRTC) are not prebuilt, the mobile app automatically falls back to sending E2EE encrypted packets directly over the secure local WebSocket connection, ensuring out-of-the-box development and testing support.
2. **Bluetooth LE (BLE)**:
   - The desktop app configures a GATT peripheral service exposing write and notify characteristics.
   - The mobile app acts as a BLE central device to exchange commands and status updates when offline.
3. **Internet Pairing**:
   - For situations with no local network, the app supports manual SDP copy-paste or QR code scanning. The desktop generates an ICE-complete local SDP offer, which the mobile scans, answers, and returns.

---

## 📁 Workspace Layout

```
ppt-dapp/
├── README.md                   # Project documentation
├── desktop/                    # Native Desktop Wails Project
│   ├── app.go                  # Go main controller & IPC binding functions
│   ├── main.go                 # App entry point
│   ├── go.mod                  # Go modules declaration
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
│       │   ├── style.css       # Flat minimalist CSS variables & styles
│       │   └── main.tsx        # React mounting entry point
│       └── package.json
└── mobile/                     # React Native Expo Mobile Project
    ├── App.tsx                 # Mobile pairing, control touchpad, slide listing
    ├── package.json
    └── src/
        └── services/
            └── crypto.ts       # Web Crypto API P-256 ECDH & AES-GCM helpers
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
Ensure you have Expo CLI installed:
```bash
cd mobile
npm run start
```
Open the Expo Go app on your physical iOS/Android phone and scan the QR code displayed in your terminal.
- Enter the presenter's IP/Port shown on the desktop window (e.g. `192.168.1.50:12345`).
- Enter the 6-digit passcode.
- Click accept on the laptop prompt, and start presenting!
