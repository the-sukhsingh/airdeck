import React from "react";
import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { SlideInfo } from "../../src/services/connection";

interface SlidesTabProps {
  toc: SlideInfo[];
  currentSlide: number;
  theme: "light" | "dark";
  onGotoSlide: (index: number) => void;
}

export default function SlidesTab({
  toc,
  currentSlide,
  theme,
  onGotoSlide,
}: SlidesTabProps) {
  const isLight = theme === "light";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";

  return (
    <View className="flex-1 px-4">
      <Text
        style={{ color: textPrimary }}
        className="text-lg font-semibold mb-2 tracking-tight"
      >
        Table of Contents
      </Text>

      {toc.length === 0 ? (
        <View
          style={{ borderColor: borderCol, backgroundColor: bgCard }}
          className="flex-1 border border-dashed items-center justify-center p-6 rounded-lg"
        >
          <Text style={{ color: textSecondary }} className="text-xs">
            No slides list details sync&apos;d from desktop.
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
                  style={{
                    backgroundColor: isActive
                      ? isLight
                        ? "#18181b"
                        : "#f4f4f5"
                      : bgCard,
                    borderColor: isActive
                      ? isLight
                        ? "#18181b"
                        : "#f4f4f5"
                      : borderCol,
                  }}
                  className="w-[48%] h-[100px] border p-3 justify-between rounded-lg"
                  onPress={() => onGotoSlide(item.index)}
                >
                  <Text
                    style={{
                      color: isActive
                        ? isLight
                          ? "#ffffff"
                          : "#0f0f11"
                        : textSecondary,
                    }}
                    className="text-lg font-bold"
                  >
                    {item.index}
                  </Text>
                  <Text
                    style={{
                      color: isActive
                        ? isLight
                          ? "#e4e4e7"
                          : "#27272a"
                        : textPrimary,
                    }}
                    className="text-[11px] font-semibold"
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
