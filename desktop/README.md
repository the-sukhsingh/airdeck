# 💻 AirDeck Presenter (Desktop Client)

[![Desktop OS](https://img.shields.io/badge/Desktop-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)
[![Go Backend](https://img.shields.io/badge/Backend-Go%201.20%2B-00ADD8.svg?logo=go)](#)
[![React Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20TS%20%7C%20Wails-61DAFB.svg?logo=react)](#)
[![Security](https://img.shields.io/badge/Security-E2EE%20%7C%20AES--256--GCM%20%7C%20P--256%20ECDH-success)](#)
[![Transport](https://img.shields.io/badge/Transport-WebRTC%20%7C%20BLE%20%7C%20WebSocket-orange)](#)

AirDeck Presenter is the desktop client for the AirDeck ecosystem. Built on **Wails** (Go + React TypeScript), it functions as the native slide presentation dashboard that loads, parses, secures, and displays slides, while listening for incoming remote navigation commands from the mobile app.

---

## 🎨 Flat Swiss Design System

The desktop app frontend implements a clean and typography-centric **Swiss/Flat Minimalist design** using the stylesheet at [style.css](file:///e:/Projects/ppt-dapp/desktop/frontend/src/style.css):
- **Contrast & Layout**: Large bold headers, ample whitespace, and thin dividers.
- **Flat Layouts**: Zero shadow or blur filters. Card containers rest directly flat on the dark dashboard workspace.
- **Micro-interactions**: Subtle hover scaling, quick transition fades, and clean text indicators.

---

## ⚙️ Core Technical Features

1. **Encrypted local presentation database**: Uses [storage/](file:///e:/Projects/ppt-dapp/desktop/internal/storage) to lock slide lists, Google Slides links, and upload histories under an AES-256-GCM encrypted database (`library.enc`).
2. **Double PPTX parsing stack**:
   - Extracts XML structure, slide notes, and text segments directly in Go ([pptx/](file:///e:/Projects/ppt-dapp/desktop/internal/pptx)).
   - Renders slide pages to high-resolution, lossless PNG files in the background using PowerPoint automation via [pptx_to_images.py](file:///e:/Projects/ppt-dapp/desktop/pptx_to_images.py).
3. **Adaptive PDF parsing fallback**: Uses [pdf/](file:///e:/Projects/ppt-dapp/desktop/internal/pdf) to count pages of loaded PDF files by running raw byte scans or PyMuPDF Python commands, treating each page as an independent slide.
4. **Offline Bluetooth LE advertising**: Leverages [ble/](file:///e:/Projects/ppt-dapp/desktop/internal/ble) to launch a custom local GATT peripheral server. When offline, it accepts and executes encrypted transition instructions directly over Bluetooth channels.
5. **UDP network beacon broad-casting**: Implements [discovery/](file:///e:/Projects/ppt-dapp/desktop/internal/discovery) to broadcast discovery packets on UDP Port `9999` so controllers on the local network can identify the desktop host's local IP address.
6. **E2EE peer negotiation**: Uses [webrtc/](file:///e:/Projects/ppt-dapp/desktop/internal/webrtc) to launch a local signaling server and construct direct, P2P WebRTC PeerConnections to exchange encrypted slide commands and coordinate coordinates for the laser pointer.

---

## 🛠️ Prerequisites

To run or build the desktop application locally, you must install:
- **Go** (v1.20 or newer)
- **Node.js** (LTS version) & npm
- **Wails CLI** (Install via: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- **Python 3** (Optional: Required for local PPTX image rendering on Windows via `pywin32`)

---

## 🚀 Running & Compiling

Before running commands, ensure you are inside the `desktop` directory:
```bash
cd desktop
```

### 1. Development (Hot-Reload Mode)
To compile the Go files, run a Vite server, and open the live window:
```bash
wails dev
```
Any modifications to the Go backend or React frontend files will rebuild and refresh the active application window immediately.

### 2. Compile Standalone Production Binary
To pack all files, icons, compile backend Go, and bundle React assets into a single optimized native executable:
```bash
wails build
```
The compiled output is created at:
- **Windows**: `desktop/build/bin/AirDeck.exe`
- **macOS**: `desktop/build/bin/AirDeck.app`
- **Linux**: `desktop/build/bin/AirDeck`

---

## 📁 Source Code Directory Layout

- [main.go](file:///e:/Projects/ppt-dapp/desktop/main.go): Wails initialization and window configuration setup.
- [app.go](file:///e:/Projects/ppt-dapp/desktop/app.go): Wails bindings exposing Go operations (database, crypto, pairing) to JS.
- [/internal/ble/](file:///e:/Projects/ppt-dapp/desktop/internal/ble/): Configures and runs BLE characteristics for command listener.
- [/internal/crypto/](file:///e:/Projects/ppt-dapp/desktop/internal/crypto/): E2EE key exchange handlers and AES-GCM functions.
- [/internal/storage/](file:///e:/Projects/ppt-dapp/desktop/internal/storage/): Controls encrypted JSON file read/writes.
- [/internal/webrtc/](file:///e:/Projects/ppt-dapp/desktop/internal/webrtc/): WebSocket pair signaling and WebRTC DataChannel listeners.
- [/frontend/src/App.tsx](file:///e:/Projects/ppt-dapp/desktop/frontend/src/App.tsx): Dashboard application screens and layouts.
