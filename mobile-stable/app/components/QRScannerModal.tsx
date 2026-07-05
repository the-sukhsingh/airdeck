import React from "react";
import { StyleSheet, Text, View, Modal, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

interface QRScannerModalProps {
  visible: boolean;
  theme?: "light" | "dark";
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScannerModal({
  visible,
  theme,
  onClose,
  onScan,
}: QRScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!visible) return null;

  const isLight = theme === "light";
  const bgColor = isLight ? "#fafafa" : "#0f0f11";
  const textColor = isLight ? "#0f0f11" : "#ffffff";
  const btnBg = isLight ? "#ffffff" : "#18181b";
  const btnBorder = isLight ? "#e4e4e7" : "#27272a";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {!permission ? (
          <View style={styles.center}>
            <Text style={[styles.text, { color: textColor }]}>
              Requesting camera permission...
            </Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={[styles.text, { color: textColor }]}>
              We need your permission to show the camera
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: btnBg, borderColor: btnBorder }]}
              onPress={requestPermission}
            >
              <Text style={[styles.btnText, { color: textColor }]}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel, { borderColor: btnBorder }]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, { color: textColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={({ data }) => {
              if (data) {
                onScan(data);
              }
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  { backgroundColor: btnBg, borderColor: btnBorder },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.closeBtnText, { color: textColor }]}>CLOSE CAMERA</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  text: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 240,
  },
  btnCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  btnText: {
    fontWeight: "bold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "transparent",
    borderRadius: 24,
  },
  closeBtn: {
    position: "absolute",
    bottom: 64,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 24,
  },
  closeBtnText: {
    fontWeight: "bold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
