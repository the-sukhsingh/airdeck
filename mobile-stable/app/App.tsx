import React, { useState, useEffect } from "react";
import { useColorScheme, PermissionsAndroid, Platform } from "react-native";
import { connectionService, SlideInfo } from "../src/services/connection";
import { Device } from "react-native-ble-plx";

async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === "ios") {
    return true;
  }
  if (Platform.OS === "android") {
    const apiLevel = parseInt(Platform.Version.toString(), 10);
    if (apiLevel < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
  }
  return false;
}

import ConnectScreen from "./screens/ConnectScreen";
import AuthenticatingScreen from "./screens/AuthenticatingScreen";
import ControllerScreen from "./screens/ControllerScreen";

export default function App() {
  // Navigation & Connection States
  const [screen, setScreen] = useState<"connect" | "authenticating" | "controller">("connect");
  const [deviceName, setDeviceName] = useState<string>("Mobile Remote");
  const [targetIP, setTargetIP] = useState<string>(""); // format: "192.168.1.50:12345"
  const [roomID, setRoomID] = useState<string>("");
  const [passcode, setPasscode] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [fingerprint, setFingerprint] = useState<string>("");

  // BLE-specific States
  const [connectionMode, setConnectionMode] = useState<"wifi" | "ble">("wifi");
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Theme State
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<"light" | "dark">(systemScheme === "light" ? "light" : "dark");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Active Presentation States
  const [prezName, setPrezName] = useState<string>("No Presentation");
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [totalSlides, setTotalSlides] = useState<number>(1);
  const [notes, setNotes] = useState<string>("No notes loaded.");
  const [toc, setToc] = useState<SlideInfo[]>([]);
  const [slideImage, setSlideImage] = useState<string>("");

  // Bind service callbacks on mount
  useEffect(() => {
    connectionService.onStateChange = (state) => {
      if (state === "connected") {
        setScreen("controller");
      } else if (state === "disconnected") {
        setScreen("connect");
        setFingerprint("");
        setToc([]);
        setSlideImage("");
      } else if (state === "authenticating" || state === "connecting") {
        setScreen("authenticating");
      }
    };

    connectionService.onFingerprint = (fp) => {
      setFingerprint(fp);
    };

    connectionService.onSlideUpdate = (update) => {
      setCurrentSlide(update.currentSlideIndex);
      setTotalSlides(update.totalSlides);
      setNotes(update.notes || "No notes available.");
      setPrezName(update.presentationName || "Untitled Presentation");
      setSlideImage(update.slideImage || "");
      if (update.toc) {
        setToc(update.toc);
      }
    };

    connectionService.onError = (err) => {
      setErrorMsg(err);
    };

    return () => {
      connectionService.disconnect();
    };
  }, []);

  const disconnect = () => {
    connectionService.disconnect();
    setScreen("connect");
    setFingerprint("");
    setToc([]);
    setSlideImage("");
  };

  // Connection flow
  const handleConnect = async () => {
    setErrorMsg("");
    if (!targetIP) {
      setErrorMsg("IP Address & Port is required.");
      return;
    }
    await connectionService.connect(targetIP, deviceName);
  };

  const handleStartScan = async () => {
    setErrorMsg("");
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      setErrorMsg("Bluetooth permissions denied.");
      return;
    }

    setScannedDevices([]);
    setIsScanning(true);

    let stopScanFn: (() => void) | null = null;
    try {
      stopScanFn = connectionService.scanForPresenters(
        (device) => {
          setScannedDevices((prev) => {
            if (prev.some((d) => d.id === device.id)) {
              return prev;
            }
            return [...prev, device];
          });
        },
        (err) => {
          setErrorMsg(err);
          setIsScanning(false);
        }
      );
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to start BLE scan.");
      setIsScanning(false);
      return;
    }

    // Auto-stop scanning after 8 seconds
    setTimeout(() => {
      if (stopScanFn) {
        stopScanFn();
      }
      setIsScanning(false);
    }, 8000);
  };

  const handleConnectBLE = async (device: Device) => {
    setErrorMsg("");
    setIsScanning(false);
    await connectionService.connectBLE(device, deviceName);
  };

  // QR Code Scanned Handler
  const handleQRScan = async (data: string) => {
    setErrorMsg("");
    try {
      console.log(data)
      const payload = JSON.parse(data);
      if (payload.ips && payload.port && payload.roomId && payload.passcode) {
        const primaryIP = `${payload.ips[0]}:${payload.port}`;
        setTargetIP(primaryIP);
        setRoomID(payload.roomId);
        setPasscode(payload.passcode);
        await connectionService.connect(payload.ips, deviceName, payload.port);
      } else {
        setErrorMsg("Invalid QR code format.");
      }
    } catch (err) {
      if (data.includes(":")) {
        setTargetIP(data);
        await connectionService.connect(data, deviceName);
      } else {
        setErrorMsg("Scanned QR code is not valid.");
      }
    }
  };

  // Helper to send encrypted messages
  const sendEncryptedCommand = async (cmd: any) => {
    await connectionService.sendControlCommand(cmd);
  };

  if (screen === "connect") {
    return (
      <ConnectScreen
        deviceName={deviceName}
        setDeviceName={setDeviceName}
        targetIP={targetIP}
        setTargetIP={setTargetIP}
        passcode={passcode}
        setPasscode={setPasscode}
        errorMsg={errorMsg}
        theme={theme}
        toggleTheme={toggleTheme}
        onConnect={handleConnect}
        onScanQR={handleQRScan}
        onDismissError={() => setErrorMsg("")}
        connectionMode={connectionMode}
        setConnectionMode={setConnectionMode}
        scannedDevices={scannedDevices}
        isScanning={isScanning}
        onStartScan={handleStartScan}
        onConnectBLE={handleConnectBLE}
      />
    );
  }

  if (screen === "authenticating") {
    return (
      <AuthenticatingScreen
        fingerprint={fingerprint}
        theme={theme}
        onCancel={disconnect}
      />
    );
  }

  return (
    <ControllerScreen
      prezName={prezName}
      currentSlide={currentSlide}
      totalSlides={totalSlides}
      notes={notes}
      toc={toc}
      slideImage={slideImage}
      theme={theme}
      toggleTheme={toggleTheme}
      onDisconnect={disconnect}
      sendEncryptedCommand={sendEncryptedCommand}
    />
  );
}
