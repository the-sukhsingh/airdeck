import React from "react";
import { Text, View, ScrollView, TouchableOpacity, PanResponder } from "react-native";
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

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Detect horizontal swipe if dx is greater than 20 and dominant over dy
        return Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx } = gestureState;
        if (dx > 50) {
          // Swipe right to go to previous slide
          if (!isFirstSlide) {
            onPrev();
          }
        } else if (dx < -50) {
          // Swipe left to go to next slide
          if (!isLastSlide) {
            onNext();
          }
        }
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  return (
    <View className="flex-1 gap-6 px-4" {...panResponder.panHandlers}>
      {/* Speaker Notes */}
      <View className="flex-1 gap-2">
        <Text
          style={{ color: textSecondary }}
          className="text-[9px] font-bold uppercase tracking-wider mb-1"
        >
          SPEAKER NOTES
        </Text>
        <ScrollView
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className="flex-1 border rounded-2xl"
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <Text style={{ color: textPrimary }} className="text-sm leading-[22px] p-5">
            {notes}
          </Text>
        </ScrollView>
      </View>

      {/* Swipe area/Controls */}
      <View className="flex-row h-[60px] gap-4 mb-2">
        <TouchableOpacity
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className={`flex-1 border items-center justify-center rounded-2xl ${
            isFirstSlide ? "opacity-30" : ""
          }`}
          onPress={onPrev}
          disabled={isFirstSlide}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className={`flex-1 border flex-row items-center justify-center rounded-2xl ${
            isLastSlide ? "opacity-30" : ""
          }`}
          onPress={onNext}
          disabled={isLastSlide}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
