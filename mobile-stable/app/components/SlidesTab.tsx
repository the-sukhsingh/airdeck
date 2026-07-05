import React from "react";
import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        className="text-lg font-bold mb-3 tracking-tight"
      >
        Table of Contents
      </Text>

      {toc.length === 0 ? (
        <View
          style={{ 
            borderColor: borderCol, 
            backgroundColor: bgCard,
            borderStyle: "dashed",
            borderWidth: 1.5,
          }}
          className="flex-1 items-center justify-center p-8 rounded-2xl min-h-[220px]"
        >
          <View 
            style={{ backgroundColor: isLight ? "#f4f4f5" : "#222226" }}
            className="w-12 h-12 rounded-full items-center justify-center mb-4"
          >
            <Ionicons
              name="sync-outline"
              size={20}
              color={textSecondary}
            />
          </View>
          <Text style={{ color: textSecondary }} className="text-xs text-center px-4 leading-5 max-w-[240px]">
            No slides list details synchronized from the desktop presenter yet.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 w-full" showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap gap-3 py-3">
            {toc.map((item) => {
              const isActive = currentSlide === item.index;
              return (
                <TouchableOpacity
                  key={item.index}
                  style={{
                    backgroundColor: isActive
                      ? (isLight ? "#18181b" : "#f4f4f5")
                      : bgCard,
                    borderColor: isActive
                      ? (isLight ? "#18181b" : "#f4f4f5")
                      : borderCol,
                  }}
                  className="w-[48%] h-[100px] border p-4.5 justify-between rounded-2xl"
                  onPress={() => onGotoSlide(item.index)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: isActive
                        ? (isLight ? "#ffffff" : "#0f0f11")
                        : textSecondary,
                    }}
                    className="text-base font-bold font-mono"
                  >
                    {String(item.index).padStart(2, "0")}
                  </Text>
                  <Text
                    style={{
                      color: isActive
                        ? (isLight ? "#e4e4e7" : "#27272a")
                        : textPrimary,
                    }}
                    className="text-[11px] font-bold mt-1"
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
