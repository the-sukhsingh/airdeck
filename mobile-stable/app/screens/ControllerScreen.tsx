import React, { useState, useEffect } from "react";
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
  slideImage: string;
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
  slideImage,
  theme,
  toggleTheme,
  onDisconnect,
  sendEncryptedCommand,
}: ControllerScreenProps) {
  const [activeTab, setActiveTab] = useState<"control" | "slides" | "laser">(
    "control"
  );

  useEffect(() => {
    sendEncryptedCommand({ action: "set-active-tab", tab: activeTab });
  }, [activeTab]);

  const handleNext = () => sendEncryptedCommand({ action: "next" });
  const handlePrev = () => sendEncryptedCommand({ action: "prev" });
  const handleGotoSlide = (index: number) =>
    sendEncryptedCommand({ action: "goto", index });
  const handleToggleFullscreen = () => sendEncryptedCommand({ action: "fullscreen" });

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

      {/* Styled Seamless Header details */}
      <View
        className="flex-row items-center justify-between px-6 pt-6 pb-4"
      >
        <View className="flex-1 mr-4">
          <Text
            style={{ color: textPrimary }}
            className="text-base font-bold tracking-tight"
            numberOfLines={1}
          >
            {prezName}
          </Text>
          <Text
            style={{ color: textSecondary }}
            className="text-[9px] font-bold tracking-[1.5px] mt-1.5 uppercase"
          >
            SLIDE {currentSlide} OF {totalSlides}
          </Text>
        </View>

        <View className="flex-row items-center gap-2.5">
          {/* Fullscreen Toggle */}
          <TouchableOpacity 
            onPress={handleToggleFullscreen} 
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 18, 
              backgroundColor: isLight ? "#f1f1f4" : "#1c1c1f",
              alignItems: "center",
              justifyContent: "center"
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="expand-outline"
              size={16}
              color={isLight ? "#18181b" : "#f4f4f5"}
            />
          </TouchableOpacity>
          {/* Theme Toggle */}
          <TouchableOpacity 
            onPress={toggleTheme}
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 18, 
              backgroundColor: isLight ? "#f1f1f4" : "#1c1c1f",
              alignItems: "center",
              justifyContent: "center"
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLight ? "moon-outline" : "sunny-outline"}
              size={16}
              color={isLight ? "#18181b" : "#f4f4f5"}
            />
          </TouchableOpacity>
          {/* Disconnect Icon */}
          <TouchableOpacity 
            onPress={onDisconnect}
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 18, 
              backgroundColor: isLight ? "#fef2f2" : "#450a0a",
              alignItems: "center",
              justifyContent: "center"
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main tab screen selection */}
      <View className="flex-1 py-4">
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
          <LaserTab theme={theme} sendEncryptedCommand={sendEncryptedCommand} slideImage={slideImage} />
        )}
      </View>

      {/* Floating Pill Bottom Tabs */}
      <View className="px-6 pb-6 pt-2">
        <View
          style={{
            backgroundColor: isLight ? "#f1f1f4" : "#1c1c1f",
            borderColor: borderCol,
          }}
          className="flex-row rounded-full p-1.5 border justify-around items-center"
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: activeTab === "control" ? (isLight ? "#ffffff" : "#2d2d30") : "transparent",
              paddingVertical: 10,
              borderRadius: 9999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            onPress={() => setActiveTab("control")}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={16}
              color={
                activeTab === "control"
                  ? textPrimary
                  : textSecondary
              }
            />
            {activeTab === "control" && (
              <Text
                style={{
                  color: textPrimary,
                }}
                className="text-[10px] font-bold tracking-wider"
              >
                CONTROL
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: activeTab === "slides" ? (isLight ? "#ffffff" : "#2d2d30") : "transparent",
              paddingVertical: 10,
              borderRadius: 9999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            onPress={() => setActiveTab("slides")}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={
                activeTab === "slides"
                  ? textPrimary
                  : textSecondary
              }
            />
            {activeTab === "slides" && (
              <Text
                style={{
                  color: textPrimary,
                }}
                className="text-[10px] font-bold tracking-wider"
              >
                SLIDES
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: activeTab === "laser" ? (isLight ? "#ffffff" : "#2d2d30") : "transparent",
              paddingVertical: 10,
              borderRadius: 9999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            onPress={() => setActiveTab("laser")}
          >
            <Ionicons
              name="aperture-outline"
              size={16}
              color={
                activeTab === "laser"
                  ? textPrimary
                  : textSecondary
              }
            />
            {activeTab === "laser" && (
              <Text
                style={{
                  color: textPrimary,
                }}
                className="text-[10px] font-bold tracking-wider"
              >
                LASER
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
