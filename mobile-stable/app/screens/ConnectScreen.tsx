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
  onConnect,
  onScanQR,
}: ConnectScreenProps) {
  const [scannerVisible, setScannerVisible] = useState<boolean>(false);

  const handleQRScan = (data: string) => {
    setScannerVisible(false);
    onScanQR(data);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="dark:bg-[#0a0a0a]">
      <StatusBar style="light" />
      <View className="pt-16 pb-6 items-center">
        <Text className="text-3xl font-extrabold tracking-tighter">AIRDECK</Text>
        <Text className="text-[9px] font-bold text-[#525252] tracking-[2px] mt-1 uppercase">MOBILE CONTROLLER</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <View className="border border-[#262626] rounded-none p-6 w-full">
          <Text className="text-lg font-bold  mb-5 tracking-tight">Pair with Presenter</Text>

          {errorMsg ? (
            <Text className="text-[#ef4444] text-[11px] font-bold mb-4">{errorMsg.toUpperCase()}</Text>
          ) : null}

          <TouchableOpacity
            className="border border-[#262626]  py-3.5 items-center justify-center rounded-none mb-5 flex-row gap-2"
            onPress={() => setScannerVisible(true)}
          >
            <Ionicons name="qr-code-outline" size={16} />
            <Text className=" text-xs font-bold tracking-wider">SCAN PAIRING QR CODE</Text>
          </TouchableOpacity>

          <View className="mb-4">
            <Text className="text-[10px] font-bold text-[#a3a3a3] uppercase mb-1.5 tracking-wider">Device Friendly Name</Text>
            <TextInput
              className=" border border-[#262626] rounded-none  py-3 px-4 text-sm"
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="e.g. Phone Remote"
              placeholderTextColor="#525252"
            />
          </View>

          <View className="mb-4">
            <Text className="text-[10px] font-bold text-[#a3a3a3] uppercase mb-1.5 tracking-wider">Presenter Network IP & Port</Text>
            <TextInput
              className=" border border-[#262626] rounded-none  py-3 px-4 text-sm font-mono"
              value={targetIP}
              onChangeText={setTargetIP}
              placeholder="192.168.1.50:12345"
              placeholderTextColor="#525252"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
            <Text className="text-[10px] text-[#525252] mt-1">
              Type the local WiFi IPs shown on the laptop presenter screen.
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-[10px] font-bold text-[#a3a3a3] uppercase mb-1.5 tracking-wider">6-Digit Passcode</Text>
            <TextInput
              className=" border border-[#262626] rounded-none  py-3 px-4 text-sm font-mono"
              value={passcode}
              onChangeText={setPasscode}
              placeholder="123456"
              placeholderTextColor="#525252"
              maxLength={6}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity className="bg-white py-3.5 items-center justify-center rounded-none mt-2" onPress={onConnect}>
            <Text className="text-[#0a0a0a] text-xs font-bold tracking-wider">CONNECT REMOTE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleQRScan}
      />
    </SafeAreaView>
  );
}
