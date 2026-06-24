import React, { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SlideInfo } from "../../src/services/connection";

import ControlTab from "../components/ControlTab";
import SlidesTab from "../components/SlidesTab";
import LaserTab from "../components/LaserTab";

interface ControllerScreenProps {
  prezName: string;
  currentSlide: number;
  totalSlides: number;
  notes: string;
  toc: SlideInfo[];
  theme: "light" | "dark";
  toggleTheme: () => void;
  onDisconnect: () => void;
  sendEncryptedCommand: (cmd: any) => Promise<void>;
}

export default function ControllerScreen({
  prezName,
  currentSlide,
  totalSlides,
  notes,
  toc,
  theme,
  toggleTheme,
  onDisconnect,
  sendEncryptedCommand,
}: ControllerScreenProps) {
  const [activeTab, setActiveTab] = useState<"control" | "slides" | "laser">(
    "control"
  );

  const handleNext = () => sendEncryptedCommand({ action: "next" });
  const handlePrev = () => sendEncryptedCommand({ action: "prev" });
  const handleGotoSlide = (index: number) =>
    sendEncryptedCommand({ action: "goto", index });

  const isLight = theme === "light";
  const bgMain = isLight ? "#fafafa" : "#0f0f11";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: bgMain }}
    >
      <StatusBar style={isLight ? "dark" : "light"} />

      {/* Top Header details */}
      <View
        style={{ borderBottomColor: borderCol, backgroundColor: bgCard }}
        className="h-16 border-b flex-row items-center justify-between px-6"
      >
        <View className="flex-1 mr-4">
          <Text
            style={{ color: textPrimary }}
            className="text-sm font-semibold"
            numberOfLines={1}
          >
            {prezName}
          </Text>
          <Text
            style={{ color: textSecondary }}
            className="text-[10px] font-bold font-mono mt-0.5"
          >
            SLIDE {currentSlide} OF {totalSlides}
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          {/* Theme Toggle */}
          <TouchableOpacity onPress={toggleTheme} className="p-1">
            <Ionicons
              name={isLight ? "moon-outline" : "sunny-outline"}
              size={18}
              color={isLight ? "#18181b" : "#f4f4f5"}
            />
          </TouchableOpacity>
          {/* Disconnect Icon */}
          <TouchableOpacity className="p-1" onPress={onDisconnect}>
            <Ionicons name="close-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main tab screen selection */}
      <View className="flex-1 py-6">
        {activeTab === "control" && (
          <ControlTab
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            notes={notes}
            theme={theme}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}

        {activeTab === "slides" && (
          <SlidesTab
            toc={toc}
            currentSlide={currentSlide}
            theme={theme}
            onGotoSlide={handleGotoSlide}
          />
        )}

        {activeTab === "laser" && (
          <LaserTab theme={theme} sendEncryptedCommand={sendEncryptedCommand} />
        )}
      </View>

      {/* Flat Bottom Tabs */}
      <View
        style={{ borderTopColor: borderCol, backgroundColor: bgCard }}
        className="h-16 border-t flex-row"
      >
        <TouchableOpacity
          className="flex-1 items-center justify-center gap-1"
          style={{
            backgroundColor:
              activeTab === "control" ? (isLight ? "#f4f4f5" : "#27272a") : "transparent",
          }}
          onPress={() => setActiveTab("control")}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={20}
            color={
              activeTab === "control"
                ? isLight
                  ? "#0f0f11"
                  : "#ffffff"
                : isLight
                ? "#71717a"
                : "#a1a1aa"
            }
          />
          <Text
            style={{
              color:
                activeTab === "control"
                  ? isLight
                    ? "#0f0f11"
                    : "#ffffff"
                  : isLight
                  ? "#71717a"
                  : "#a1a1aa",
            }}
            className="text-[9px] font-bold tracking-wider"
          >
            CONTROL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 items-center justify-center gap-1"
          style={{
            backgroundColor:
              activeTab === "slides" ? (isLight ? "#f4f4f5" : "#27272a") : "transparent",
          }}
          onPress={() => setActiveTab("slides")}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={
              activeTab === "slides"
                ? isLight
                  ? "#0f0f11"
                  : "#ffffff"
                : isLight
                ? "#71717a"
                : "#a1a1aa"
            }
          />
          <Text
            style={{
              color:
                activeTab === "slides"
                  ? isLight
                    ? "#0f0f11"
                    : "#ffffff"
                  : isLight
                  ? "#71717a"
                  : "#a1a1aa",
            }}
            className="text-[9px] font-bold tracking-wider"
          >
            SLIDES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 items-center justify-center gap-1"
          style={{
            backgroundColor:
              activeTab === "laser" ? (isLight ? "#f4f4f5" : "#27272a") : "transparent",
          }}
          onPress={() => setActiveTab("laser")}
        >
          <Ionicons
            name="aperture-outline"
            size={20}
            color={
              activeTab === "laser"
                ? isLight
                  ? "#0f0f11"
                  : "#ffffff"
                : isLight
                ? "#71717a"
                : "#a1a1aa"
            }
          />
          <Text
            style={{
              color:
                activeTab === "laser"
                  ? isLight
                    ? "#0f0f11"
                    : "#ffffff"
                  : isLight
                  ? "#71717a"
                  : "#a1a1aa",
            }}
            className="text-[9px] font-bold tracking-wider"
          >
            LASER
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
