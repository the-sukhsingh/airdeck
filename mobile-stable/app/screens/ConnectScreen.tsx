import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import QRScannerModal from "../components/QRScannerModal";
import { Device } from "react-native-ble-plx";

interface ConnectScreenProps {
  deviceName: string;
  setDeviceName: (name: string) => void;
  targetIP: string;
  setTargetIP: (ip: string) => void;
  passcode: string;
  setPasscode: (code: string) => void;
  errorMsg: string;
  onDismissError?: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onConnect: () => void;
  onScanQR: (data: string) => void;
  
  // BLE-specific props
  connectionMode: "wifi" | "ble";
  setConnectionMode: (mode: "wifi" | "ble") => void;
  scannedDevices: Device[];
  isScanning: boolean;
  onStartScan: () => void;
  onConnectBLE: (device: Device) => void;
}

export default function ConnectScreen(props: ConnectScreenProps) {
  const {
    deviceName,
    setDeviceName,
    errorMsg,
    onDismissError,
    theme,
    toggleTheme,
    onScanQR,
    connectionMode,
    setConnectionMode,
    scannedDevices,
    isScanning,
    onStartScan,
    onConnectBLE,
  } = props;

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
          accessibilityLabel={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          <Ionicons
            name={isLight ? "moon-outline" : "sunny-outline"}
            size={18}
            color={isLight ? "#18181b" : "#f4f4f5"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <View className="mb-8 mt-2 items-center">
          <Text style={{ color: textPrimary }} className="text-xl font-bold tracking-tight text-center">
            Pair with Presenter
          </Text>
          <Text style={{ color: textSecondary }} className="text-xs text-center mt-1 px-4 leading-5">
            Connect your phone to slide presentations over Wi-Fi or Bluetooth.
          </Text>
        </View>

        {/* Connection Mode Toggle */}
        <View 
          style={{ backgroundColor: isLight ? "#f1f1f4" : "#1c1c1f" }} 
          className="flex-row rounded-full p-1 mb-6"
        >
          <TouchableOpacity
            style={{ 
              flex: 1, 
              backgroundColor: connectionMode === "wifi" ? (isLight ? "#ffffff" : "#2d2d30") : "transparent",
              paddingVertical: 10,
              borderRadius: 9999,
              alignItems: "center"
            }}
            onPress={() => setConnectionMode("wifi")}
          >
            <Text 
              style={{ 
                color: connectionMode === "wifi" ? textPrimary : textSecondary 
              }} 
              className="text-xs font-bold tracking-wider"
            >
              WI-FI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ 
              flex: 1, 
              backgroundColor: connectionMode === "ble" ? (isLight ? "#ffffff" : "#2d2d30") : "transparent",
              paddingVertical: 10,
              borderRadius: 9999,
              alignItems: "center"
            }}
            onPress={() => setConnectionMode("ble")}
          >
            <Text 
              style={{ 
                color: connectionMode === "ble" ? textPrimary : textSecondary 
              }} 
              className="text-xs font-bold tracking-wider"
            >
              BLUETOOTH
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View 
            style={{ backgroundColor: isLight ? "#fef2f2" : "#450a0a", borderColor: isLight ? "#fecaca" : "#7f1d1d" }}
            className="border p-3.5 rounded-xl mb-6 flex-row items-center gap-2.5"
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color="#ef4444"
            />
            <Text className="text-[#ef4444] text-xs font-semibold flex-1 leading-4">
              {errorMsg}
            </Text>
            {onDismissError && (
              <TouchableOpacity 
                onPress={onDismissError} 
                activeOpacity={0.7} 
                style={{ padding: 2 }}
                accessibilityLabel="Dismiss error"
              >
                <Ionicons
                  name="close-outline"
                  size={16}
                  color="#ef4444"
                />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Common Device Name Input */}
        <View className="mb-6">
          <Text
            style={{ color: textSecondary }}
            className="text-[10px] font-bold uppercase mb-2 tracking-wider"
          >
            Device Friendly Name
          </Text>
          <TextInput
            style={{
              backgroundColor: bgCard,
              borderColor: borderCol,
              color: textPrimary,
            }}
            className="border rounded-xl py-3.5 px-4 text-sm font-medium"
            value={deviceName}
            onChangeText={setDeviceName}
            placeholder="e.g. Phone Remote"
            placeholderTextColor={isLight ? "#a1a1aa" : "#52525b"}
          />
        </View>

        {connectionMode === "wifi" ? (
          <View className="mt-2">
            {/* Sleek Scan Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setScannerVisible(true)}
              style={{ 
                backgroundColor: bgCard, 
                borderColor: borderCol,
                borderStyle: "dashed",
                borderWidth: 1.5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isLight ? 0.02 : 0.1,
                shadowRadius: 8,
                elevation: 2,
              }}
              className="rounded-2xl p-8 items-center justify-center min-h-[220px]"
            >
              <View 
                style={{ backgroundColor: isLight ? "#f4f4f5" : "#222226" }}
                className="w-16 h-16 rounded-2xl items-center justify-center mb-5"
              >
                <Ionicons
                  name="qr-code-outline"
                  size={32}
                  color={isLight ? "#0f0f11" : "#f4f4f5"}
                />
              </View>
              <Text
                style={{ color: textPrimary }}
                className="text-base font-bold tracking-tight mb-2 text-center"
              >
                Scan Pairing QR Code
              </Text>
              <Text
                style={{ color: textSecondary }}
                className="text-xs text-center leading-5 px-4 max-w-[280px]"
              >
                Tap to open the camera and scan the QR code shown on the desktop presenter app.
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mt-2">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{ color: textSecondary }}
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                Available Bluetooth Presenters
              </Text>
              <TouchableOpacity
                onPress={onStartScan}
                disabled={isScanning}
                className="flex-row items-center gap-1.5 py-1 px-3 rounded-full"
                style={{ backgroundColor: isLight ? "#e4e4e7" : "#27272a" }}
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color={isLight ? "#18181b" : "#f4f4f5"} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={12}
                    color={isLight ? "#18181b" : "#f4f4f5"}
                  />
                )}
                <Text
                  style={{ color: textPrimary }}
                  className="text-[10px] font-bold tracking-wider"
                >
                  {isScanning ? "SCANNING..." : "SCAN"}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{ borderColor: borderCol, backgroundColor: bgCard }}
              className="border rounded-2xl min-h-[180px] mb-4 overflow-hidden"
            >
              {scannedDevices.length === 0 ? (
                <View className="flex-1 items-center justify-center p-8 min-h-[180px]">
                  <View 
                    style={{ backgroundColor: isLight ? "#f4f4f5" : "#222226" }}
                    className="w-12 h-12 rounded-full items-center justify-center mb-3"
                  >
                    <Ionicons
                      name={isScanning ? "sync-outline" : "bluetooth-outline"}
                      size={20}
                      color={textSecondary}
                    />
                  </View>
                  <Text
                    style={{ color: textSecondary }}
                    className="text-xs font-semibold text-center leading-5 max-w-[200px]"
                  >
                    {isScanning ? "Searching for AirDeck presenters..." : "No presenters found. Tap SCAN to search."}
                  </Text>
                </View>
              ) : (
                scannedDevices.map((dev, idx) => (
                  <TouchableOpacity
                    key={dev.id}
                    style={{ 
                      borderBottomColor: borderCol,
                      borderBottomWidth: idx === scannedDevices.length - 1 ? 0 : 1 
                    }}
                    className="p-5 flex-row justify-between items-center active:opacity-60"
                    onPress={() => onConnectBLE(dev)}
                  >
                    <View className="flex-row items-center gap-3">
                      <View 
                        style={{ backgroundColor: isLight ? "#f4f4f5" : "#222226" }}
                        className="w-10 h-10 rounded-xl items-center justify-center"
                      >
                        <Ionicons
                          name="laptop-outline"
                          size={18}
                          color={textPrimary}
                        />
                      </View>
                      <View>
                        <Text
                          style={{ color: textPrimary }}
                          className="text-sm font-semibold tracking-tight"
                        >
                          {dev.name || dev.localName || "Unknown Laptop"}
                        </Text>
                        <Text
                          style={{ color: textSecondary }}
                          className="text-[10px] font-mono mt-0.5"
                        >
                          {dev.id}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward-outline"
                      size={16}
                      color={textSecondary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
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
