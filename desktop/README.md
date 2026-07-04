# AirDeck Presenter (Desktop)

This is the desktop presenter client for the **AirDeck** secure presentation controller ecosystem. It runs natively on Windows, macOS, and Linux, serving as the central PowerPoint/slide presenter engine that you control remotely from your phone.

Built with **Wails (Go + React TypeScript)** and styled using a custom Swiss Flat Minimalist UI design.

---

## ✨ Features

- **Encrypted Presentation Library:** Saves metadata, slides, and local folder paths inside an AES-256-GCM encrypted database (`library.enc`).
- **PowerPoint File (PPTX) Processing:** Native extraction and parsing of PowerPoint archives into highly optimized image sequences.
- **WebRTC Data Channels:** Establishes direct Peer-to-Peer, low-latency control streams with paired mobile controllers.
- **Offline BLE GATT Peripheral:** Broadcasts and receives commands via Bluetooth Low Energy (BLE) when local Wi-Fi networks are unavailable.
- **Local Network Discovery:** Runs a background UDP discovery service allowing mobile controllers to discover local IP addresses automatically.
- **Elliptic Curve Security (ECDH):** Generates ephemeral NIST P-256 keys to secure all messages before transmission.

---

## 🛠️ Prerequisites

Before you get started, ensure you have the following installed on your machine:
- **Go** (version 1.20 or later)
- **Node.js** (LTS) & npm
- **Wails CLI** (Install instructions: [wails.io/docs/gettingstarted/installation](https://wails.io/docs/gettingstarted/installation))

---

## 🚀 Development & Build

### 1. Run Live Development Mode
To start Wails with hot-reload support for both backend Go code and frontend React changes, run:
```bash
wails dev
```
*Vite dev server will launch the application, reloading instantly as you save changes.*

### 2. Build Standalone Binary
To compile the Go and React codebases into a single, optimized production executable:
```bash
wails build
```
The resulting binary will be placed inside the `build/bin/` folder.

---

## 📁 File Structure

- `/internal`: Core Go modules implementing the system services:
  - `/ble`: Bluetooth LE GATT driver implementation.
  - `/crypto`: AES-256-GCM encryption and NIST P-256 Elliptic Curve Diffie-Hellman handshake mechanisms.
  - `/discovery`: UDP broadcasting discovery engine.
  - `/pptx`: PPTX slide structure extraction logic.
  - `/storage`: JSON local database file manager.
  - `/webrtc`: WebRTC PeerConnection wrappers and local WebSocket fallback signaling server.
- `/frontend`: The web client UI code:
  - `/src`: React views (lock screen, slides manager, slide previews, Table of Contents).
  - `/wailsjs`: Automatically generated Go-JS bindings.
- `/build`: Platform icons (`appicon.png` and Windows/macOS assets) and installation package metadata.
- `wails.json`: Project build parameters and configuration.
