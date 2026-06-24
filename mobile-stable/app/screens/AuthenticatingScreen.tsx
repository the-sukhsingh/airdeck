import React from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

interface AuthenticatingScreenProps {
  fingerprint: string;
  onCancel: () => void;
}

export default function AuthenticatingScreen({
  fingerprint,
  onCancel,
}: AuthenticatingScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} className="flex-1 items-center justify-center">
      <StatusBar style="light" />
      <View className="p-6 w-full h-full flex flex-col justify-center items-center">
        <ActivityIndicator
          size="large"
          color="#ffffff"
          style={{ marginBottom: 24 }}
        />
        <Text className="text-lg font-bold mb-2 tracking-tight text-center">
          Establishing Connection
        </Text>
        <Text className="text-[#a3a3a3] text-sm mb-4 text-center">
          Securing channel via ECDH key exchange...
        </Text>

        {fingerprint ? (
          <View className="border border-[#262626]  p-4 mt-4">
            <Text className="text-[9px] font-bold text-[#525252] uppercase">SECURITY FINGERPRINT</Text>
            <Text className="text-2xl font-bold font-mono mt-1">{fingerprint}</Text>
            <Text className="text-[10px] text-[#a3a3a3] mt-2 leading-3.5">
              Verify that this code matches the prompt shown on your laptop
              screen.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          className="border border-[#262626] bg-[#1c1c1c] w-1/2 py-3.5 items-center justify-center rounded-none mt-6"
          onPress={onCancel}
        >
          <Text className="text-white text-xs font-bold tracking-wider">CANCEL</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
