import React from "react";
import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ControlTabProps {
  currentSlide: number;
  totalSlides: number;
  notes: string;
  onPrev: () => void;
  onNext: () => void;
}

export default function ControlTab({
  currentSlide,
  totalSlides,
  notes,
  onPrev,
  onNext,
}: ControlTabProps) {
  const isFirstSlide = currentSlide === 1;
  const isLastSlide = currentSlide === totalSlides;

  return (
    <View className="flex-1 gap-6 px-4">
     
      {/* Speaker Notes */}
      <View className="flex-1 gap-2">
        <Text className="text-[14px] font-bold text-[#525252] uppercase tracking-wider">
          SPEAKER NOTES
        </Text>
        <ScrollView
          className="flex-1 border border-[#262626] rounded-2xl p-4"
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <Text className="text-sm text-[#a3a3a3] leading-[22px]">{notes}</Text>
        </ScrollView>
      </View>

       {/* Swipe area/Controls */}
      <View className="flex-row h-[60px] gap-4">
        <TouchableOpacity
          className={`flex-1 border items-center justify-center rounded-full gap-1 ${
            isFirstSlide
              && "opacity-40"
          }`}
          onPress={onPrev}
          disabled={isFirstSlide}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={"#000000"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 border flex-row items-center justify-center rounded-full gap-1 ${
            isLastSlide
              && "opacity-40"
          }`}
          onPress={onNext}
          disabled={isLastSlide}
        >
          <Ionicons
            name="chevron-forward"
            size={28}
            color={"#000000"}
          />
        </TouchableOpacity>
      </View>

    </View>
  );
}
