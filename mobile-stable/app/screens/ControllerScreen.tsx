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
  onDisconnect: () => void;
  sendEncryptedCommand: (cmd: any) => Promise<void>;
}

export default function ControllerScreen({
  prezName,
  currentSlide,
  totalSlides,
  notes,
  toc,
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

  return (
    <SafeAreaView style={{ flex: 1 }} className="" >
      <StatusBar style="auto" />

      {/* Top Header details */}
      <View className="h-16 border-b border-[#262626] flex-row items-center justify-between px-6 ">
        <View>
          <Text className="text-sm font-bold " numberOfLines={1}>
            {prezName}
          </Text>
          <Text className="text-[10px] font-bold text-[#a3a3a3] font-mono mt-0.5">
            SLIDE {currentSlide} OF {totalSlides}
          </Text>
        </View>
        <TouchableOpacity className="p-1 rounded-full" onPress={onDisconnect}>
          <Ionicons name="close-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Main tab screen selection */}
      <View className="flex-1 py-6">
        {activeTab === "control" && (
          <ControlTab
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            notes={notes}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}

        {activeTab === "slides" && (
          <SlidesTab
            toc={toc}
            currentSlide={currentSlide}
            onGotoSlide={handleGotoSlide}
          />
        )}

        {activeTab === "laser" && (
          <LaserTab sendEncryptedCommand={sendEncryptedCommand} />
        )}
      </View>

      {/* Flat Bottom Tabs */}
      <View className="h-16 border-t border-[#262626] flex-row ">
        <TouchableOpacity
          className={`flex-1 items-center justify-center gap-1 ${
            activeTab === "control" ? "bg-[#1c1c1c]" : ""
          }`}
          onPress={() => setActiveTab("control")}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={20}
            color={activeTab === "control" ? "#ffffff" : "#a3a3a3"}
          />
          <Text
            className={`text-[9px] font-bold tracking-wider ${
              activeTab === "control" ? "text-white" : "text-[#a3a3a3]"
            }`}
          >
            CONTROL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 items-center justify-center gap-1 ${
            activeTab === "slides" ? "bg-[#1c1c1c]" : ""
          }`}
          onPress={() => setActiveTab("slides")}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={activeTab === "slides" ? "#ffffff" : "#a3a3a3"}
          />
          <Text
            className={`text-[9px] font-bold tracking-wider ${
              activeTab === "slides" ? "text-white" : "text-[#a3a3a3]"
            }`}
          >
            SLIDES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 items-center justify-center gap-1 ${
            activeTab === "laser" ? "bg-[#1c1c1c]" : ""
          }`}
          onPress={() => setActiveTab("laser")}
        >
          <Ionicons
            name="aperture-outline"
            size={20}
            color={activeTab === "laser" ? "#ffffff" : "#a3a3a3"}
          />
          <Text
            className={`text-[9px] font-bold tracking-wider ${
              activeTab === "laser" ? "text-white" : "text-[#a3a3a3]"
            }`}
          >
            LASER
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
