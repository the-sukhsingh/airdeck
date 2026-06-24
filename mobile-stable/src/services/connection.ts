import { generateKeyPair, deriveSharedKey, encryptData, decryptData, getFingerprint } from "./crypto";

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
  }

  public disconnect() {
    if (this.ws) {
      // Clear event listeners before closing to prevent loopbacks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.aesKey = null;
    if (this.activeState !== "disconnected") {
      this.updateState("disconnected");
    }
  }
}

export const connectionService = new ConnectionManager();
