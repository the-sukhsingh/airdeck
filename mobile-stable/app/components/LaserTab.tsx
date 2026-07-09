import React, { useRef, useState } from "react";
import {
  Text,
  View,
  PanResponder,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LaserTabProps {
  theme: "light" | "dark";
  sendEncryptedCommand: (cmd: any) => Promise<void>;
  slideImage: string;
  currentSlide: number;
  totalSlides: number;
}

type ToolType = "laser" | "pen" | "highlighter" | "eraser";

export default function LaserTab({
  theme,
  sendEncryptedCommand,
  slideImage,
  currentSlide,
  totalSlides,
}: LaserTabProps) {
  const touchpadRef = useRef<View>(null);
  const [touchpadLayout, setTouchpadLayout] = useState({ width: 1, height: 1 });
  const [activeTool, setActiveTool] = useState<ToolType>("laser");
  const [penColor, setPenColor] = useState<string>("red");
  const [localPointer, setLocalPointer] = useState<{ x: number; y: number } | null>(null);

  const isLight = theme === "light";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";
  const activeBg = isLight ? "#e4e4e7" : "#27272a";

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setTouchpadLayout({ width: width || 1, height: height || 1 });
  };

  const getNormalisedCoords = (x: number, y: number) => {
    let nx = x / touchpadLayout.width;
    let ny = y / touchpadLayout.height;

    if (nx < 0) nx = 0;
    if (nx > 1) nx = 1;
    if (ny < 0) ny = 0;
    if (ny > 1) ny = 1;

    return { x: nx, y: ny };
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setLocalPointer({ x: locationX, y: locationY });
      const { x, y } = getNormalisedCoords(locationX, locationY);

      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser", x, y });
      } else if (activeTool === "pen") {
        sendEncryptedCommand({ action: "draw-start", tool: "pen", color: penColor, x, y });
      } else if (activeTool === "highlighter") {
        sendEncryptedCommand({ action: "draw-start", tool: "highlighter", color: "yellow", x, y });
      } else if (activeTool === "eraser") {
        sendEncryptedCommand({ action: "draw-start", tool: "eraser", x, y });
      }
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setLocalPointer({ x: locationX, y: locationY });
      const { x, y } = getNormalisedCoords(locationX, locationY);

      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser", x, y });
      } else {
        sendEncryptedCommand({ action: "draw-move", x, y });
      }
    },
    onPanResponderRelease: () => {
      setLocalPointer(null);
      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser-off" });
      } else {
        sendEncryptedCommand({ action: "draw-end" });
      }
    },
    onPanResponderTerminate: () => {
      setLocalPointer(null);
      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser-off" });
      } else {
        sendEncryptedCommand({ action: "draw-end" });
      }
    },
  });

  const handleClearDrawings = () => {
    sendEncryptedCommand({ action: "draw-clear" });
  };

  return (
    <View className="flex-1 gap-3 px-4">
      <View className="flex-row justify-between items-center mb-1">
        <View>
          <Text
            style={{ color: textPrimary }}
            className="text-lg font-bold tracking-tight"
          >
            Interactive Laser & Pen
          </Text>
          <Text style={{ color: textSecondary }} className="text-[10px] leading-4">
            Drag on the touchpad to highlight, write, or point.
          </Text>
        </View>

        {/* Clear Button */}
        <TouchableOpacity
          onPress={handleClearDrawings}
          style={{
            borderColor: borderCol,
            backgroundColor: bgCard,
          }}
          className="flex-row items-center gap-1.5 px-3 py-1.5 border rounded-full active:opacity-70"
        >
          <Ionicons name="trash-outline" size={13} color="#ef4444" />
          <Text className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar / Tool Selector */}
      <View
        style={{ borderColor: borderCol, backgroundColor: bgCard }}
        className="flex-row p-1.5 border rounded-2xl justify-between items-center"
      >
        <TouchableOpacity
          onPress={() => setActiveTool("laser")}
          style={{
            flex: 1,
            backgroundColor: activeTool === "laser" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1.5"
        >
          <Ionicons
            name="aperture-outline"
            size={15}
            color={activeTool === "laser" ? textPrimary : textSecondary}
          />
          <Text
            style={{ color: activeTool === "laser" ? textPrimary : textSecondary }}
            className="text-[10px] font-bold tracking-wider uppercase"
          >
            Laser
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("pen")}
          style={{
            flex: 1,
            backgroundColor: activeTool === "pen" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1.5"
        >
          <Ionicons
            name="pencil-outline"
            size={15}
            color={activeTool === "pen" ? textPrimary : textSecondary}
          />
          <Text
            style={{ color: activeTool === "pen" ? textPrimary : textSecondary }}
            className="text-[10px] font-bold tracking-wider uppercase"
          >
            Pen
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("highlighter")}
          style={{
            flex: 1,
            backgroundColor: activeTool === "highlighter" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1.5"
        >
          <Ionicons
            name="brush-outline"
            size={15}
            color={activeTool === "highlighter" ? textPrimary : textSecondary}
          />
          <Text
            style={{ color: activeTool === "highlighter" ? textPrimary : textSecondary }}
            className="text-[10px] font-bold tracking-wider uppercase"
          >
            Highlight
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("eraser")}
          style={{
            flex: 1,
            backgroundColor: activeTool === "eraser" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1.5"
        >
          <Ionicons
            name="close-circle-outline"
            size={15}
            color={activeTool === "eraser" ? textPrimary : textSecondary}
          />
          <Text
            style={{ color: activeTool === "eraser" ? textPrimary : textSecondary }}
            className="text-[10px] font-bold tracking-wider uppercase"
          >
            Eraser
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pen Color Selector sub-row */}
      {activeTool === "pen" && (
        <View className="flex-row justify-center items-center gap-4 py-1">
          <Text style={{ color: textSecondary }} className="text-[10px] font-bold uppercase tracking-wider">
            Pen Color:
          </Text>
          <View className="flex-row gap-3">
            {["red", "blue", "green"].map((col) => (
              <TouchableOpacity
                key={col}
                onPress={() => setPenColor(col)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: col === "red" ? "#ef4444" : col === "blue" ? "#3b82f6" : "#22c55e",
                  borderWidth: penColor === col ? 3 : 0,
                  borderColor: isLight ? "#0f0f11" : "#f4f4f5",
                }}
                activeOpacity={0.8}
              />
            ))}
          </View>
        </View>
      )}

      {/* Touchpad Area - Exact 16:9 ratio */}
      <View
        ref={touchpadRef}
        onLayout={handleLayout}
        style={{ borderColor: borderCol, backgroundColor: bgCard, width: "100%", aspectRatio: 16 / 9 }}
        className="border items-center justify-center rounded-2xl overflow-hidden relative"
        {...panResponder.panHandlers}
      >
        {slideImage ? (
          <View pointerEvents="none" style={{ width: "100%", height: "100%", position: "absolute" }}>
            <Image
              source={{ uri: slideImage.startsWith("data:") ? slideImage : `data:image/jpeg;base64,${slideImage}` }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View pointerEvents="none" className="items-center justify-center gap-3">
            <View
              style={{ backgroundColor: isLight ? "#f4f4f5" : "#222226" }}
              className="w-14 h-14 rounded-full items-center justify-center"
            >
              <Ionicons
                name="finger-print-outline"
                size={28}
                color={textSecondary}
              />
            </View>
            <Text
              style={{ color: textSecondary }}
              className="text-[9px] font-bold tracking-wider uppercase text-center"
            >
              Drag here to control {activeTool}
            </Text>
          </View>
        )}

        {/* Local Pointer Circle Indicator */}
        {localPointer && (
          <View
            style={{
              position: "absolute",
              left: localPointer.x,
              top: localPointer.y,
              width: activeTool === "eraser" ? 28 : 14,
              height: activeTool === "eraser" ? 28 : 14,
              borderRadius: activeTool === "eraser" ? 14 : 7,
              backgroundColor: activeTool === "eraser" ? "rgba(239, 68, 68, 0.4)" : activeTool === "highlighter" ? "rgba(254, 240, 138, 0.6)" : activeTool === "pen" ? (penColor === "red" ? "#ef4444" : penColor === "blue" ? "#3b82f6" : penColor === "green" ? "#22c55e" : "#000") : "red",
              borderWidth: 1.5,
              borderColor: "#ffffff",
              transform: [
                { translateX: activeTool === "eraser" ? -14 : -7 },
                { translateY: activeTool === "eraser" ? -14 : -7 }
              ],
              pointerEvents: "none",
            }}
          />
        )}
      </View>

      {/* Laser Slide Navigation Controls */}
      <View className="flex-row h-[48px] gap-4 mb-1">
        <TouchableOpacity
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className={`flex-1 border items-center justify-center rounded-2xl ${
            currentSlide === 1 ? "opacity-30" : ""
          }`}
          onPress={() => sendEncryptedCommand({ action: "prev" })}
          disabled={currentSlide === 1}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className={`flex-1 border items-center justify-center rounded-2xl ${
            currentSlide === totalSlides ? "opacity-30" : ""
          }`}
          onPress={() => sendEncryptedCommand({ action: "next" })}
          disabled={currentSlide === totalSlides}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
