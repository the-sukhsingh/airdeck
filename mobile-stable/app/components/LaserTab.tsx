import React, { useRef } from "react";
import {
  Text,
  View,
  PanResponder,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LaserTabProps {
  sendEncryptedCommand: (cmd: any) => Promise<void>;
}

export default function LaserTab({ sendEncryptedCommand }: LaserTabProps) {
  const touchpadRef = useRef<View>(null);
  const touchpadWidth = Dimensions.get("window").width - 48; // padding margins
  const touchpadHeight = 320;

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
      <Text className="text-lg font-bold text-white mb-2">Virtual Laser touchpad</Text>
      <Text className="text-[10px] text-[#525252] mt-1">
        Drag your finger inside the canvas to control the red pointer on the laptop screen.
      </Text>

      {/* Touchpad Area */}
      <View
        ref={touchpadRef}
        className="w-full h-[320px] border border-[#262626] items-center justify-center gap-3"
        {...panResponder.panHandlers}
      >
        <Ionicons name="finger-print-outline" size={48} color="#525252" />
        <Text className="text-[10px] font-bold text-[#525252]">DRAG HERE TO CONTROL POINTER</Text>
      </View>
    </View>
  );
}
