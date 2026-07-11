import React, { useRef, useState, useEffect } from "react";
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

type ToolType = "laser" | "pen" | "highlighter" | "eraser" | "zoom";

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

  // Zoom states
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [zoomCenterX, setZoomCenterX] = useState<number>(0.5);
  const [zoomCenterY, setZoomCenterY] = useState<number>(0.5);

  // Reset zoom on slide change
  useEffect(() => {
    setZoomScale(1.0);
    setZoomCenterX(0.5);
    setZoomCenterY(0.5);
    sendEncryptedCommand({ action: "zoom", scale: 1.0, x: 0.5, y: 0.5 }).catch(() => {});
  }, [currentSlide]);

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
      } else if (activeTool === "zoom") {
        const halfW = 1 / (2 * zoomScale);
        const halfH = 1 / (2 * zoomScale);
        const cx = Math.max(halfW, Math.min(1 - halfW, x));
        const cy = Math.max(halfH, Math.min(1 - halfH, y));
        setZoomCenterX(cx);
        setZoomCenterY(cy);
        sendEncryptedCommand({ action: "zoom", scale: zoomScale, x: cx, y: cy }).catch(() => {});
      }
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setLocalPointer({ x: locationX, y: locationY });
      const { x, y } = getNormalisedCoords(locationX, locationY);

      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser", x, y });
      } else if (activeTool === "zoom") {
        const halfW = 1 / (2 * zoomScale);
        const halfH = 1 / (2 * zoomScale);
        const cx = Math.max(halfW, Math.min(1 - halfW, x));
        const cy = Math.max(halfH, Math.min(1 - halfH, y));
        setZoomCenterX(cx);
        setZoomCenterY(cy);
        sendEncryptedCommand({ action: "zoom", scale: zoomScale, x: cx, y: cy }).catch(() => {});
      } else {
        sendEncryptedCommand({ action: "draw-move", x, y });
      }
    },
    onPanResponderRelease: () => {
      setLocalPointer(null);
      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser-off" });
      } else if (activeTool === "zoom") {
        // No end action needed for zoom
      } else {
        sendEncryptedCommand({ action: "draw-end" });
      }
    },
    onPanResponderTerminate: () => {
      setLocalPointer(null);
      if (activeTool === "laser") {
        sendEncryptedCommand({ action: "laser-off" });
      } else if (activeTool === "zoom") {
        // No end action needed for zoom
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
            flex: activeTool === "laser" ? 1.5 : 1,
            backgroundColor: activeTool === "laser" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1"
        >
          <Ionicons
            name="aperture-outline"
            size={15}
            color={activeTool === "laser" ? textPrimary : textSecondary}
          />
          {activeTool === "laser" && (
            <Text
              style={{ color: textPrimary }}
              className="text-[9px] font-bold tracking-wider uppercase"
            >
              Laser
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("pen")}
          style={{
            flex: activeTool === "pen" ? 1.5 : 1,
            backgroundColor: activeTool === "pen" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1"
        >
          <Ionicons
            name="pencil-outline"
            size={15}
            color={activeTool === "pen" ? textPrimary : textSecondary}
          />
          {activeTool === "pen" && (
            <Text
              style={{ color: textPrimary }}
              className="text-[9px] font-bold tracking-wider uppercase"
            >
              Pen
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("highlighter")}
          style={{
            flex: activeTool === "highlighter" ? 1.5 : 1,
            backgroundColor: activeTool === "highlighter" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1"
        >
          <Ionicons
            name="brush-outline"
            size={15}
            color={activeTool === "highlighter" ? textPrimary : textSecondary}
          />
          {activeTool === "highlighter" && (
            <Text
              style={{ color: textPrimary }}
              className="text-[9px] font-bold tracking-wider uppercase"
            >
              Highlight
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("eraser")}
          style={{
            flex: activeTool === "eraser" ? 1.5 : 1,
            backgroundColor: activeTool === "eraser" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1"
        >
          <Ionicons
            name="close-circle-outline"
            size={15}
            color={activeTool === "eraser" ? textPrimary : textSecondary}
          />
          {activeTool === "eraser" && (
            <Text
              style={{ color: textPrimary }}
              className="text-[9px] font-bold tracking-wider uppercase"
            >
              Eraser
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTool("zoom")}
          style={{
            flex: activeTool === "zoom" ? 1.5 : 1,
            backgroundColor: activeTool === "zoom" ? activeBg : "transparent",
            borderRadius: 12,
          }}
          className="py-2.5 items-center justify-center flex-row gap-1"
        >
          <Ionicons
            name="search-outline"
            size={15}
            color={activeTool === "zoom" ? textPrimary : textSecondary}
          />
          {activeTool === "zoom" && (
            <Text
              style={{ color: textPrimary }}
              className="text-[9px] font-bold tracking-wider uppercase"
            >
              Zoom
            </Text>
          )}
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

      {/* Zoom Scale Selector sub-row */}
      {activeTool === "zoom" && (
        <View className="flex-row justify-between items-center px-2 py-1">
          <Text style={{ color: textSecondary }} className="text-[9px] font-bold uppercase tracking-wider">
            Zoom Scale
          </Text>
          <View
            style={{
              backgroundColor: isLight ? "#e4e4e7" : "#27272a",
              borderColor: borderCol,
            }}
            className="flex-row rounded-full p-1 border items-center"
          >
            {[1.0, 1.5, 2.0, 3.0, 4.0].map((scale) => (
              <TouchableOpacity
                key={scale}
                onPress={() => {
                  setZoomScale(scale);
                  if (scale === 1.0) {
                    setZoomCenterX(0.5);
                    setZoomCenterY(0.5);
                    sendEncryptedCommand({ action: "zoom", scale: 1.0, x: 0.5, y: 0.5 });
                  } else {
                    const halfW = 1 / (2 * scale);
                    const halfH = 1 / (2 * scale);
                    const cx = Math.max(halfW, Math.min(1 - halfW, zoomCenterX));
                    const cy = Math.max(halfH, Math.min(1 - halfH, zoomCenterY));
                    setZoomCenterX(cx);
                    setZoomCenterY(cy);
                    sendEncryptedCommand({ action: "zoom", scale: scale, x: cx, y: cy });
                  }
                }}
                style={{
                  backgroundColor: zoomScale === scale ? (isLight ? "#ffffff" : "#0f0f11") : "transparent",
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 9999,
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: zoomScale === scale ? textPrimary : textSecondary,
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                >
                  {scale.toFixed(1)}x
                </Text>
              </TouchableOpacity>
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
          <View
            pointerEvents="none"
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: slideImage.startsWith("data:") ? slideImage : `data:image/jpeg;base64,${slideImage}` }}
              style={{
                width: "100%",
                height: "100%",
                transform: activeTool === "zoom" ? [] : [
                  { translateX: (0.5 - zoomCenterX) * touchpadLayout.width * (zoomScale - 1) },
                  { translateY: (0.5 - zoomCenterY) * touchpadLayout.height * (zoomScale - 1) },
                  { scale: zoomScale },
                ],
              }}
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

        {/* Primary Viewport Selector Box (only shown in Zoom mode when zoomScale > 1.0) */}
        {slideImage && activeTool === "zoom" && zoomScale > 1.0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: `${Math.max(0, Math.min(100 - (100 / zoomScale), (zoomCenterX - 1 / (2 * zoomScale)) * 100))}%`,
              top: `${Math.max(0, Math.min(100 - (100 / zoomScale), (zoomCenterY - 1 / (2 * zoomScale)) * 100))}%`,
              width: `${100 / zoomScale}%`,
              height: `${100 / zoomScale}%`,
              borderWidth: 2,
              borderColor: "#f97316", // Orange box border
              backgroundColor: "rgba(249, 115, 22, 0.15)", // subtle orange tint
              borderRadius: 4,
            }}
          />
        )}

        {/* Zoom Minimap Indicator (only shown in drawing/laser modes when zoomScale > 1.0) */}
        {slideImage && activeTool !== "zoom" && zoomScale > 1.0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 80,
              aspectRatio: 16 / 9,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: isLight ? "#d4d4d8" : "#3f3f46",
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              overflow: "hidden",
              zIndex: 99,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            {/* Slide Miniature */}
            <Image
              source={{ uri: slideImage.startsWith("data:") ? slideImage : `data:image/jpeg;base64,${slideImage}` }}
              style={{ width: "100%", height: "100%", opacity: 0.65 }}
              resizeMode="contain"
            />
            {/* Viewport Box representing the zoomed area */}
            <View
              style={{
                position: "absolute",
                left: `${Math.max(0, Math.min(100 - (100 / zoomScale), (zoomCenterX - 1 / (2 * zoomScale)) * 100))}%`,
                top: `${Math.max(0, Math.min(100 - (100 / zoomScale), (zoomCenterY - 1 / (2 * zoomScale)) * 100))}%`,
                width: `${100 / zoomScale}%`,
                height: `${100 / zoomScale}%`,
                borderWidth: 1.5,
                borderColor: "#f97316", // Premium high-visibility orange
                backgroundColor: "rgba(249, 115, 22, 0.05)",
              }}
            />
          </View>
        )}

        {/* Local Pointer Circle Indicator */}
        {localPointer && activeTool !== "zoom" && (
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
