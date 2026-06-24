import React, { useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { connectionService, SlideInfo } from "../src/services/connection";

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

  // Bind service callbacks on mount
  useEffect(() => {
    connectionService.onStateChange = (state) => {
      if (state === "connected") {
        setScreen("controller");
      } else if (state === "disconnected") {
        setScreen("connect");
        setFingerprint("");
        setToc([]);
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
      theme={theme}
      toggleTheme={toggleTheme}
      onDisconnect={disconnect}
      sendEncryptedCommand={sendEncryptedCommand}
    />
  );
}
