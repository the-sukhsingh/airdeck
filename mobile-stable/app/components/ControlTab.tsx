import React from "react";
import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ControlTabProps {
  currentSlide: number;
  totalSlides: number;
  notes: string;
  theme: "light" | "dark";
  onPrev: () => void;
  onNext: () => void;
}

export default function ControlTab({
  currentSlide,
  totalSlides,
  notes,
  theme,
  onPrev,
  onNext,
}: ControlTabProps) {
  const isFirstSlide = currentSlide === 1;
  const isLastSlide = currentSlide === totalSlides;

  const isLight = theme === "light";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";

  return (
    <View className="flex-1 gap-6 px-4">
      {/* Speaker Notes */}
      <View className="flex-1 gap-2">
        <Text
          style={{ color: textSecondary }}
          className="text-[11px] font-bold uppercase tracking-wider"
        >
          SPEAKER NOTES
        </Text>
        <ScrollView
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className="flex-1 border rounded-lg p-4"
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <Text style={{ color: textPrimary }} className="text-sm leading-[22px] p-4 rounded-xl">
            {notes}
          </Text>
        </ScrollView>
      </View>

      {/* Swipe area/Controls */}
      <View className="flex-row h-[60px] gap-4 mb-2">
        <TouchableOpacity
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className={`flex-1 border items-center justify-center rounded-lg ${
            isFirstSlide ? "opacity-30" : ""
          }`}
          onPress={onPrev}
          disabled={isFirstSlide}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className={`flex-1 border flex-row items-center justify-center rounded-lg ${
            isLastSlide ? "opacity-30" : ""
          }`}
          onPress={onNext}
          disabled={isLastSlide}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
