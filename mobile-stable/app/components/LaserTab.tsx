import React, { useRef } from "react";
import {
  Text,
  View,
  PanResponder,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LaserTabProps {
  theme: "light" | "dark";
  sendEncryptedCommand: (cmd: any) => Promise<void>;
}

export default function LaserTab({ theme, sendEncryptedCommand }: LaserTabProps) {
  const touchpadRef = useRef<View>(null);
  const touchpadWidth = Dimensions.get("window").width - 48; // padding margins
  const touchpadHeight = 320;

  const isLight = theme === "light";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";

  const sendLaserCoords = (x: number, y: number) => {
    // Normalise coordinates between 0.0 and 1.0
    let nx = x / touchpadWidth;
    let ny = y / touchpadHeight;

    // Boundaries check
    if (nx < 0) nx = 0;
    if (nx > 1) nx = 1;
    if (ny < 0) ny = 0;
    if (ny > 1) ny = 1;

    sendEncryptedCommand({ action: "laser", x: nx, y: ny });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // Calculate start coordinate relative to touchpad
      sendLaserCoords(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    },
    onPanResponderMove: (evt) => {
      // Track dragging coordinates
      sendLaserCoords(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    },
    onPanResponderRelease: () => {
      // Turn laser off
      sendEncryptedCommand({ action: "laser-off" });
    },
    onPanResponderTerminate: () => {
      sendEncryptedCommand({ action: "laser-off" });
    },
  });

  return (
    <View className="flex-1 gap-3 px-4">
      <Text
        style={{ color: textPrimary }}
        className="text-lg font-semibold mb-1 tracking-tight"
      >
        Virtual Laser touchpad
      </Text>
      <Text style={{ color: textSecondary }} className="text-[10px] mb-2">
        Drag your finger inside the canvas to control the red pointer on the laptop screen.
      </Text>

      {/* Touchpad Area */}
      <View
        ref={touchpadRef}
        style={{ borderColor: borderCol, backgroundColor: bgCard }}
        className="w-full h-[320px] border items-center justify-center gap-3 rounded-lg"
        {...panResponder.panHandlers}
      >
        <Ionicons
          name="finger-print-outline"
          size={48}
          color={isLight ? "#a1a1aa" : "#52525b"}
        />
        <Text
          style={{ color: textSecondary }}
          className="text-[10px] font-semibold"
        >
          DRAG HERE TO CONTROL POINTER
        </Text>
      </View>
    </View>
  );
}
