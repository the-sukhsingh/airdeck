import React from "react";
import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { SlideInfo } from "../../src/services/connection";

interface SlidesTabProps {
  toc: SlideInfo[];
  currentSlide: number;
  onGotoSlide: (index: number) => void;
}

export default function SlidesTab({
  toc,
  currentSlide,
  onGotoSlide,
}: SlidesTabProps) {
  return (
    <View className="flex-1 px-4">
      <Text className="text-lg font-bold text-white mb-2">Table of Contents</Text>
      {toc.length === 0 ? (
        <View className="flex-1 border border-[#262626] border-dashed items-center justify-center p-6">
          <Text className="text-[#525252] text-xs">
            No slides list details sync'd from desktop.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 w-full">
          <View className="flex-row flex-wrap gap-3 py-3">
            {toc.map((item) => {
              const isActive = currentSlide === item.index;
              return (
                <TouchableOpacity
                  key={item.index}
                  className={`w-[48%] h-[100px] border p-3 justify-between rounded-xl  ${
                    isActive ? "bg-white border-black" : "border-white"
                  }`}
                  onPress={() => onGotoSlide(item.index)}
                >
                  <Text
                    className={`text-lg font-extrabold ${
                      isActive ? "text-black" : "text-[#525252]"
                    }`}
                  >
                    {item.index}
                  </Text>
                  <Text
                    className={`text-[11px] font-bold `}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
