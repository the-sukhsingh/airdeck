import React from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

interface AuthenticatingScreenProps {
  fingerprint: string;
  theme: "light" | "dark";
  onCancel: () => void;
}

export default function AuthenticatingScreen({
  fingerprint,
  theme,
  onCancel,
}: AuthenticatingScreenProps) {
  const isLight = theme === "light";
  const bgMain = isLight ? "#fafafa" : "#0f0f11";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: bgMain }}
      className="flex-1 items-center justify-center"
    >
      <StatusBar style={isLight ? "dark" : "light"} />
      <View className="p-6 w-full h-full flex flex-col justify-center items-center">
        <ActivityIndicator
          size="large"
          color={isLight ? "#0f0f11" : "#f4f4f5"}
          style={{ marginBottom: 24 }}
        />
        <Text
          style={{ color: textPrimary }}
          className="text-lg font-bold mb-2 tracking-tight text-center"
        >
          Establishing Connection
        </Text>
        <Text
          style={{ color: textSecondary }}
          className="text-xs mb-6 text-center max-w-[240px] leading-5"
        >
          Securing channel via ECDH key exchange...
        </Text>

        {fingerprint ? (
          <View
            style={{ backgroundColor: bgCard, borderColor: borderCol }}
            className="border rounded-2xl p-6 mt-2 w-full max-w-[280px]"
          >
            <Text
              style={{ color: textSecondary }}
              className="text-[9px] font-bold uppercase tracking-wider"
            >
              SECURITY FINGERPRINT
            </Text>
            <Text
              style={{ color: textPrimary }}
              className="text-3xl font-bold font-mono mt-2 tracking-wide"
            >
              {fingerprint}
            </Text>
            <Text
              style={{ color: textSecondary }}
              className="text-[10px] mt-3 leading-5"
            >
              Verify that this code matches the prompt shown on your laptop
              screen.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={{ backgroundColor: bgCard, borderColor: borderCol }}
          className="border px-8 py-3 flex-row items-center gap-1.5 rounded-full mt-10 active:opacity-70"
          onPress={onCancel}
        >
          <Ionicons
            name="close-circle-outline"
            size={16}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
          <Text
            style={{ color: textPrimary }}
            className="text-xs font-bold tracking-wider"
          >
            CANCEL
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
