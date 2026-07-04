import { generateKeyPair, deriveSharedKey, encryptData, decryptData, getFingerprint, base64ToArrayBuffer, arrayBufferToBase64, ECDHKeyPair } from "./crypto";
import { BleManager, Device, Subscription } from "react-native-ble-plx";
import { Platform } from "react-native";

const BLE_SERVICE_UUID = "d4067332-9cb7-4a02-b06d-e4fb92d326f5";
const BLE_WRITE_UUID = "d4067332-9cb7-4a02-b06d-e4fb92d326f6";
const BLE_NOTIFY_UUID = "d4067332-9cb7-4a02-b06d-e4fb92d326f7";

export interface SlideInfo {
  index: number;
  title: string;
}

export interface SlideUpdate {
  currentSlideIndex: number;
  totalSlides: number;
  notes: string;
  presentationName: string;
  toc?: SlideInfo[];
}

export type ConnectionState = "disconnected" | "connecting" | "authenticating" | "connected";

class ConnectionManager {
  private ws: WebSocket | null = null;
  private aesKey: Uint8Array | null = null;
  private deviceName: string = "Mobile Remote";
  private activeState: ConnectionState = "disconnected";
  
  // BLE State variables
  private bleManager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private notifySubscription: Subscription | null = null;
  private connectionType: "wifi" | "ble" = "wifi";
  private bleChunkBuffers: { [msgId: string]: { [chunkIdx: number]: string } } = {};
  
  // Callbacks
  public onStateChange: (state: ConnectionState) => void = () => {};
  public onFingerprint: (fingerprint: string) => void = () => {};
  public onSlideUpdate: (update: SlideUpdate) => void = () => {};
  public onError: (error: string) => void = () => {};

  public getState(): ConnectionState {
    return this.activeState;
  }

  private updateState(state: ConnectionState) {
    this.activeState = state;
    this.onStateChange(state);
  }

  public async connect(target: string | string[], deviceName: string, port?: number) {
    this.deviceName = deviceName;
    this.disconnect();
    
    this.updateState("connecting");
    
    let targets: string[] = [];
    if (Array.isArray(target)) {
      targets = target.map(ip => port ? `${ip}:${port}` : ip);
    } else {
      targets = [target];
    }
    
    console.log("[Service] Attempting parallel connection to endpoints:", targets);

    let resolved = false;
    const sockets: WebSocket[] = [];
    let failedCount = 0;
    
    // Set a global timeout of 10 seconds
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sockets.forEach(s => {
          try { s.close(); } catch(e){}
        });
        this.updateState("disconnected");
        this.onError("Connection timed out.");
      }
    }, 10000);

    targets.forEach(async (endpoint) => {
      try {
        const url = `ws://${endpoint}/signaling`;
        const socket = new WebSocket(url);
        sockets.push(socket);

        socket.onopen = async () => {
          if (resolved) {
            socket.close();
            return;
          }
          console.log(`[Service] Connected to ${endpoint}. Starting handshake...`);
          this.updateState("authenticating");
          
          try {
            const keys = await generateKeyPair();
            
            const handshake = {
              type: "handshake",
              publicKey: keys.publicKeyBase64,
            };
            socket.send(JSON.stringify(handshake));

            socket.onmessage = async (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data.type === "handshake") {
                  if (resolved) {
                    socket.close();
                    return;
                  }
                  resolved = true;
                  clearTimeout(timeoutId);
                  console.log(`[Service] Handshake reply received on ${endpoint}, deriving AES key...`);

                  // Close all other sockets
                  sockets.forEach(s => {
                    if (s !== socket) {
                      try { s.close(); } catch(e){}
                    }
                  });

                  this.ws = socket;
                  const derivedKey = await deriveSharedKey(keys.privateKey, data.publicKey);
                  this.aesKey = derivedKey;

                  // Compute and notify safety fingerprint
                  const fingerprintHex = await getFingerprint(derivedKey);
                  this.onFingerprint(fingerprintHex);

                  // Setup the encrypted channel listener
                  this.setupEncryptedListener();

                  // Send encrypted pairing request identity
                  const identityPayload = JSON.stringify({
                    type: "pairing-request",
                    deviceName: this.deviceName,
                  });
                  await this.sendEncryptedPayload(identityPayload);
                  console.log("[Service] Pairing request sent. Waiting for user approval...");
                  this.updateState("authenticating"); // Keep state as authenticating until pairing response
                }
              } catch (err: any) {
                console.error(`[Service] Handshake message parsing failed on ${endpoint}`, err);
                socket.close();
              }
            };

          } catch (err: any) {
            console.error(`[Service] Handshake setup failed on ${endpoint}`, err);
            socket.close();
          }
        };

        socket.onerror = (e) => {
          console.log(`[Service] Socket error on ${endpoint}`);
          socket.close();
        };

        socket.onclose = () => {
          if (!resolved) {
            failedCount++;
            if (failedCount === targets.length) {
              clearTimeout(timeoutId);
              this.updateState("disconnected");
              this.onError("Failed to connect to any presenter IP.");
              this.disconnect();
            }
          }
        };

      } catch (err: any) {
        console.error(`[Service] WebSocket creation failed for ${endpoint}`, err);
        if (!resolved) {
          failedCount++;
          if (failedCount === targets.length) {
            clearTimeout(timeoutId);
            this.updateState("disconnected");
            this.onError("Failed to connect to any presenter IP.");
            this.disconnect();
          }
        }
      }
    });
  }

  private setupEncryptedListener() {
    if (!this.ws) return;
    this.ws.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "encrypted" && this.aesKey) {
          const decStr = await decryptData(data.ciphertext, this.aesKey);
          const payload = JSON.parse(decStr);

          if (payload.type === "pairing-response") {
            if (payload.status === "accepted") {
              console.log("[Service] Connection Accepted by desktop!");
              this.updateState("connected");
              
              // Request current slide details
              await this.sendControlCommand({ action: "request-slides" });
            } else {
              this.onError("Connection rejected by presenter.");
              this.disconnect();
            }
          } else if (payload.type === "status-update") {
            this.onSlideUpdate({
              currentSlideIndex: payload.currentSlideIndex,
              totalSlides: payload.totalSlides,
              notes: payload.notes || "No notes available.",
              presentationName: payload.presentationName || "Untitled Presentation",
              toc: payload.toc
            });
          }
        }
      } catch (err: any) {
        console.error("[Service] E2EE decrypt failure", err);
      }
    };
  }

  public async sendControlCommand(cmd: any) {
    const plaintext = JSON.stringify(cmd);
    await this.sendEncryptedPayload(plaintext);
  }

  private async sendEncryptedPayload(plaintext: string) {
    if (this.connectionType === "wifi") {
      if (!this.ws || !this.aesKey) return;
      try {
        const encText = await encryptData(plaintext, this.aesKey);
        this.ws.send(JSON.stringify({
          type: "encrypted",
          ciphertext: encText
        }));
      } catch (err) {
        console.error("[Service] Failed to encrypt/send payload", err);
      }
    } else {
      if (!this.connectedDevice || !this.aesKey) return;
      try {
        const encText = await encryptData(plaintext, this.aesKey);
        const payload = JSON.stringify({
          type: "encrypted",
          ciphertext: encText
        });
        const encoder = new TextEncoder();
        const base64Payload = arrayBufferToBase64(encoder.encode(payload));
        // Use writeCharacteristicWithoutResponseForService as Windows BLE Peripheral stack does not automatically handle GATT write response deferrals
        await this.connectedDevice.writeCharacteristicWithoutResponseForService(
          BLE_SERVICE_UUID,
          BLE_WRITE_UUID,
          base64Payload
        );
      } catch (err) {
        console.error("[BLE] Failed to encrypt/send payload", err);
      }
    }
  }

  private initBleManager() {
    if (!this.bleManager) {
      this.bleManager = new BleManager();
    }
  }

  public scanForPresenters(onDeviceFound: (device: Device) => void, onError: (err: string) => void): () => void {
    this.initBleManager();
    console.log("[BLE] Starting scan for AirDeck services...");
    
    this.bleManager!.startDeviceScan(
      [BLE_SERVICE_UUID],
      null,
      (error, device) => {
        if (error) {
          console.error("[BLE] Scan error:", error);
          onError(error.message || "Failed to scan for Bluetooth devices.");
          return;
        }
        if (device) {
          onDeviceFound(device);
        }
      }
    );

    return () => {
      console.log("[BLE] Stopping device scan.");
      this.bleManager?.stopDeviceScan();
    };
  }

  public async connectBLE(device: Device, deviceName: string) {
    this.deviceName = deviceName;
    this.disconnect();
    this.connectionType = "ble";
    this.updateState("connecting");

    // Stop scan immediately if active to avoid connection conflicts
    if (this.bleManager) {
      try {
        console.log("[BLE] Stopping scan before connection...");
        this.bleManager.stopDeviceScan();
      } catch (e) {}
    }

    try {
      this.initBleManager();
      console.log(`[BLE] Connecting to device: ${device.name || device.id}`);
      
      const connectedDevice = await this.bleManager!.connectToDevice(device.id);
      this.connectedDevice = connectedDevice;
      
      // Wait 600ms to let connection settle before service discovery (prevents immediate GATT disconnects)
      console.log("[BLE] Connection established. Settling link parameters...");
      await new Promise(resolve => setTimeout(resolve, 600));
      
      console.log("[BLE] Discovering services and characteristics...");
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // Request higher MTU after services are discovered to allow large status updates
      if (Platform.OS === "android") {
        try {
          console.log("[BLE] Requesting MTU 512...");
          const dev = await connectedDevice.requestMTU(512);
          console.log(`[BLE] MTU negotiation complete. Effective MTU: ${dev.mtu}`);
        } catch (mtuErr) {
          console.warn("[BLE] Request MTU failed:", mtuErr);
        }
      }

      this.updateState("authenticating");

      // Generate keys for E2EE handshake
      const keys = await generateKeyPair();
      
      // Setup notification monitoring
      console.log("[BLE] Subscribing to notifications...");
      this.notifySubscription = connectedDevice.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_NOTIFY_UUID,
        async (error, characteristic) => {
          if (error) {
            console.error("[BLE] Notification error:", error);
            this.onError("Bluetooth connection broken.");
            this.disconnect();
            return;
          }
          if (characteristic?.value) {
            try {
              await this.handleIncomingBLEData(characteristic.value, keys);
            } catch (err) {
              console.error("[BLE] Error handling incoming data:", err);
            }
          }
        }
      );

      // Wait for notification subscription to establish on peripheral (prevents race condition)
      await new Promise(resolve => setTimeout(resolve, 800));

      // Send unencrypted handshake (Public Key Exchange)
      const handshake = {
        type: "handshake",
        publicKey: keys.publicKeyBase64,
      };
      
      const textEncoder = new TextEncoder();
      const handshakeB64 = arrayBufferToBase64(textEncoder.encode(JSON.stringify(handshake)));
      
      console.log("[BLE] Sending handshake public key...");
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        BLE_SERVICE_UUID,
        BLE_WRITE_UUID,
        handshakeB64
      );

    } catch (err: any) {
      console.error("[BLE] Connection failed:", err);
      this.onError(err.message || "Failed to connect over Bluetooth.");
      this.disconnect();
    }
  }

  private async handleIncomingBLEData(base64Data: string, keys: ECDHKeyPair) {
    try {
      const rawText = atob(base64Data);

      // Check if this payload is a chunk
      if (rawText.startsWith("C:")) {
        const parts: string[] = [];
        let remaining = rawText;
        for (let i = 0; i < 4; i++) {
          const colonIdx = remaining.indexOf(":");
          if (colonIdx === -1) break;
          parts.push(remaining.substring(0, colonIdx));
          remaining = remaining.substring(colonIdx + 1);
        }
        parts.push(remaining);

        if (parts.length < 5) {
          console.warn("[BLE] Malformed chunk received:", rawText);
          return;
        }

        const msgId = parts[1];
        const chunkIdx = parseInt(parts[2], 10);
        const totalChunks = parseInt(parts[3], 10);
        const chunkPayload = parts[4];

        if (!this.bleChunkBuffers[msgId]) {
          this.bleChunkBuffers[msgId] = {};
        }
        this.bleChunkBuffers[msgId][chunkIdx] = chunkPayload;

        const receivedCount = Object.keys(this.bleChunkBuffers[msgId]).length;
        if (receivedCount === totalChunks) {
          // Reassemble the complete payload string
          let fullText = "";
          for (let i = 0; i < totalChunks; i++) {
            fullText += this.bleChunkBuffers[msgId][i];
          }
          delete this.bleChunkBuffers[msgId];

          // Parse and process full JSON payload
          const data = JSON.parse(fullText);
          await this.processBLEPayload(data, keys);
        }
      } else {
        // Fallback for non-chunked legacy notifications
        const data = JSON.parse(rawText);
        await this.processBLEPayload(data, keys);
      }
    } catch (err) {
      console.error("[BLE] Failed to parse or decrypt BLE notification:", err);
    }
  }

  private async processBLEPayload(data: any, keys: ECDHKeyPair) {
    if (data.type === "handshake") {
      console.log("[BLE] Handshake reply received, deriving AES key...");
      const derivedKey = await deriveSharedKey(keys.privateKey, data.publicKey);
      this.aesKey = derivedKey;

      // Compute and notify safety fingerprint
      const fingerprintHex = await getFingerprint(derivedKey);
      this.onFingerprint(fingerprintHex);

      // Send encrypted pairing request identity
      const identityPayload = JSON.stringify({
        type: "pairing-request",
        deviceName: this.deviceName,
      });
      
      await this.sendEncryptedPayload(identityPayload);
      console.log("[BLE] Pairing request sent over BLE. Waiting for user approval...");
      this.updateState("authenticating");
    } else if (data.type === "encrypted" && this.aesKey) {
      const decStr = await decryptData(data.ciphertext, this.aesKey);
      const payload = JSON.parse(decStr);

      if (payload.type === "pairing-response") {
        if (payload.status === "accepted") {
          console.log("[BLE] Connection Accepted by desktop!");
          this.updateState("connected");
          
          // Request current slide details
          await this.sendControlCommand({ action: "request-slides" });
        } else {
          this.onError("Connection rejected by presenter.");
          this.disconnect();
        }
      } else if (payload.type === "status-update") {
        this.onSlideUpdate({
          currentSlideIndex: payload.currentSlideIndex,
          totalSlides: payload.totalSlides,
          notes: payload.notes || "No notes available.",
          presentationName: payload.presentationName || "Untitled Presentation",
          toc: payload.toc
        });
      }
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    
    if (this.notifySubscription) {
      this.notifySubscription.remove();
      this.notifySubscription = null;
    }
    
    if (this.connectedDevice) {
      const deviceId = this.connectedDevice.id;
      try {
        this.connectedDevice.cancelConnection();
      } catch (e) {}
      if (this.bleManager) {
        try {
          this.bleManager.cancelDeviceConnection(deviceId);
        } catch (e) {}
      }
      this.connectedDevice = null;
    }

    this.aesKey = null;
    this.connectionType = "wifi";
    if (this.activeState !== "disconnected") {
      this.updateState("disconnected");
    }
  }
}

export const connectionService = new ConnectionManager();
