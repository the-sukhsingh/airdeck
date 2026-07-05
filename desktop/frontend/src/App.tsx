import React, { useState, useEffect } from "react";
import {
  GetLibrary,
  StartPresentationSession,
  EndPresentationSession,
} from "../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../wailsjs/runtime/runtime";

import DashboardScreen from "./screens/DashboardScreen";
import PresentationScreen from "./screens/PresentationScreen";
import { Presentation, SessionInfo, ConnectionRequest } from "./types";

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return (saved === "light" || saved === "dark") ? saved : "dark";
  });

  // Library & Session States
  const [library, setLibrary] = useState<Presentation[]>([]);
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [activePrez, setActivePrez] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [pairedDevice, setPairedDevice] = useState<string>("");
  const [connState, setConnState] = useState<string>("disconnected");
  const [pendingRequest, setPendingRequest] = useState<ConnectionRequest | null>(null);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const loadLibrary = async () => {
    try {
      const list = await GetLibrary();
      setLibrary(list || []);
    } catch (err) {
      console.error("Failed to load library", err);
    }
  };

  // Load library & listen to Wails events on mount
  useEffect(() => {
    loadLibrary();

    EventsOn("connection-request", (data: ConnectionRequest) => {
      setPendingRequest(data);
    });

    EventsOn("paired-device", (name: string) => {
      setPairedDevice(name);
      if (name) {
        setConnState("connected");
      } else {
        setConnState("disconnected");
      }
    });

    EventsOn("connection-state", (state: string) => {
      setConnState(state);
    });

    EventsOn("slide-change", (index: number) => {
      setCurrentSlide(index);
    });

    EventsOn("laser-move", (pos: { x: number; y: number }) => {
      setLaserPos(pos);
    });

    EventsOn("laser-hide", () => {
      setLaserPos(null);
    });

    return () => {
      EventsOff("connection-request");
      EventsOff("paired-device");
      EventsOff("connection-state");
      EventsOff("slide-change");
      EventsOff("laser-move");
      EventsOff("laser-hide");
    };
  }, []);

  const startPresenting = async (p: Presentation) => {
    try {
      const session = await StartPresentationSession(p.id);
      setActivePrez(p);
      setActiveSession(session);
      setCurrentSlide(1);
      setPairedDevice("");
      setConnState("disconnected");
      setLaserPos(null);
    } catch (err: any) {
      console.error(err);
      alert("Failed to start presentation: " + (err.message || err));
    }
  };

  const endPresenting = () => {
    EndPresentationSession();
    setActiveSession(null);
    setActivePrez(null);
    loadLibrary();
  };

  if (activeSession && activePrez) {
    return (
      <PresentationScreen
        activeSession={activeSession}
        activePrez={activePrez}
        currentSlide={currentSlide}
        setCurrentSlide={setCurrentSlide}
        connState={connState}
        pairedDevice={pairedDevice}
        pendingRequest={pendingRequest}
        setPendingRequest={setPendingRequest}
        laserPos={laserPos}
        theme={theme}
        toggleTheme={toggleTheme}
        onEndPresentation={endPresenting}
      />
    );
  }

  return (
    <DashboardScreen
      library={library}
      theme={theme}
      toggleTheme={toggleTheme}
      onRefresh={loadLibrary}
      onPresent={startPresenting}
      onLock={() => {}}
    />
  );
}
