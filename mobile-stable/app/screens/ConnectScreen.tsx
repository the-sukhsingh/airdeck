import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import QRScannerModal from "../components/QRScannerModal";

interface ConnectScreenProps {
  deviceName: string;
  setDeviceName: (name: string) => void;
  targetIP: string;
  setTargetIP: (ip: string) => void;
  passcode: string;
  setPasscode: (code: string) => void;
  errorMsg: string;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onConnect: () => void;
  onScanQR: (data: string) => void;
}

export default function ConnectScreen({
  deviceName,
  setDeviceName,
  targetIP,
  setTargetIP,
  passcode,
  setPasscode,
  errorMsg,
  theme,
  toggleTheme,
  onConnect,
  onScanQR,
}: ConnectScreenProps) {
  const [scannerVisible, setScannerVisible] = useState<boolean>(false);

  const handleQRScan = (data: string) => {
    setScannerVisible(false);
    onScanQR(data);
  };

  const isLight = theme === "light";
  const bgMain = isLight ? "#fafafa" : "#0f0f11";
  const bgCard = isLight ? "#ffffff" : "#18181b";
  const borderCol = isLight ? "#e4e4e7" : "#27272a";
  const textPrimary = isLight ? "#0f0f11" : "#f4f4f5";
  const textSecondary = isLight ? "#71717a" : "#a1a1aa";
  const bgInput = isLight ? "#fafafa" : "#0f0f11";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgMain }}>
      <StatusBar style={isLight ? "dark" : "light"} />

      {/* Styled Header with Title & Theme Toggle */}
      <View className="flex-row justify-between items-center px-6 pt-6 pb-4">
        <View style={{ width: 40 }} />
        <View className="items-center">
          <Text
            style={{ color: textPrimary }}
            className="text-2xl font-bold tracking-tighter"
          >
            AIRDECK
          </Text>
          <Text
            style={{ color: textSecondary }}
            className="text-[9px] font-bold tracking-[1.5px] mt-0.5 uppercase"
          >
            MOBILE CONTROLLER
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
          title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          <Ionicons
            name={isLight ? "moon-outline" : "sunny-outline"}
            size={18}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <View
          style={{ backgroundColor: bgCard, borderColor: borderCol }}
          className="border rounded-lg p-6 w-full"
        >
          <Text
            style={{ color: textPrimary }}
            className="text-lg font-semibold mb-5 tracking-tight"
          >
            Pair with Presenter
          </Text>

          {errorMsg ? (
            <Text className="text-[#ef4444] text-[11px] font-bold mb-4">
              {errorMsg.toUpperCase()}
            </Text>
          ) : null}

          <TouchableOpacity
            style={{ borderColor: borderCol, backgroundColor: bgInput }}
            className="border py-3.5 items-center justify-center rounded-md mb-5 flex-row gap-2"
            onPress={() => setScannerVisible(true)}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={isLight ? "#18181b" : "#f4f4f5"}
            />
            <Text
              style={{ color: textPrimary }}
              className="text-xs font-semibold tracking-wider"
            >
              SCAN PAIRING QR CODE
            </Text>
          </TouchableOpacity>

          <View className="mb-4">
            <Text
              style={{ color: textSecondary }}
              className="text-[10px] font-bold uppercase mb-1.5 tracking-wider"
            >
              Device Friendly Name
            </Text>
            <TextInput
              style={{
                backgroundColor: bgInput,
                borderColor: borderCol,
                color: textPrimary,
              }}
              className="border rounded-md py-3 px-4 text-sm"
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="e.g. Phone Remote"
              placeholderTextColor={isLight ? "#a1a1aa" : "#52525b"}
            />
          </View>

          <View className="mb-4">
            <Text
              style={{ color: textSecondary }}
              className="text-[10px] font-bold uppercase mb-1.5 tracking-wider"
            >
              Presenter Network IP & Port
            </Text>
            <TextInput
              style={{
                backgroundColor: bgInput,
                borderColor: borderCol,
                color: textPrimary,
              }}
              className="border rounded-md py-3 px-4 text-sm font-mono"
              value={targetIP}
              onChangeText={setTargetIP}
              placeholder="192.168.1.50:12345"
              placeholderTextColor={isLight ? "#a1a1aa" : "#52525b"}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={{ color: textSecondary }} className="text-[10px] mt-1.5">
              Type the local WiFi IPs shown on the laptop presenter screen.
            </Text>
          </View>

          <View className="mb-4">
            <Text
              style={{ color: textPrimary }}
              className="text-[10px] font-bold uppercase mb-1.5 tracking-wider"
            >
              6-Digit Passcode
            </Text>
            <TextInput
              style={{
                backgroundColor: bgInput,
                borderColor: borderCol,
                color: textPrimary,
              }}
              className="border rounded-md py-3 px-4 text-sm font-mono"
              value={passcode}
              onChangeText={setPasscode}
              placeholder="123456"
              placeholderTextColor={isLight ? "#a1a1aa" : "#52525b"}
              maxLength={6}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: isLight ? "#18181b" : "#f4f4f5" }}
            className="py-3.5 items-center justify-center rounded-md mt-2"
            onPress={onConnect}
          >
            <Text
              style={{ color: isLight ? "#ffffff" : "#0f0f11" }}
              className="text-xs font-bold tracking-wider"
            >
              CONNECT REMOTE
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <QRScannerModal
        visible={scannerVisible}
        theme={theme}
        onClose={() => setScannerVisible(false)}
        onScan={handleQRScan}
      />
    </SafeAreaView>
  );
}
